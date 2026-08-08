import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { Request } from "express";

interface AuditParams {
  req?: Request;
  userId?: number | null;
  userName?: string | null;
  companyId?: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: string | null;
  branchId?: number | null;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const ipAddress = params.req
      ? (params.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        params.req.socket.remoteAddress ||
        null
      : null;

    await db.insert(auditLogsTable).values({
      companyId: params.companyId ?? null,
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details,
      ipAddress,
      branchId: params.branchId,
    });
  } catch {
    // Audit logs should never fail silently in production — but we don't want audit failures to break the main request
  }
}
