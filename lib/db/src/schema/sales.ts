import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { branchesTable } from "./branches";

export const paymentMethodEnum = ["cash", "transfer"] as const;
export type PaymentMethod = typeof paymentMethodEnum[number];

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  receiptNumber: text("receipt_number").notNull().unique(),
  breadType: text("bread_type").notNull(),
  quantity: integer("quantity").notNull(),
  pricePerUnit: numeric("price_per_unit", { precision: 10, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  costAmount: numeric("cost_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  profitAmount: numeric("profit_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method").$type<PaymentMethod>().notNull(),
  cashierId: integer("cashier_id").notNull().references(() => usersTable.id),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  notes: text("notes"),
  saleDate: timestamp("sale_date", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true, deletedAt: true, receiptNumber: true, totalAmount: true, costAmount: true, profitAmount: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;
