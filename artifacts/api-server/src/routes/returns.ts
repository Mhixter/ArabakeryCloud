import { Router, IRouter } from "express";
import { db, productReturnsTable, usersTable, branchesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticate, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";

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
  receptionistName: string | null,
  branchName: string,
) => ({
  id: r.id,
  companyId: r.companyId,
  branchId: r.branchId,
  branchName,
  sellerId: r.sellerId,
  sellerName,
  receptionistId: r.receptionistId,
  receptionistName,
  breadType: r.breadType,
  quantity: r.quantity,
  reason: r.reason,
  reasonLabel: RETURN_REASON_LABELS[r.reason] ?? r.reason,
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

/* POST /returns — seller submits a return */
router.post("/returns", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, role, companyId, branchId: userBranchId } = req.user!;

  if (role !== "seller") {
    res.status(403).json({ error: "Only sellers can submit returns" }); return;
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
    notes: notes ?? null,
    returnDate: new Date(),
  }).returning();

  await logAudit({
    req, userId, companyId,
    action: "RETURN_SUBMITTED" as any,
    entityType: "return",
    entityId: ret.id,
    details: `Seller returned ${quantity}x ${breadType} — ${reason}`,
    branchId: branchId ?? undefined,
  });

  const [sellerRow] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, userId));
  const [branchRow] = branchId
    ? await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, branchId))
    : [{ name: "Unknown" }];

  res.status(201).json(formatReturn(ret, sellerRow?.fullName ?? "Unknown", null, branchRow?.name ?? "Unknown"));
});

/* PATCH /returns/:id/acknowledge — receptionist acknowledges a return */
router.patch("/returns/:id/acknowledge", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, role, companyId } = req.user!;

  if (!["receptionist", "manager", "managing_director"].includes(role)) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db
    .select()
    .from(productReturnsTable)
    .where(and(eq(productReturnsTable.id, id), eq(productReturnsTable.companyId, companyId)));
  if (!existing) { res.status(404).json({ error: "Return not found" }); return; }

  await db
    .update(productReturnsTable)
    .set({ receptionistId: userId })
    .where(eq(productReturnsTable.id, id));

  res.json({ success: true });
});

export default router;
