import { z, PaginationQuerySchema, paginatedSchema } from "./common";

export const RideStatusSchema = z
  .enum(["upcoming", "ongoing", "completed", "cancelled"])
  .openapi("RideStatus");

export const RideTypeSchema = z
  .enum(["day", "weekend", "multi-day", "expedition"])
  .openapi("RideType");

export const RideDifficultySchema = z
  .enum(["easy", "moderate", "challenging", "extreme"])
  .openapi("RideDifficulty");

export const RideSummarySchema = z
  .object({
    id: z.string(),
    title: z.string(),
    rideNumber: z.string(),
    type: RideTypeSchema,
    status: RideStatusSchema,
    startDate: z.string(),
    endDate: z.string(),
    startLocation: z.string(),
    endLocation: z.string(),
    distanceKm: z.number(),
    difficulty: RideDifficultySchema,
    maxRiders: z.number().int(),
    fee: z.number(),
    posterUrl: z.string().nullable(),
    leadRider: z.string(),
    sweepRider: z.string(),
    detailsVisible: z.boolean(),
  })
  .openapi("RideSummary");

export const RideDetailSchema = RideSummarySchema.extend({
  startLocationUrl: z.string().nullable(),
  endLocationUrl: z.string().nullable(),
  description: z.string(),
  highlights: z.array(z.string()),
  route: z.array(z.string()),
  extraBedSlots: z.number().int(),
  extraBedFee: z.number(),
  organisedBy: z.string().nullable(),
  accountsBy: z.string().nullable(),
  meetupTime: z.string().nullable(),
  rideStartTime: z.string().nullable(),
  startingPoint: z.string().nullable(),
  riders: z.array(z.string()),
  registrationCount: z.number().int(),
}).openapi("RideDetail");

export const RidesListQuerySchema = PaginationQuerySchema.extend({
  status: RideStatusSchema.optional(),
  type: RideTypeSchema.optional(),
}).openapi("RidesListQuery");

export const RidesListResponseSchema = paginatedSchema(RideSummarySchema, "RidesListResponse");

export const RideDetailResponseSchema = z
  .object({ ride: RideDetailSchema })
  .openapi("RideDetailResponse");

export const RideIdParamSchema = z.object({ id: z.string() }).openapi("RideIdParam");
