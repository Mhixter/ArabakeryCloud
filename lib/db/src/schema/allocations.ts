import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { branchesTable } from "./branches";
import { companiesTable } from "./companies";
import { productsTable } from "./products";

export const sellerAllocationsTable = pgTable("seller_allocations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id),
  issuedById: integer("issued_by_id").notNull().references(() => usersTable.id),
  productId: integer("product_id").references(() => productsTable.id),
  breadType: text("bread_type").notNull(),
  quantity: integer("quantity").notNull(),
  notes: text("notes"),
  isCleared: boolean("is_cleared").notNull().default(false),
  clearedAt: timestamp("cleared_at", { withTimezone: true }),
  clearedById: integer("cleared_by_id").references(() => usersTable.id),
  allocationDate: timestamp("allocation_date", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertSellerAllocationSchema = createInsertSchema(sellerAllocationsTable).omit({ id: true, createdAt: true, deletedAt: true });
export type InsertSellerAllocation = z.infer<typeof insertSellerAllocationSchema>;
export type SellerAllocation = typeof sellerAllocationsTable.$inferSelect;
