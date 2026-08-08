import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  reference: text("reference").notNull().unique(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  gateway: text("gateway").notNull().default("manual"),
  gatewayReference: text("gateway_reference"),
  description: text("description"),
  months: integer("months").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Transaction = typeof transactionsTable.$inferSelect;
