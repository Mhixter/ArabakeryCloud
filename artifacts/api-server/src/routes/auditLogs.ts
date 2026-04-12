import { Router, IRouter } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";

const router: IRouter = Router();

router.get("/audit-logs", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { branchId, userId, action, startDate, endDate, limit, offset } = req.query as {
    branchId?: string;
    userId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: string;
    offset?: string;
  };

  const pageLimit = limit ? parseInt(limit) : 50;
  const pageOffset = offset ? parseInt(offset) : 0;

  const conditions = [];
  if (branchId && !isNaN(parseInt(branchId))) conditions.push(eq(auditLogsTable.branchId, parseInt(branchId)));
  if (userId && !isNaN(parseInt(userId))) conditions.push(eq(auditLogsTable.userId, parseInt(userId)));
  if (action) conditions.push(eq(auditLogsTable.action, action));
  if (startDate) conditions.push(gte(auditLogsTable.createdAt, new Date(startDate)));
  if (endDate) conditions.push(lte(auditLogsTable.createdAt, new Date(endDate)));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, countResult] = await Promise.all([
    db
      .select()
      .from(auditLogsTable)
      .where(whereClause)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(pageLimit)
      .offset(pageOffset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogsTable)
      .where(whereClause),
  ]);

  res.json({
    logs: logs.map(log => ({
      id: log.id,
      userId: log.userId,
      userName: log.userName,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.details,
      ipAddress: log.ipAddress,
      branchId: log.branchId,
      createdAt: log.createdAt.toISOString(),
    })),
    total: Number(countResult[0]?.count ?? 0),
    limit: pageLimit,
    offset: pageOffset,
  });
});

export default router;
