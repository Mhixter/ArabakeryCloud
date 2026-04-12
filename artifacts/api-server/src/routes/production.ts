import { Router, IRouter } from "express";
import { db, productionBatchesTable, usersTable, branchesTable } from "@workspace/db";
import { eq, and, isNull, gte, lte } from "drizzle-orm";
import { authenticate, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

const formatBatch = (b: typeof productionBatchesTable.$inferSelect, staffName: string, branchName: string) => ({
  id: b.id,
  breadType: b.breadType,
  quantityProduced: b.quantityProduced,
  wasteQuantity: b.wasteQuantity,
  netQuantity: b.quantityProduced - b.wasteQuantity,
  staffId: b.staffId,
  staffName,
  branchId: b.branchId,
  branchName,
  notes: b.notes,
  productionDate: b.productionDate.toISOString(),
  createdAt: b.createdAt.toISOString(),
  updatedAt: b.updatedAt.toISOString(),
});

router.get("/production", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { branchId, startDate, endDate } = req.query as { branchId?: string; startDate?: string; endDate?: string };

  let query = db
    .select({
      batch: productionBatchesTable,
      staffName: usersTable.fullName,
      branchName: branchesTable.name,
    })
    .from(productionBatchesTable)
    .leftJoin(usersTable, eq(productionBatchesTable.staffId, usersTable.id))
    .leftJoin(branchesTable, eq(productionBatchesTable.branchId, branchesTable.id))
    .$dynamic();

  const conditions = [isNull(productionBatchesTable.deletedAt)];

  if (branchId && !isNaN(parseInt(branchId))) {
    conditions.push(eq(productionBatchesTable.branchId, parseInt(branchId)));
  }
  if (startDate) {
    conditions.push(gte(productionBatchesTable.productionDate, new Date(startDate)));
  }
  if (endDate) {
    conditions.push(lte(productionBatchesTable.productionDate, new Date(endDate)));
  }

  const batches = await query.where(and(...conditions)).orderBy(productionBatchesTable.productionDate);

  res.json(batches.map(({ batch, staffName, branchName }) =>
    formatBatch(batch, staffName ?? "Unknown", branchName ?? "Unknown")
  ));
});

router.post("/production", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { breadType, quantityProduced, wasteQuantity, branchId, notes, productionDate } = req.body;
  const user = req.user!;

  if (!breadType || !quantityProduced || branchId == null) {
    res.status(400).json({ error: "breadType, quantityProduced, and branchId are required" });
    return;
  }

  const [batch] = await db.insert(productionBatchesTable).values({
    breadType,
    quantityProduced: parseInt(quantityProduced),
    wasteQuantity: parseInt(wasteQuantity ?? 0),
    staffId: user.userId,
    branchId: parseInt(branchId),
    notes: notes ?? null,
    productionDate: productionDate ? new Date(productionDate) : new Date(),
  }).returning();

  const [staff] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));
  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, batch.branchId));

  await logAudit({
    req,
    userId: user.userId,
    userName: staff?.fullName,
    action: "PRODUCTION_RECORDED",
    entityType: "production",
    entityId: batch.id,
    details: `${breadType}: produced ${quantityProduced}, waste ${wasteQuantity ?? 0}`,
    branchId: batch.branchId,
  });

  res.status(201).json(formatBatch(batch, staff?.fullName ?? "Unknown", branch?.name ?? "Unknown"));
});

router.get("/production/:id", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [result] = await db
    .select({
      batch: productionBatchesTable,
      staffName: usersTable.fullName,
      branchName: branchesTable.name,
    })
    .from(productionBatchesTable)
    .leftJoin(usersTable, eq(productionBatchesTable.staffId, usersTable.id))
    .leftJoin(branchesTable, eq(productionBatchesTable.branchId, branchesTable.id))
    .where(and(eq(productionBatchesTable.id, id), isNull(productionBatchesTable.deletedAt)));

  if (!result) { res.status(404).json({ error: "Production batch not found" }); return; }

  res.json(formatBatch(result.batch, result.staffName ?? "Unknown", result.branchName ?? "Unknown"));
});

router.patch("/production/:id", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { breadType, quantityProduced, wasteQuantity, notes } = req.body;
  const updates: Partial<typeof productionBatchesTable.$inferInsert> = {};
  if (breadType != null) updates.breadType = breadType;
  if (quantityProduced != null) updates.quantityProduced = parseInt(quantityProduced);
  if (wasteQuantity != null) updates.wasteQuantity = parseInt(wasteQuantity);
  if (notes !== undefined) updates.notes = notes;

  const [batch] = await db
    .update(productionBatchesTable)
    .set(updates)
    .where(and(eq(productionBatchesTable.id, id), isNull(productionBatchesTable.deletedAt)))
    .returning();

  if (!batch) { res.status(404).json({ error: "Production batch not found" }); return; }

  const [staff] = await db.select().from(usersTable).where(eq(usersTable.id, batch.staffId));
  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, batch.branchId));

  await logAudit({
    req,
    userId: req.user!.userId,
    action: "PRODUCTION_UPDATED",
    entityType: "production",
    entityId: id,
  });

  res.json(formatBatch(batch, staff?.fullName ?? "Unknown", branch?.name ?? "Unknown"));
});

export default router;
