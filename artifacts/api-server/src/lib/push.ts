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

export async function notifyManagers(companyId: number, payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  const managerRoles = ["managing_director", "manager", "receptionist"];

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
        inArray(usersTable.role, managerRoles),
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
