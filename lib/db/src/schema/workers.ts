import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { branchesTable } from "./branches";

export const workerCategoriesTable = pgTable("worker_categories", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workersTable = pgTable("workers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  workerCategoryId: integer("worker_category_id").notNull().references(() => workerCategoriesTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type WorkerCategory = typeof workerCategoriesTable.$inferSelect;
export type Worker = typeof workersTable.$inferSelect;
