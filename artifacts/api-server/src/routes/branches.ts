import { Router, IRouter } from "express";
import { db, branchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

const formatBranch = (b: typeof branchesTable.$inferSelect) => ({
  id: b.id,
  name: b.name,
  location: b.location,
  isActive: b.isActive,
  createdAt: b.createdAt.toISOString(),
  updatedAt: b.updatedAt.toISOString(),
});

router.get("/branches", authenticate, async (_req, res): Promise<void> => {
  const branches = await db.select().from(branchesTable).orderBy(branchesTable.name);
  res.json(branches.map(formatBranch));
});

router.post("/branches", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, location } = req.body;
  if (!name) { res.status(400).json({ error: "Branch name required" }); return; }

  const [branch] = await db.insert(branchesTable).values({ name, location: location ?? null }).returning();

  await logAudit({
    req,
    userId: req.user!.userId,
    action: "BRANCH_CREATED",
    entityType: "branch",
    entityId: branch.id,
    details: `Created branch ${name}`,
  });

  res.status(201).json(formatBranch(branch));
});

router.patch("/branches/:id", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { name, location, isActive } = req.body;
  const updates: Partial<typeof branchesTable.$inferInsert> = {};
  if (name != null) updates.name = name;
  if (location !== undefined) updates.location = location;
  if (isActive != null) updates.isActive = isActive;

  const [branch] = await db.update(branchesTable).set(updates).where(eq(branchesTable.id, id)).returning();
  if (!branch) { res.status(404).json({ error: "Branch not found" }); return; }

  res.json(formatBranch(branch));
});

export default router;
