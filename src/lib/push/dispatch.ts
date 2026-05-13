import { prisma } from "@/lib/db";

/**
 * Server-side push dispatch via Expo's Push API.
 *
 * The mobile app registers Expo push tokens (not raw FCM/APNs), so this
 * module talks to https://exp.host/--/api/v2/push/send. Expo fans the
 * payload out to FCM / APNs internally — one HTTP call, two stores.
 *
 * Each notification both:
 *  1. Inserts a row into Notification so the in-app feed has a record
 *     (this matches the existing web Notification UI on / and /dashboard).
 *  2. Pushes to every active DeviceToken for the user. Tokens that come
 *     back as DeviceNotRegistered are pruned in the same call.
 *
 * Failures are logged but never thrown — push is a "nice to have" delivery
 * channel, and the in-app notification row remains as the durable record.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

export type NotifyArgs = {
  /** Target user. If null, the notification is global (in-app only — no push). */
  userId: string | null;
  title: string;
  message: string;
  /** Maps to the existing Notification.type column for icon/colour selection. */
  type?: "info" | "warning" | "success" | "ride";
  /**
   * Optional structured payload — surfaced to the app via the push
   * notification's `data` field. Used by the mobile app to deep-link
   * (`{ kind: "ride", rideId: "..." }`).
   */
  data?: Record<string, unknown>;
  /** Sound on the device. Defaults to "default" so the user notices. */
  sound?: "default" | null;
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: "default" | null;
  data?: Record<string, unknown>;
  channelId?: string;
  priority?: "default" | "normal" | "high";
};

type ExpoPushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

type ExpoPushResponse = { data?: ExpoPushTicket[] };

async function sendExpoBatch(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "accept-encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Expo push HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as ExpoPushResponse;
  return json.data ?? [];
}

/**
 * Create an in-app notification row and dispatch push to every registered
 * device for the user. Returns the notification id for callers that want to
 * reference it.
 */
export async function notifyUser(args: NotifyArgs): Promise<{ notificationId: string }> {
  const notification = await prisma.notification.create({
    data: {
      title: args.title,
      message: args.message,
      type: args.type ?? "info",
      userId: args.userId,
      date: new Date(),
    },
  });

  if (!args.userId) {
    // Global notification — no push targets.
    return { notificationId: notification.id };
  }

  const tokens = await prisma.deviceToken.findMany({
    where: { userId: args.userId },
    select: { id: true, token: true },
  });

  if (tokens.length === 0) {
    return { notificationId: notification.id };
  }

  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    title: args.title,
    body: args.message,
    sound: args.sound === undefined ? "default" : args.sound,
    data: { ...(args.data ?? {}), notificationId: notification.id, type: args.type ?? "info" },
    channelId: "default",
    priority: "high",
  }));

  const stale: string[] = [];
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const tokenSlice = tokens.slice(i, i + BATCH_SIZE);
    try {
      const tickets = await sendExpoBatch(batch);
      tickets.forEach((ticket, j) => {
        if (ticket.status === "error") {
          const err = ticket.details?.error;
          if (err === "DeviceNotRegistered") {
            stale.push(tokenSlice[j].id);
          } else {
            console.warn(
              `[T2W][push] ticket error for token ${tokenSlice[j].id}: ${err ?? ticket.message}`,
            );
          }
        }
      });
    } catch (err) {
      // Network or Expo outage. The DB row is durable; users will see the
      // notification in-app on next launch. Don't propagate.
      console.warn("[T2W][push] batch send failed:", err);
    }
  }

  if (stale.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { id: { in: stale } } });
    console.log(`[T2W][push] pruned ${stale.length} stale device token(s) for user ${args.userId}`);
  }

  return { notificationId: notification.id };
}

/**
 * Convenience for the broad-but-not-userwise case — e.g. "ride starting in
 * 1 hour" goes to every confirmed rider, not the entire user table.
 */
export async function notifyMany(userIds: string[], args: Omit<NotifyArgs, "userId">) {
  await Promise.allSettled(userIds.map((userId) => notifyUser({ ...args, userId })));
}
