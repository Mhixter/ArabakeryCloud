import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { branchesTable } from "./branches";

export const productionBatchesTable = pgTable("production_batches", {
  id: serial("id").primaryKey(),
  breadType: text("bread_type").notNull(),
  quantityProduced: integer("quantity_produced").notNull(),
  wasteQuantity: integer("waste_quantity").notNull().default(0),
  staffId: integer("staff_id").notNull().references(() => usersTable.id),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id),
  notes: text("notes"),
  productionDate: timestamp("production_date", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertProductionBatchSchema = createInsertSchema(productionBatchesTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertProductionBatch = z.infer<typeof insertProductionBatchSchema>;
export type ProductionBatch = typeof productionBatchesTable.$inferSelect;
