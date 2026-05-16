import { z } from "zod";
import { prisma } from "@/lib/db";
import { computeRideStatus } from "@/lib/ride-status";
import {
  RidesListQuerySchema,
  RidesListResponseSchema,
  type RideStatusSchema as _RideStatusSchema,
} from "../../schemas/rides";
import { registerRoute } from "../../openapi/routes";
import { ErrorEnvelopeSchema } from "../../schemas/common";
import type { Ctx } from "../../middleware";

registerRoute({
  method: "get",
  path: "/api/v1/rides",
  summary: "List rides (cursor-paginated)",
  tags: ["rides"],
  request: { query: RidesListQuerySchema },
  responses: {
    200: { description: "Paginated ride summaries", schema: RidesListResponseSchema },
    400: { description: "Validation error", schema: ErrorEnvelopeSchema },
  },
});

export type RidesListQuery = z.infer<typeof RidesListQuerySchema>;
export type RidesListResponse = z.infer<typeof RidesListResponseSchema>;

function decodeCursor(cursor: string | undefined): Date | null {
  if (!cursor) return null;
  try {
    const buf = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = new Date(buf);
    if (isNaN(parsed.getTime())) return null;
    return parsed;
  } catch {
    return null;
  }
}

function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString(), "utf8").toString("base64url");
}

export async function listRides(input: RidesListQuery, _ctx: Ctx): Promise<RidesListResponse> {
  const dbWhere: Record<string, unknown> = {};
  if (input.status === "cancelled" || input.status === "completed" || input.status === "ongoing") {
    dbWhere.status = input.status;
  }
  if (input.type) dbWhere.type = input.type;

  const before = decodeCursor(input.cursor);
  if (before) dbWhere.startDate = { lt: before };

  // Fetch one extra to determine if there's a next page.
  const rides = await prisma.ride.findMany({
    where: Object.keys(dbWhere).length ? dbWhere : undefined,
    orderBy: { startDate: "desc" },
    take: input.limit + 1,
  });

  const hasMore = rides.length > input.limit;
  const page = hasMore ? rides.slice(0, input.limit) : rides;
  const nextCursor = hasMore ? encodeCursor(page[page.length - 1].startDate) : null;

  return {
    data: page.map((r) => ({
      id: r.id,
      title: r.title,
      rideNumber: r.rideNumber,
      type: r.type as RidesListResponse["data"][number]["type"],
      status: computeRideStatus(r.startDate, r.endDate, r.status) as RidesListResponse["data"][number]["status"],
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      startLocation: r.startLocation,
      endLocation: r.endLocation,
      distanceKm: r.distanceKm,
      difficulty: r.difficulty as RidesListResponse["data"][number]["difficulty"],
      maxRiders: r.maxRiders,
      fee: r.fee,
      posterUrl: r.posterUrl,
      leadRider: r.leadRider,
      sweepRider: r.sweepRider,
      detailsVisible: r.detailsVisible,
    })),
    pageInfo: { nextCursor },
  };
}
