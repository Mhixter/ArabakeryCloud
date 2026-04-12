import { Router, IRouter } from "express";
import { db, inventoryItemsTable, inventoryLogsTable, branchesTable } from "@workspace/db";
import { eq, and, isNull, lte } from "drizzle-orm";
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
  const { branchId } = req.query as { branchId?: string };

  let baseQuery = db
    .select({
      item: inventoryItemsTable,
      branchName: branchesTable.name,
    })
    .from(inventoryItemsTable)
    .leftJoin(branchesTable, eq(inventoryItemsTable.branchId, branchesTable.id))
    .$dynamic();

  const conditions = [isNull(inventoryItemsTable.deletedAt)];
  if (branchId && !isNaN(parseInt(branchId))) {
    conditions.push(eq(inventoryItemsTable.branchId, parseInt(branchId)));
  }

  const items = await baseQuery.where(and(...conditions)).orderBy(inventoryItemsTable.name);
  res.json(items.map(({ item, branchName }) => formatItem(item, branchName ?? "Unknown")));
});

router.get("/inventory/low-stock", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { branchId } = req.query as { branchId?: string };

  // Get all non-deleted items and filter in JS to avoid SQL expression comparison issue
  const conditions = [isNull(inventoryItemsTable.deletedAt)];
  if (branchId && !isNaN(parseInt(branchId))) {
    conditions.push(eq(inventoryItemsTable.branchId, parseInt(branchId)));
  }

  const allItems = await db
    .select({
      item: inventoryItemsTable,
      branchName: branchesTable.name,
    })
    .from(inventoryItemsTable)
    .leftJoin(branchesTable, eq(inventoryItemsTable.branchId, branchesTable.id))
    .where(and(...conditions));

  const lowStockItems = allItems.filter(({ item }) =>
    parseFloat(item.currentQuantity as unknown as string) <= parseFloat(item.minimumQuantity as unknown as string)
  );

  res.json(lowStockItems.map(({ item, branchName }) => formatItem(item, branchName ?? "Unknown")));
});

router.post("/inventory", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, category, unit, currentQuantity, minimumQuantity, costPerUnit, branchId } = req.body;

  if (!name || !category || !unit || branchId == null) {
    res.status(400).json({ error: "name, category, unit, and branchId are required" });
    return;
  }

  const [item] = await db.insert(inventoryItemsTable).values({
    name,
    category,
    unit,
    currentQuantity: (currentQuantity ?? 0).toString(),
    minimumQuantity: (minimumQuantity ?? 0).toString(),
    costPerUnit: (costPerUnit ?? 0).toString(),
    branchId: parseInt(branchId),
  }).returning();

  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, item.branchId));

  await logAudit({
    req,
    userId: req.user!.userId,
    action: "INVENTORY_CREATED",
    entityType: "inventory",
    entityId: item.id,
    details: `Added ${name} (${category})`,
    branchId: item.branchId,
  });

  res.status(201).json(formatItem(item, branch?.name ?? "Unknown"));
});

router.get("/inventory/:id", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [result] = await db
    .select({ item: inventoryItemsTable, branchName: branchesTable.name })
    .from(inventoryItemsTable)
    .leftJoin(branchesTable, eq(inventoryItemsTable.branchId, branchesTable.id))
    .where(and(eq(inventoryItemsTable.id, id), isNull(inventoryItemsTable.deletedAt)));

  if (!result) { res.status(404).json({ error: "Inventory item not found" }); return; }
  res.json(formatItem(result.item, result.branchName ?? "Unknown"));
});

router.patch("/inventory/:id", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { name, category, unit, currentQuantity, minimumQuantity, costPerUnit } = req.body;
  const updates: Record<string, unknown> = {};
  if (name != null) updates.name = name;
  if (category != null) updates.category = category;
  if (unit != null) updates.unit = unit;
  if (currentQuantity != null) updates.currentQuantity = currentQuantity.toString();
  if (minimumQuantity != null) updates.minimumQuantity = minimumQuantity.toString();
  if (costPerUnit != null) updates.costPerUnit = costPerUnit.toString();

  const [item] = await db.update(inventoryItemsTable).set(updates).where(and(eq(inventoryItemsTable.id, id), isNull(inventoryItemsTable.deletedAt))).returning();
  if (!item) { res.status(404).json({ error: "Inventory item not found" }); return; }

  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, item.branchId));

  await logAudit({
    req,
    userId: req.user!.userId,
    action: "INVENTORY_UPDATED",
    entityType: "inventory",
    entityId: id,
  });

  res.json(formatItem(item, branch?.name ?? "Unknown"));
});

router.delete("/inventory/:id", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [item] = await db.update(inventoryItemsTable).set({ deletedAt: new Date() }).where(and(eq(inventoryItemsTable.id, id), isNull(inventoryItemsTable.deletedAt))).returning();
  if (!item) { res.status(404).json({ error: "Inventory item not found" }); return; }

  await logAudit({
    req,
    userId: req.user!.userId,
    action: "INVENTORY_DELETED",
    entityType: "inventory",
    entityId: id,
  });

  res.json({ success: true, message: "Inventory item deleted" });
});

router.post("/inventory/:id/adjust", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { adjustment, reason } = req.body;
  if (adjustment == null || !reason) { res.status(400).json({ error: "adjustment and reason are required" }); return; }

  const [existing] = await db.select().from(inventoryItemsTable).where(and(eq(inventoryItemsTable.id, id), isNull(inventoryItemsTable.deletedAt)));
  if (!existing) { res.status(404).json({ error: "Inventory item not found" }); return; }

  const previousQuantity = parseFloat(existing.currentQuantity as unknown as string);
  const newQuantity = Math.max(0, previousQuantity + parseFloat(adjustment));

  const [item] = await db.update(inventoryItemsTable).set({ currentQuantity: newQuantity.toString() }).where(eq(inventoryItemsTable.id, id)).returning();

  await db.insert(inventoryLogsTable).values({
    inventoryItemId: id,
    adjustment: adjustment.toString(),
    previousQuantity: previousQuantity.toString(),
    newQuantity: newQuantity.toString(),
    reason,
    userId: req.user!.userId,
    branchId: existing.branchId,
  });

  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, item.branchId));

  await logAudit({
    req,
    userId: req.user!.userId,
    action: "INVENTORY_ADJUSTED",
    entityType: "inventory",
    entityId: id,
    details: `Adjusted by ${adjustment} (${reason})`,
    branchId: existing.branchId,
  });

  res.json(formatItem(item, branch?.name ?? "Unknown"));
});

export default router;
