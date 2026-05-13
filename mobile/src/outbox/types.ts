/**
 * Outbox operations — every mutation the app supports while offline goes
 * through here. Each variant is fully self-describing so the flusher can
 * replay it later without re-running the calling code.
 *
 * **Stability contract**: once an OutboxOp shape is shipped, never change
 * it in a breaking way. Persisted ops from older app versions must still
 * deserialise. Add new variants with new `kind` strings instead.
 */
export type OutboxOpKind =
  | "ride.register"
  | "ride-post.create"
  | "notification.read"
  | "motorcycle.create"
  | "admin.user.approve"
  | "admin.user.reject"
  | "admin.registration.moderate"
  | "live.break.start"
  | "live.break.end";

export type OutboxOpInput =
  | { kind: "ride.register"; rideId: string; body: import("@/api/rides").RegistrationBody }
  | { kind: "ride-post.create"; rideId: string; body: { content: string; images: string[] } }
  | { kind: "notification.read"; notificationId: string }
  | {
      kind: "motorcycle.create";
      body: {
        make: string;
        model: string;
        year?: number;
        cc?: number;
        color?: string;
        nickname?: string;
      };
    }
  | { kind: "admin.user.approve"; userId: string }
  | { kind: "admin.user.reject"; userId: string }
  | {
      kind: "admin.registration.moderate";
      regId: string;
      body: { approvalStatus?: "confirmed" | "rejected" | "dropout"; accommodationType?: "bed" };
    }
  | { kind: "live.break.start"; rideId: string; reason: string | null }
  | { kind: "live.break.end"; rideId: string };

export type OutboxStatus =
  | "queued" // never tried
  | "retrying" // failed at least once, will try again
  | "failed"; // permanently failed (4xx) — surfaced to the user

export type OutboxOp = OutboxOpInput & {
  id: string;
  createdAt: number;
  status: OutboxStatus;
  attempts: number;
  lastError?: { code: string; message: string; kind: string };
};
