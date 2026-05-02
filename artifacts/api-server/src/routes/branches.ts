import { Router, IRouter } from "express";
import { db, branchesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

const formatBranch = (b: typeof branchesTable.$inferSelect) => ({
  id: b.id,
  companyId: b.companyId,
  name: b.name,
  location: b.location,
  address: b.address,
  phone: b.phone,
  isActive: b.isActive,
  createdAt: b.createdAt.toISOString(),
  updatedAt: b.updatedAt.toISOString(),
});

router.get("/branches", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const branches = await db.select().from(branchesTable)
    .where(and(eq(branchesTable.companyId, companyId), eq(branchesTable.isActive, true)))
    .orderBy(branchesTable.name);
  res.json(branches.map(formatBranch));
});

router.post("/branches", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const { name, address, phone } = req.body;
  if (!name) { res.status(400).json({ error: "Branch name required" }); return; }
  const [branch] = await db.insert(branchesTable).values({
    companyId,
    name,
    address: address ?? null,
    phone: phone ?? null,
  }).returning();
  await logAudit({ req, userId: req.user!.userId, companyId, action: "BRANCH_CREATED", entityType: "branch", entityId: branch.id, details: `Created branch ${name}` });
  res.status(201).json(formatBranch(branch));
});

router.patch("/branches/:id", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { name, address, phone, isActive } = req.body;
  const updates: Partial<typeof branchesTable.$inferInsert> = {};
  if (name != null) updates.name = name;
  if (address !== undefined) updates.address = address;
  if (phone !== undefined) updates.phone = phone;
  if (isActive != null) updates.isActive = isActive;
  const [branch] = await db.update(branchesTable).set(updates).where(and(eq(branchesTable.id, id), eq(branchesTable.companyId, companyId))).returning();
  if (!branch) { res.status(404).json({ error: "Branch not found" }); return; }
  res.json(formatBranch(branch));
});

router.delete("/branches/:id", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const companyId = req.user!.companyId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [branch] = await db
    .update(branchesTable)
    .set({ isActive: false })
    .where(and(eq(branchesTable.id, id), eq(branchesTable.companyId, companyId), eq(branchesTable.isActive, true)))
    .returning();
  if (!branch) { res.status(404).json({ error: "Branch not found" }); return; }
  await logAudit({ req, userId: req.user!.userId, companyId, action: "BRANCH_DELETED", entityType: "branch", entityId: id, details: `Removed branch ${branch.name}` });
  res.json({ success: true });
});

export default router;
