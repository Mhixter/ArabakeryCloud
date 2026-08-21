import { pgTable, serial, integer, text, timestamp, uniqueIndex, boolean, numeric } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { branchesTable } from "./branches";
import { usersTable } from "./users";

export const dailyClosingsTable = pgTable("daily_closings", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  businessDate: text("business_date").notNull(),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  submittedById: integer("submitted_by_id").references(() => usersTable.id),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedById: integer("approved_by_id").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  stockSettledAmount: numeric("stock_settled_amount", { precision: 12, scale: 2 }),
  stockSettlementPaymentMethod: text("stock_settlement_payment_method"),
  stockSettlementNotes: text("stock_settlement_notes"),
  stockSettledById: integer("stock_settled_by_id").references(() => usersTable.id),
  stockSettledAt: timestamp("stock_settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  companyBranchDate: uniqueIndex("daily_closings_company_branch_date_idx").on(table.companyId, table.branchId, table.businessDate),
}));

export const dailyClosingLinesTable = pgTable("daily_closing_lines", {
  id: serial("id").primaryKey(),
  closingId: integer("closing_id").notNull().references(() => dailyClosingsTable.id, { onDelete: "cascade" }),
  productId: integer("product_id"),
  productName: text("product_name").notNull(),
  openingStock: integer("opening_stock").notNull().default(0),
  produced: integer("produced").notNull().default(0),
  allocated: integer("allocated").notNull().default(0),
  returned: integer("returned").notNull().default(0),
  recordedSales: integer("recorded_sales").notNull().default(0),
  closingStock: integer("closing_stock").notNull().default(0),
  counted: boolean("counted").notNull().default(false),
  calculatedSales: integer("calculated_sales").notNull().default(0),
  variance: integer("variance").notNull().default(0),
  varianceReason: text("variance_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DailyClosing = typeof dailyClosingsTable.$inferSelect;
export type DailyClosingLine = typeof dailyClosingLinesTable.$inferSelect;