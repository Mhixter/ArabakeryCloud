import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const subscriptionStatusEnum = ["trial", "active", "expired", "cancelled"] as const;
export type SubscriptionStatus = typeof subscriptionStatusEnum[number];

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  plan: text("plan").notNull().default("starter"),
  status: text("status").$type<SubscriptionStatus>().notNull().default("trial"),
  priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 }).notNull().default("3000"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  paystackCustomerCode: text("paystack_customer_code"),
  paystackSubscriptionCode: text("paystack_subscription_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
