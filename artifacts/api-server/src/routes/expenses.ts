import { Router } from "express";
import { db, expenseCategoriesTable, expensesTable, workersTable, workerCategoriesTable, branchesTable, usersTable } from "@workspace/db";
import { eq, and, isNull, gte, lte, asc, desc } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { notifyDirectorsOnEmployeeRecord } from "../lib/notifications";

const router = Router();
const ALLOWED_ROLES = ["managing_director", "manager", "receptionist"];

/* ── Expense Categories ── */

router.get("/expense-categories", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { companyId } = req.user!;
    const cats = await db.select().from(expenseCategoriesTable)
      .where(eq(expenseCategoriesTable.companyId, companyId))
      .orderBy(asc(expenseCategoriesTable.name));
    res.json(cats);
  } catch (err) {
    console.error("GET /expense-categories error:", err);
    res.status(500).json({ error: "Failed to fetch expense categories" });
  }
});

router.post("/expense-categories", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { companyId } = req.user!;
    const { name } = req.body ?? {};
    if (!name?.trim()) { res.status(400).json({ error: "Category name is required" }); return; }
    const [cat] = await db.insert(expenseCategoriesTable).values({ companyId, name: name.trim() }).returning();
    res.status(201).json(cat);
  } catch (err) {
    console.error("POST /expense-categories error:", err);
    res.status(500).json({ error: "Failed to create expense category" });
  }
});

router.delete("/expense-categories/:id", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { companyId } = req.user!;
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    await db.delete(expenseCategoriesTable)
      .where(and(eq(expenseCategoriesTable.id, id), eq(expenseCategoriesTable.companyId, companyId)));
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /expense-categories/:id error:", err);
    res.status(500).json({ error: "Failed to delete expense category" });
  }
});

/* ── Expenses ── */

router.get("/expenses", authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { companyId, role, branchId: userBranchId } = req.user!;
    const { startDate, endDate, branchId: qBranch, categoryId: qCat } = req.query as Record<string, string>;

    const effectiveBranchId = qBranch ? parseInt(qBranch) : role !== "managing_director" ? userBranchId : null;

    const conds: any[] = [eq(expensesTable.companyId, companyId), isNull(expensesTable.deletedAt)];
    if (effectiveBranchId) conds.push(eq(expensesTable.branchId, effectiveBranchId));
    if (qCat) conds.push(eq(expensesTable.expenseCategoryId, parseInt(qCat)));
    if (startDate) conds.push(gte(expensesTable.expenseDate, new Date(startDate)));
    if (endDate) conds.push(lte(expensesTable.expenseDate, new Date(endDate)));

    const rows = await db
      .select({
        id: expensesTable.id,
        note: expensesTable.note,
        amount: expensesTable.amount,
        expenseDate: expensesTable.expenseDate,
        branchId: expensesTable.branchId,
        expenseCategoryId: expensesTable.expenseCategoryId,
        workerId: expensesTable.workerId,
        createdById: expensesTable.createdById,
        createdAt: expensesTable.createdAt,
        categoryName: expenseCategoriesTable.name,
        workerName: workersTable.fullName,
        workerCategoryName: workerCategoriesTable.name,
        branchName: branchesTable.name,
        createdByName: usersTable.fullName,
      })
      .from(expensesTable)
      .leftJoin(expenseCategoriesTable, eq(expensesTable.expenseCategoryId, expenseCategoriesTable.id))
      .leftJoin(workersTable, eq(expensesTable.workerId, workersTable.id))
      .leftJoin(workerCategoriesTable, eq(workersTable.workerCategoryId, workerCategoriesTable.id))
      .leftJoin(branchesTable, eq(expensesTable.branchId, branchesTable.id))
      .leftJoin(usersTable, eq(expensesTable.createdById, usersTable.id))
      .where(and(...conds))
      .orderBy(desc(expensesTable.expenseDate));

    res.json(rows);
  } catch (err) {
    console.error("GET /expenses error:", err);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

router.post("/expenses", authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { companyId, userId, role, branchId: userBranchId } = req.user!;
    const { note, amount, expenseCategoryId, workerId, branchId, expenseDate } = req.body ?? {};
    if (!note?.trim()) { res.status(400).json({ error: "Note is required" }); return; }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { res.status(400).json({ error: "Valid amount is required" }); return; }

    const effectiveBranchId = role !== "managing_director" ? userBranchId : (branchId ? parseInt(branchId) : null);

    const [expense] = await db.insert(expensesTable).values({
      companyId,
      note: note.trim(),
      amount: parseFloat(amount).toFixed(2),
      expenseCategoryId: expenseCategoryId ? parseInt(expenseCategoryId) : null,
      workerId: workerId ? parseInt(workerId) : null,
      branchId: effectiveBranchId ?? null,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      createdById: userId,
    }).returning();
    const [createdBy] = await db
      .select({ fullName: usersTable.fullName })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    await notifyDirectorsOnEmployeeRecord({
      companyId,
      actorUserId: userId,
      actorRole: role,
      entityType: "expense",
      entityId: expense.id,
      title: "Employee added expense record",
      message: `${createdBy?.fullName ?? "An employee"} recorded expense "${note.trim()}" (₦${parseFloat(amount).toLocaleString("en-NG")}).`,
    });
    res.status(201).json(expense);
  } catch (err) {
    console.error("POST /expenses error:", err);
    res.status(500).json({ error: "Failed to record expense" });
  }
});

router.patch("/expenses/:id", authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { companyId, role, branchId: userBranchId } = req.user!;
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const { note, amount, expenseCategoryId, workerId, expenseDate } = req.body ?? {};
    const updates: Record<string, any> = {};
    if (note !== undefined) updates.note = note.trim();
    if (amount !== undefined) updates.amount = parseFloat(amount).toFixed(2);
    if (expenseCategoryId !== undefined) updates.expenseCategoryId = expenseCategoryId ? parseInt(expenseCategoryId) : null;
    if (workerId !== undefined) updates.workerId = workerId ? parseInt(workerId) : null;
    if (expenseDate !== undefined) updates.expenseDate = new Date(expenseDate);

    const branchCond = role !== "managing_director" ? eq(expensesTable.branchId, userBranchId!) : undefined;
    const whereConds: any[] = [eq(expensesTable.id, id), eq(expensesTable.companyId, companyId)];
    if (branchCond) whereConds.push(branchCond);

    const [updated] = await db.update(expensesTable).set(updates).where(and(...whereConds)).returning();
    if (!updated) { res.status(404).json({ error: "Expense not found" }); return; }
    res.json(updated);
  } catch (err) {
    console.error("PATCH /expenses/:id error:", err);
    res.status(500).json({ error: "Failed to update expense" });
  }
});

router.delete("/expenses/:id", authenticate, requireRole(...ALLOWED_ROLES), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { companyId } = req.user!;
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    await db.update(expensesTable).set({ deletedAt: new Date() })
      .where(and(eq(expensesTable.id, id), eq(expensesTable.companyId, companyId)));
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /expenses/:id error:", err);
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

export default router;
