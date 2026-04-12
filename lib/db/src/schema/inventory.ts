import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { branchesTable } from "./branches";

export const inventoryItemsTable = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  currentQuantity: numeric("current_quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  minimumQuantity: numeric("minimum_quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  costPerUnit: numeric("cost_per_unit", { precision: 10, scale: 2 }).notNull().default("0"),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const inventoryLogsTable = pgTable("inventory_logs", {
  id: serial("id").primaryKey(),
  inventoryItemId: integer("inventory_item_id").notNull().references(() => inventoryItemsTable.id),
  adjustment: numeric("adjustment", { precision: 10, scale: 3 }).notNull(),
  previousQuantity: numeric("previous_quantity", { precision: 10, scale: 3 }).notNull(),
  newQuantity: numeric("new_quantity", { precision: 10, scale: 3 }).notNull(),
  reason: text("reason").notNull(),
  userId: integer("user_id"),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItemsTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
export type InventoryLog = typeof inventoryLogsTable.$inferSelect;
