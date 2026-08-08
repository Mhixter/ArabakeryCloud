import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { companiesTable } from "./companies";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  recipientUserId: integer("recipient_user_id").notNull().references(() => usersTable.id),
  actorUserId: integer("actor_user_id").references(() => usersTable.id),
  notificationType: text("notification_type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
