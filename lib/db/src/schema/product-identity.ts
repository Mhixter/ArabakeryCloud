import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const productIdentityBackfillIssuesTable = pgTable("product_identity_backfill_issues", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  transactionType: text("transaction_type").notNull(),
  transactionId: integer("transaction_id").notNull(),
  breadType: text("bread_type").notNull(),
  candidateCount: integer("candidate_count").notNull().default(0),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductIdentityBackfillIssue = typeof productIdentityBackfillIssuesTable.$inferSelect;