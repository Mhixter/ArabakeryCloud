import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const paymentGatewayConfigTable = pgTable("payment_gateway_config", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("paystack"),
  publicKey: text("public_key").notNull().default(""),
  secretKey: text("secret_key").notNull().default(""),
  webhookSecret: text("webhook_secret").notNull().default(""),
  mode: text("mode").notNull().default("test"),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  updatedBy: text("updated_by"),
});

export type PaymentGatewayConfig = typeof paymentGatewayConfigTable.$inferSelect;
