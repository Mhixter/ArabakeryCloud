import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { branchesTable } from "./branches";
import { usersTable } from "./users";
import { productsTable } from "./products";

export const RETURN_REASONS = ["not_sold", "damaged", "expired", "wrong_item", "other"] as const;
export type ReturnReason = typeof RETURN_REASONS[number];

export type ReturnStatus = "pending" | "approved" | "rejected";

export const productReturnsTable = pgTable("product_returns", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id),
  receptionistId: integer("receptionist_id").references(() => usersTable.id),
  productId: integer("product_id").references(() => productsTable.id),
  breadType: text("bread_type").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason").$type<ReturnReason>().notNull().default("not_sold"),
  status: text("status").$type<ReturnStatus>().notNull().default("pending"),
  notes: text("notes"),
  returnDate: timestamp("return_date", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductReturn = typeof productReturnsTable.$inferSelect;
