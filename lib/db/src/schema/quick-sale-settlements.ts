import { pgTable, serial, integer, text, timestamp, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { branchesTable } from "./branches";
import { usersTable } from "./users";

export const quickSaleSettlementsTable = pgTable("quick_sale_settlements", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  weekStart: text("week_start").notNull(),
  weekEnd: text("week_end").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  notes: text("notes"),
  acceptedById: integer("accepted_by_id").notNull().references(() => usersTable.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  companyBranchWeek: uniqueIndex("quick_sale_settlements_company_branch_week_idx").on(table.companyId, table.branchId, table.weekStart),
}));