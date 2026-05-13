import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer } from "@/lib/api/v1/auth-guard";
import { recordActivity } from "@/lib/api/v1/audit";

/**
 * POST /api/v1/admin/activity-log/:id/rollback
 *
 * Server-side rollback for the supported action types. We deliberately
 * keep this list short — only the actions whose rollback payload schema
 * is well-defined. Unsupported actions return 422 so the mobile client
 * can hide the rollback button.
 *
 * Super admin only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireBearer(req);
  if (!auth.ok) return apiError("UNAUTHORIZED", "Authentication required");
  if (auth.user.role !== "superadmin") {
    return apiError("FORBIDDEN", "Only super admins can roll back activity entries");
  }

  const { id } = await params;
  const entry = await prisma.activityLog.findUnique({ where: { id } });
  if (!entry) return apiError("NOT_FOUND", "Activity entry not found");
  if (!entry.rollbackData) {
    return apiError("UNPROCESSABLE", "This entry doesn't have a rollback payload");
  }
  if (entry.details?.includes("[ROLLED BACK]")) {
    return apiError("CONFLICT", "This entry was already rolled back");
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(entry.rollbackData) as Record<string, unknown>;
  } catch {
    return apiError("UNPROCESSABLE", "Rollback payload is unreadable");
  }

  try {
    switch (entry.action) {
      case "ride_edited": {
        if (!entry.targetId) {
          return apiError("UNPROCESSABLE", "Missing target ride id");
        }
        await prisma.ride.update({
          where: { id: entry.targetId },
          data: extractRideUpdate(data),
        });
        break;
      }

      case "ride_deleted": {
        await prisma.ride.create({ data: extractRideCreate(data) as Parameters<typeof prisma.ride.create>[0]["data"] });
        break;
      }

      case "user_role_changed": {
        if (!entry.targetId || !data.previousRole) {
          return apiError("UNPROCESSABLE", "Missing previousRole / targetId");
        }
        const user = await prisma.user.findUnique({ where: { id: entry.targetId } });
        if (!user) return apiError("NOT_FOUND", "Target user no longer exists");
        await prisma.user.update({
          where: { id: entry.targetId },
          data: { role: String(data.previousRole) },
        });
        if (user.linkedRiderId) {
          await prisma.riderProfile.update({
            where: { id: user.linkedRiderId },
            data: { role: String(data.previousRole) },
          });
        }
        break;
      }

      case "user_deleted": {
        const email = String(data.email ?? "");
        if (!email) return apiError("UNPROCESSABLE", "Missing email in rollback payload");
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          return apiError("CONFLICT", "A user with that email already exists");
        }
        await prisma.user.create({
          data: {
            name: String(data.name ?? "Restored rider"),
            email,
            password: "placeholder-restore-no-login", // user must reset their password
            role: String(data.role ?? "rider"),
            isApproved: Boolean(data.isApproved ?? true),
            phone: data.phone ? String(data.phone) : null,
          },
        });
        break;
      }

      default:
        return apiError(
          "UNPROCESSABLE",
          `Rollback is not supported for action "${entry.action}"`,
        );
    }
  } catch (err) {
    console.error("[T2W][v1] rollback error:", err);
    return apiError("SERVER_ERROR", "Failed to roll back");
  }

  await prisma.activityLog.update({
    where: { id },
    data: {
      details: `[ROLLED BACK] ${entry.details ?? entry.action}`,
    },
  });

  after(() =>
    recordActivity({
      action: "activity_rolled_back",
      performedBy: { id: auth.user.id, name: auth.user.name },
      target: { id, name: entry.targetName },
      details: `Rolled back ${entry.action} on ${entry.targetName}`,
    }).catch(() => {}),
  );

  return apiOk({ success: true });
}

function extractRideCreate(data: Record<string, unknown>): Record<string, unknown> {
  return {
    title: String(data.title ?? ""),
    rideNumber: String(data.rideNumber ?? `#REST-${Date.now()}`),
    type: String(data.type ?? "day"),
    status: String(data.status ?? "upcoming"),
    startDate: new Date(String(data.startDate)),
    endDate: new Date(String(data.endDate)),
    startLocation: String(data.startLocation ?? ""),
    endLocation: String(data.endLocation ?? ""),
    route: stringifyJsonField(data.route, "[]"),
    distanceKm: Number(data.distanceKm ?? 0),
    maxRiders: Number(data.maxRiders ?? 40),
    difficulty: String(data.difficulty ?? "moderate"),
    description: String(data.description ?? ""),
    highlights: stringifyJsonField(data.highlights, "[]"),
    posterUrl: data.posterUrl ? String(data.posterUrl) : null,
    fee: Number(data.fee ?? 0),
    leadRider: String(data.leadRider ?? ""),
    sweepRider: String(data.sweepRider ?? ""),
  };
}

function extractRideUpdate(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const passthrough: (keyof typeof data)[] = [
    "title",
    "type",
    "status",
    "startLocation",
    "endLocation",
    "distanceKm",
    "maxRiders",
    "difficulty",
    "description",
    "posterUrl",
    "fee",
    "leadRider",
    "sweepRider",
  ];
  for (const f of passthrough) {
    if (data[f] !== undefined) out[f] = data[f];
  }
  if (data.startDate) out.startDate = new Date(String(data.startDate));
  if (data.endDate) out.endDate = new Date(String(data.endDate));
  if (data.route) out.route = stringifyJsonField(data.route, "[]");
  if (data.highlights) out.highlights = stringifyJsonField(data.highlights, "[]");
  return out;
}

function stringifyJsonField(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}
