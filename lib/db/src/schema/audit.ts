import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { branchesTable } from "./branches";
import { companiesTable } from "./companies";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id),
  userId: integer("user_id"),
  userName: text("user_name"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  branchId: integer("branch_id").references(() => branchesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
