import { Router, IRouter } from "express";
import { db, productReturnsTable, usersTable, branchesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticate, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";
import { notifyManagers } from "../lib/push";

const router: IRouter = Router();

const RETURN_REASON_LABELS: Record<string, string> = {
  not_sold: "Not Sold",
  damaged: "Damaged",
  expired: "Expired",
  wrong_item: "Wrong Item",
  other: "Other",
};

const formatReturn = (
  r: typeof productReturnsTable.$inferSelect,
  sellerName: string,
  approvedByName: string | null,
  branchName: string,
) => ({
  id: r.id,
  companyId: r.companyId,
  branchId: r.branchId,
  branchName,
  sellerId: r.sellerId,
  sellerName,
  receptionistId: r.receptionistId,
  approvedByName,
  breadType: r.breadType,
  quantity: r.quantity,
  reason: r.reason,
  reasonLabel: RETURN_REASON_LABELS[r.reason] ?? r.reason,
  status: r.status,
  notes: r.notes,
  returnDate: r.returnDate.toISOString(),
  createdAt: r.createdAt.toISOString(),
});

/* GET /returns */
router.get("/returns", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, role, companyId, branchId: userBranchId } = req.user!;
  const { branchId: queryBranchId } = req.query as { branchId?: string };

  const conditions: Parameters<typeof and>[0][] = [
    eq(productReturnsTable.companyId, companyId),
  ];

  if (role === "supplier") {
    conditions.push(eq(productReturnsTable.sellerId, userId));
  } else {
    const branchFilter = queryBranchId && !isNaN(parseInt(queryBranchId))
      ? parseInt(queryBranchId)
      : (role !== "managing_director" ? userBranchId : null);
    if (branchFilter) conditions.push(eq(productReturnsTable.branchId, branchFilter));
  }

  const rows = await db
    .select({
      ret: productReturnsTable,
      sellerName: usersTable.fullName,
      branchName: branchesTable.name,
    })
    .from(productReturnsTable)
    .leftJoin(usersTable, eq(productReturnsTable.sellerId, usersTable.id))
    .leftJoin(branchesTable, eq(productReturnsTable.branchId, branchesTable.id))
    .where(and(...conditions))
    .orderBy(productReturnsTable.returnDate);

  const companyUsers = await db
    .select({ id: usersTable.id, fullName: usersTable.fullName })
    .from(usersTable)
    .where(eq(usersTable.companyId, companyId));
  const userMap = new Map(companyUsers.map(u => [u.id, u.fullName]));

  res.json(rows.map(({ ret, sellerName, branchName }) =>
    formatReturn(
      ret,
      sellerName ?? "Unknown",
      ret.receptionistId ? (userMap.get(ret.receptionistId) ?? "Unknown") : null,
      branchName ?? "Unknown",
    ),
  ));
});

/* POST /returns — supplier submits a return (starts as "pending") */
router.post("/returns", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, role, companyId, branchId: userBranchId } = req.user!;

  if (role !== "supplier") {
    res.status(403).json({ error: "Only suppliers can submit returns" }); return;
  }

  const { breadType, quantity, reason, notes, branchId: bodyBranchId } = req.body;
  if (!breadType || !quantity || !reason) {
    res.status(400).json({ error: "breadType, quantity, and reason are required" }); return;
  }

  const validReasons = ["not_sold", "damaged", "expired", "wrong_item", "other"];
  if (!validReasons.includes(reason)) {
    res.status(400).json({ error: "Invalid reason" }); return;
  }

  const branchId = bodyBranchId ? parseInt(bodyBranchId) : userBranchId;

  const [ret] = await db.insert(productReturnsTable).values({
    companyId,
    branchId: branchId ?? null,
    sellerId: userId,
    receptionistId: null,
    breadType,
    quantity: parseInt(quantity),
    reason,
    status: "pending",
    notes: notes ?? null,
    returnDate: new Date(),
  }).returning();

  await logAudit({
    req, userId, companyId,
    action: "RETURN_SUBMITTED" as any,
    entityType: "return",
    entityId: ret.id,
    details: `Supplier returned ${quantity}x ${breadType} — ${reason} (awaiting approval)`,
    branchId: branchId ?? undefined,
  });

  const [sellerRow] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, userId));
  const [branchRow] = branchId
    ? await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, branchId))
    : [{ name: "Unknown" }];

  notifyManagers(companyId, {
    title: "Return Submitted",
    body: `${sellerRow?.fullName ?? "A supplier"} returned ${quantity}× ${breadType} (${reason.replace("_", " ")}) — awaiting approval`,
    url: "/sales",
    tag: `return-${ret.id}`,
  }).catch(() => {});

  res.status(201).json(formatReturn(ret, sellerRow?.fullName ?? "Unknown", null, branchRow?.name ?? "Unknown"));
});

/* PATCH /returns/:id/approve — receptionist/manager/MD approves a pending return */
router.patch("/returns/:id/approve", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, role, companyId } = req.user!;

  if (!["receptionist", "manager", "managing_director"].includes(role)) {
    res.status(403).json({ error: "Not authorised to approve returns" }); return;
  }

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db
    .select()
    .from(productReturnsTable)
    .where(and(eq(productReturnsTable.id, id), eq(productReturnsTable.companyId, companyId)));

  if (!existing) { res.status(404).json({ error: "Return not found" }); return; }
  if (existing.status !== "pending") {
    res.status(400).json({ error: `Return is already ${existing.status}` }); return;
  }

  const [updated] = await db
    .update(productReturnsTable)
    .set({ status: "approved", receptionistId: userId })
    .where(eq(productReturnsTable.id, id))
    .returning();

  await logAudit({
    req, userId, companyId,
    action: "RETURN_APPROVED" as any,
    entityType: "return",
    entityId: id,
    details: `Approved return of ${existing.quantity}x ${existing.breadType} from supplier`,
    branchId: existing.branchId ?? undefined,
  });

  const companyUsers = await db
    .select({ id: usersTable.id, fullName: usersTable.fullName })
    .from(usersTable)
    .where(eq(usersTable.companyId, companyId));
  const userMap = new Map(companyUsers.map(u => [u.id, u.fullName]));
  const [sellerRow] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, existing.sellerId));
  const [branchRow] = existing.branchId
    ? await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, existing.branchId))
    : [{ name: "Unknown" }];

  res.json(formatReturn(updated, sellerRow?.fullName ?? "Unknown", userMap.get(userId) ?? "Unknown", branchRow?.name ?? "Unknown"));
});

/* PATCH /returns/:id/reject — receptionist/manager/MD rejects a pending return */
router.patch("/returns/:id/reject", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, role, companyId } = req.user!;

  if (!["receptionist", "manager", "managing_director"].includes(role)) {
    res.status(403).json({ error: "Not authorised to reject returns" }); return;
  }

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db
    .select()
    .from(productReturnsTable)
    .where(and(eq(productReturnsTable.id, id), eq(productReturnsTable.companyId, companyId)));

  if (!existing) { res.status(404).json({ error: "Return not found" }); return; }
  if (existing.status !== "pending") {
    res.status(400).json({ error: `Return is already ${existing.status}` }); return;
  }

  const [updated] = await db
    .update(productReturnsTable)
    .set({ status: "rejected", receptionistId: userId })
    .where(eq(productReturnsTable.id, id))
    .returning();

  await logAudit({
    req, userId, companyId,
    action: "RETURN_REJECTED" as any,
    entityType: "return",
    entityId: id,
    details: `Rejected return of ${existing.quantity}x ${existing.breadType} from supplier`,
    branchId: existing.branchId ?? undefined,
  });

  const [sellerRow] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, existing.sellerId));
  const [branchRow] = existing.branchId
    ? await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, existing.branchId))
    : [{ name: "Unknown" }];

  res.json(formatReturn(updated, sellerRow?.fullName ?? "Unknown", null, branchRow?.name ?? "Unknown"));
});

export default router;
