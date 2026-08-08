import { and, eq, isNull } from "drizzle-orm";
import { db, notificationsTable, usersTable } from "@workspace/db";

const EMPLOYEE_ROLES = new Set(["manager", "receptionist", "production_staff"]);

interface EmployeeRecordNotificationInput {
  companyId: number;
  actorUserId: number;
  actorRole: string;
  entityType: string;
  entityId: number;
  title: string;
  message: string;
}

export async function notifyDirectorsOnEmployeeRecord(input: EmployeeRecordNotificationInput): Promise<void> {
  const { companyId, actorUserId, actorRole, entityType, entityId, title, message } = input;
  if (!EMPLOYEE_ROLES.has(actorRole)) return;

  const directors = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(
      eq(usersTable.companyId, companyId),
      eq(usersTable.role, "managing_director"),
      eq(usersTable.isActive, true),
      isNull(usersTable.deletedAt),
    ));

  if (!directors.length) return;

  await db.insert(notificationsTable).values(
    directors.map((director) => ({
      companyId,
      recipientUserId: director.id,
      actorUserId,
      notificationType: "EMPLOYEE_RECORD_CREATED",
      title,
      message,
      entityType,
      entityId,
    })),
  );
}
