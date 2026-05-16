import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export { z };

export const IdSchema = z.string().min(1).openapi("Id", { description: "Stable identifier (cuid)" });
export const EmailSchema = z
  .string()
  .email()
  .transform((s) => s.toLowerCase().trim())
  .openapi("Email");
export const IsoDateSchema = z
  .string()
  .datetime({ offset: true })
  .openapi("IsoDate", { description: "ISO-8601 datetime with offset" });

export const CursorSchema = z.string().min(1).max(256).optional().openapi("Cursor");
export const PaginationQuerySchema = z
  .object({
    cursor: CursorSchema,
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ description: "Page size (1-100, default 20)" }),
  })
  .openapi("PaginationQuery");

export const PageInfoSchema = z
  .object({ nextCursor: z.string().nullable() })
  .openapi("PageInfo");

export const ErrorEnvelopeSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
    requestId: z.string(),
  })
  .openapi("ErrorEnvelope");

export function paginatedSchema<T extends z.ZodTypeAny>(item: T, name: string) {
  return z
    .object({
      data: z.array(item),
      pageInfo: PageInfoSchema,
    })
    .openapi(name);
}

export const SafeUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    isApproved: z.boolean(),
    avatar: z.string().nullable(),
    city: z.string().nullable(),
    totalKm: z.number(),
    ridesCompleted: z.number(),
    linkedRiderId: z.string().nullable(),
  })
  .openapi("SafeUser");
