import { Router } from "express";
import { db, workerCategoriesTable, workersTable, branchesTable } from "@workspace/db";
import { eq, and, isNull, asc, or } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";

const router = Router();
const ALLOWED_ROLES = ["managing_director", "manager", "receptionist"];
const MANAGE_ROLES = ["managing_director"];

/* ── Worker Categories ── */

router.get("/worker-categories", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId } = req.user!;
  const cats = await db.select().from(workerCategoriesTable)
    .where(eq(workerCategoriesTable.companyId, companyId))
    .orderBy(asc(workerCategoriesTable.name));
  res.json(cats);
});

router.post("/worker-categories", authenticate, requireRole(...MANAGE_ROLES), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId } = req.user!;
  const { name } = req.body ?? {};
  if (!name?.trim()) { res.status(400).json({ error: "Category name is required" }); return; }
  const [cat] = await db.insert(workerCategoriesTable).values({ companyId, name: name.trim() }).returning();
  res.status(201).json(cat);
});

router.patch("/worker-categories/:id", authenticate, requireRole(...MANAGE_ROLES), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId } = req.user!;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name } = req.body ?? {};
  if (!name?.trim()) { res.status(400).json({ error: "Category name is required" }); return; }
  const [updated] = await db.update(workerCategoriesTable)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(and(eq(workerCategoriesTable.id, id), eq(workerCategoriesTable.companyId, companyId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(updated);
});

router.delete("/worker-categories/:id", authenticate, requireRole(...MANAGE_ROLES), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId } = req.user!;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const workers = await db.select().from(workersTable)
    .where(and(eq(workersTable.workerCategoryId, id), eq(workersTable.companyId, companyId), isNull(workersTable.deletedAt)));
  if (workers.length > 0) { res.status(400).json({ error: "Cannot delete category that has active workers" }); return; }
  await db.delete(workerCategoriesTable)
    .where(and(eq(workerCategoriesTable.id, id), eq(workerCategoriesTable.companyId, companyId)));
  res.json({ success: true });
});

/* ── Workers ── */

router.get("/workers", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId, branchId: jwtBranchId } = req.user!;
  const { categoryId, branchId: queryBranchId } = req.query as { categoryId?: string; branchId?: string };

  const effectiveBranchId = queryBranchId ? parseInt(queryBranchId) : (jwtBranchId ?? null);

  const conds: any[] = [eq(workersTable.companyId, companyId), isNull(workersTable.deletedAt)];
  if (categoryId) conds.push(eq(workersTable.workerCategoryId, parseInt(categoryId)));
  if (effectiveBranchId) {
    conds.push(or(eq(workersTable.branchId, effectiveBranchId), isNull(workersTable.branchId)));
  }

  const rows = await db
    .select({
      id: workersTable.id,
      fullName: workersTable.fullName,
      phone: workersTable.phone,
      isActive: workersTable.isActive,
      workerCategoryId: workersTable.workerCategoryId,
      branchId: workersTable.branchId,
      createdAt: workersTable.createdAt,
      categoryName: workerCategoriesTable.name,
      branchName: branchesTable.name,
    })
    .from(workersTable)
    .leftJoin(workerCategoriesTable, eq(workersTable.workerCategoryId, workerCategoriesTable.id))
    .leftJoin(branchesTable, eq(workersTable.branchId, branchesTable.id))
    .where(and(...conds))
    .orderBy(asc(workersTable.fullName));
  res.json(rows);
});

router.post("/workers", authenticate, requireRole(...MANAGE_ROLES), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId } = req.user!;
  const { fullName, phone, workerCategoryId, branchId } = req.body ?? {};
  if (!fullName?.trim()) { res.status(400).json({ error: "Full name is required" }); return; }
  if (!workerCategoryId) { res.status(400).json({ error: "Category is required" }); return; }
  const [worker] = await db.insert(workersTable).values({
    companyId,
    fullName: fullName.trim(),
    phone: phone?.trim() || null,
    workerCategoryId: parseInt(workerCategoryId),
    branchId: branchId ? parseInt(branchId) : null,
  }).returning();
  res.status(201).json(worker);
});

router.patch("/workers/:id", authenticate, requireRole(...MANAGE_ROLES), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId } = req.user!;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { fullName, phone, workerCategoryId, branchId, isActive } = req.body ?? {};
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (fullName !== undefined) updates.fullName = fullName.trim();
  if (phone !== undefined) updates.phone = phone?.trim() || null;
  if (workerCategoryId !== undefined) updates.workerCategoryId = parseInt(workerCategoryId);
  if (branchId !== undefined) updates.branchId = branchId ? parseInt(branchId) : null;
  if (isActive !== undefined) updates.isActive = isActive;
  const [updated] = await db.update(workersTable).set(updates)
    .where(and(eq(workersTable.id, id), eq(workersTable.companyId, companyId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Worker not found" }); return; }
  res.json(updated);
});

router.delete("/workers/:id", authenticate, requireRole(...MANAGE_ROLES), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId } = req.user!;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(workersTable).set({ deletedAt: new Date() })
    .where(and(eq(workersTable.id, id), eq(workersTable.companyId, companyId)));
  res.json({ success: true });
});

export default router;
