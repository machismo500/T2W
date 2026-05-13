import { apiFetch } from "@/api/client";
import { registerForRide, postBreak } from "@/api/rides";
import { createRidePost } from "@/api/posts";
import { createMotorcycle } from "@/api/misc";
import { approveUser, rejectUser, moderateRegistration } from "@/api/admin";
import { markNotificationRead } from "@/api/misc";
import type { OutboxOp } from "./types";

/**
 * Dispatches a queued op to the real API client. Throws on failure so the
 * flusher can classify the error (retryable vs permanent) and record it.
 *
 * No retry/backoff lives here — the flusher owns that.
 */
export async function dispatch(op: OutboxOp): Promise<void> {
  switch (op.kind) {
    case "ride.register":
      await registerForRide(op.rideId, op.body);
      return;
    case "ride-post.create":
      await createRidePost({ rideId: op.rideId, content: op.body.content, images: op.body.images });
      return;
    case "notification.read":
      await markNotificationRead(op.notificationId);
      return;
    case "motorcycle.create":
      await createMotorcycle(op.body);
      return;
    case "admin.user.approve":
      await approveUser(op.userId);
      return;
    case "admin.user.reject":
      await rejectUser(op.userId);
      return;
    case "admin.registration.moderate":
      await moderateRegistration(op.regId, op.body);
      return;
    case "live.break.start":
      await postBreak(op.rideId, "start", op.reason ?? undefined);
      return;
    case "live.break.end":
      await postBreak(op.rideId, "end");
      return;
    default: {
      // Compile-time exhaustiveness check.
      const _exhaustive: never = op;
      void _exhaustive;
      throw new Error(`Unknown outbox op kind`);
    }
  }
}

/**
 * The list of TanStack Query keys a given op invalidates on success. Lets
 * the flusher trigger refetches without each caller having to know which
 * caches their write affects.
 */
export function invalidationsFor(op: OutboxOp): readonly (readonly unknown[])[] {
  switch (op.kind) {
    case "ride.register":
      return [["ride", op.rideId], ["rides"]];
    case "ride-post.create":
      return [["ride-posts", op.rideId]];
    case "notification.read":
      return [["notifications"]];
    case "motorcycle.create":
      return [["motorcycles"]];
    case "admin.user.approve":
    case "admin.user.reject":
      return [["admin", "users"]];
    case "admin.registration.moderate":
      return [["admin", "registrations"]];
    case "live.break.start":
    case "live.break.end":
      return [["live", op.rideId], ["live-metrics", op.rideId]];
  }
}
