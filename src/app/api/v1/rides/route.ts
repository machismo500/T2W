import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { computeRideStatus } from "@/lib/ride-status";
import { safeJsonParse } from "@/lib/json-utils";
import { apiError, apiOk } from "@/lib/api/v1/errors";
import { requireBearer } from "@/lib/api/v1/auth-guard";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

/**
 * GET /api/v1/rides?cursor=...&limit=20&status=upcoming
 *
 * Cursor pagination by descending startDate. Mobile-shaped payload — only the
 * fields the rides list card needs. Detail endpoint returns the rest.
 */
export async function GET(req: NextRequest) {
  const auth = await requireBearer(req);
  if (!auth.ok) {
    return apiError("UNAUTHORIZED", "Authentication required");
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status"); // upcoming | ongoing | completed | cancelled | all
  const cursor = searchParams.get("cursor"); // ride id
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "") || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  const dbWhere: Record<string, unknown> = {};
  if (status === "cancelled" || status === "completed" || status === "ongoing") {
    dbWhere.status = status;
  }

  const rides = await prisma.ride.findMany({
    where: Object.keys(dbWhere).length ? dbWhere : undefined,
    include: {
      registrations: {
        select: { userId: true, approvalStatus: true },
      },
      participations: { select: { droppedOut: true } },
    },
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rides.length > limit;
  const page = hasMore ? rides.slice(0, limit) : rides;

  let items = page.map((r) => {
    const myReg = r.registrations.find((reg) => reg.userId === auth.user.id);
    return {
      id: r.id,
      title: r.title,
      rideNumber: r.rideNumber,
      type: r.type,
      status: computeRideStatus(r.startDate, r.endDate, r.status),
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      startLocation: r.startLocation,
      endLocation: r.endLocation,
      distanceKm: r.distanceKm,
      difficulty: r.difficulty,
      posterUrl: r.posterUrl,
      fee: r.fee,
      maxRiders: r.maxRiders,
      registeredRiders:
        r.registrations.filter((reg) => reg.approvalStatus === "confirmed").length ||
        r.participations.filter((p) => !p.droppedOut).length,
      myRegistrationStatus: myReg?.approvalStatus ?? null,
    };
  });

  if (status && status !== "all") {
    items = items.filter((r) => r.status === status);
  }

  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;
  return apiOk({ items, nextCursor });
}
