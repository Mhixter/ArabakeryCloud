import { Router, IRouter } from "express";
import { db, inventoryItemsTable, inventoryLogsTable, branchesTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

const formatItem = (item: typeof inventoryItemsTable.$inferSelect, branchName: string) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  unit: item.unit,
  currentQuantity: parseFloat(item.currentQuantity as unknown as string),
  minimumQuantity: parseFloat(item.minimumQuantity as unknown as string),
  costPerUnit: parseFloat(item.costPerUnit as unknown as string),
  branchId: item.branchId,
  branchName,
  isLowStock: parseFloat(item.currentQuantity as unknown as string) <= parseFloat(item.minimumQuantity as unknown as string),
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  deletedAt: item.deletedAt?.toISOString() ?? null,
});

router.get("/inventory", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const { branchId } = req.query as { branchId?: string };
  const conditions = [isNull(inventoryItemsTable.deletedAt), eq(inventoryItemsTable.companyId, companyId)];
  if (branchId && !isNaN(parseInt(branchId))) conditions.push(eq(inventoryItemsTable.branchId, parseInt(branchId)));
  const items = await db.select({ item: inventoryItemsTable, branchName: branchesTable.name }).from(inventoryItemsTable).leftJoin(branchesTable, eq(inventoryItemsTable.branchId, branchesTable.id)).where(and(...conditions)).orderBy(inventoryItemsTable.name);
  res.json(items.map(({ item, branchName }) => formatItem(item, branchName ?? "Unknown")));
});

router.get("/inventory/low-stock", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const { branchId } = req.query as { branchId?: string };
  const conditions = [isNull(inventoryItemsTable.deletedAt), eq(inventoryItemsTable.companyId, companyId)];
  if (branchId && !isNaN(parseInt(branchId))) conditions.push(eq(inventoryItemsTable.branchId, parseInt(branchId)));
  const allItems = await db.select({ item: inventoryItemsTable, branchName: branchesTable.name }).from(inventoryItemsTable).leftJoin(branchesTable, eq(inventoryItemsTable.branchId, branchesTable.id)).where(and(...conditions));
  const lowStockItems = allItems.filter(({ item }) => parseFloat(item.currentQuantity as unknown as string) <= parseFloat(item.minimumQuantity as unknown as string));
  res.json(lowStockItems.map(({ item, branchName }) => formatItem(item, branchName ?? "Unknown")));
});

router.post("/inventory", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const { name, category, unit, currentQuantity, minimumQuantity, costPerUnit, branchId } = req.body;
  if (!name || !category || !unit || branchId == null) { res.status(400).json({ error: "name, category, unit, and branchId are required" }); return; }
  const [item] = await db.insert(inventoryItemsTable).values({ companyId, name, category, unit, currentQuantity: (currentQuantity ?? 0).toString(), minimumQuantity: (minimumQuantity ?? 0).toString(), costPerUnit: (costPerUnit ?? 0).toString(), branchId: parseInt(branchId) }).returning();
  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, item.branchId));
  await logAudit({ req, userId: req.user!.userId, companyId, action: "INVENTORY_CREATED", entityType: "inventory", entityId: item.id, details: `Added ${name} (${category})`, branchId: item.branchId });
  res.status(201).json(formatItem(item, branch?.name ?? "Unknown"));
});

router.patch("/inventory/:id", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  /* Conflict detection: if the client sent X-Offline-Queued-At, check whether
     the record was modified after the mutation was queued. */
  const queuedAtHeader = req.headers["x-offline-queued-at"];
  if (queuedAtHeader) {
    const queuedAt = new Date(parseInt(queuedAtHeader as string, 10));
    const [existing] = await db.select().from(inventoryItemsTable)
      .where(and(eq(inventoryItemsTable.id, id), eq(inventoryItemsTable.companyId, companyId), isNull(inventoryItemsTable.deletedAt)));
    if (existing && existing.updatedAt > queuedAt) {
      const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, existing.branchId));
      res.status(409).json({
        error: "Conflict",
        message: "This inventory item was modified by someone else while you were offline.",
        serverData: formatItem(existing, branch?.name ?? "Unknown"),
      });
      return;
    }
  }

  const { name, category, unit, minimumQuantity, costPerUnit } = req.body;
  const updates: Partial<typeof inventoryItemsTable.$inferInsert> = {};
  if (name != null) updates.name = name;
  if (category != null) updates.category = category;
  if (unit != null) updates.unit = unit;
  if (minimumQuantity != null) updates.minimumQuantity = minimumQuantity.toString();
  if (costPerUnit != null) updates.costPerUnit = costPerUnit.toString();
  const [item] = await db.update(inventoryItemsTable).set(updates).where(and(eq(inventoryItemsTable.id, id), eq(inventoryItemsTable.companyId, companyId))).returning();
  if (!item) { res.status(404).json({ error: "Inventory item not found" }); return; }
  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, item.branchId));
  res.json(formatItem(item, branch?.name ?? "Unknown"));
});

router.delete("/inventory/:id", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [item] = await db.update(inventoryItemsTable).set({ deletedAt: new Date() }).where(and(eq(inventoryItemsTable.id, id), eq(inventoryItemsTable.companyId, companyId), isNull(inventoryItemsTable.deletedAt))).returning();
  if (!item) { res.status(404).json({ error: "Inventory item not found" }); return; }
  await logAudit({ req, userId: req.user!.userId, companyId, action: "INVENTORY_DELETED", entityType: "inventory", entityId: id });
  res.json({ success: true, message: "Inventory item deleted" });
});

router.post("/inventory/:id/adjust", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { adjustment, reason } = req.body;
  if (adjustment == null || !reason) { res.status(400).json({ error: "adjustment and reason are required" }); return; }
  const [existing] = await db.select().from(inventoryItemsTable).where(and(eq(inventoryItemsTable.id, id), eq(inventoryItemsTable.companyId, companyId), isNull(inventoryItemsTable.deletedAt)));
  if (!existing) { res.status(404).json({ error: "Inventory item not found" }); return; }

  /* Conflict detection for adjustments — same pattern as PATCH */
  const adjustQueuedAt = req.headers["x-offline-queued-at"];
  if (adjustQueuedAt && existing.updatedAt > new Date(parseInt(adjustQueuedAt as string, 10))) {
    const [adjBranch] = await db.select().from(branchesTable).where(eq(branchesTable.id, existing.branchId));
    res.status(409).json({
      error: "Conflict",
      message: "This inventory item was adjusted by someone else while you were offline.",
      serverData: formatItem(existing, adjBranch?.name ?? "Unknown"),
    });
    return;
  }

  const previousQuantity = parseFloat(existing.currentQuantity as unknown as string);
  const newQuantity = Math.max(0, previousQuantity + parseFloat(adjustment));
  const [item] = await db.update(inventoryItemsTable).set({ currentQuantity: newQuantity.toString() }).where(eq(inventoryItemsTable.id, id)).returning();
  await db.insert(inventoryLogsTable).values({ companyId, inventoryItemId: id, adjustment: adjustment.toString(), previousQuantity: previousQuantity.toString(), newQuantity: newQuantity.toString(), reason, userId: req.user!.userId, branchId: existing.branchId });
  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, item.branchId));
  await logAudit({ req, userId: req.user!.userId, companyId, action: "INVENTORY_ADJUSTED", entityType: "inventory", entityId: id, details: `Adjusted by ${adjustment} (${reason})`, branchId: existing.branchId });
  res.json(formatItem(item, branch?.name ?? "Unknown"));
});

export default router;
