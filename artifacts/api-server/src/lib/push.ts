import webpush from "web-push";
import { db, pushSubscriptionsTable, usersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    "mailto:admin@newmodelbread.com",
    VAPID_PUBLIC,
    VAPID_PRIVATE,
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

async function notifyUsersWithRoles(companyId: number, roles: string[], payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  const subs = await db
    .select({
      id: pushSubscriptionsTable.id,
      endpoint: pushSubscriptionsTable.endpoint,
      p256dh: pushSubscriptionsTable.p256dh,
      auth: pushSubscriptionsTable.auth,
    })
    .from(pushSubscriptionsTable)
    .innerJoin(usersTable, eq(pushSubscriptionsTable.userId, usersTable.id))
    .where(
      and(
        eq(pushSubscriptionsTable.companyId, companyId),
        inArray(usersTable.role, roles),
      ),
    );

  const staleIds: number[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          staleIds.push(sub.id);
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await db.delete(pushSubscriptionsTable).where(inArray(pushSubscriptionsTable.id, staleIds));
  }
}

/* Operational alerts used by sales, returns, and inventory workflows. */
export function notifyManagers(companyId: number, payload: PushPayload): Promise<void> {
  return notifyUsersWithRoles(companyId, ["managing_director", "manager", "receptionist"], payload);
}

/* Every audited activity is delivered to Managing Directors only. */
export function notifyManagingDirectors(companyId: number, payload: PushPayload): Promise<void> {
  return notifyUsersWithRoles(companyId, ["managing_director"], payload);
}
