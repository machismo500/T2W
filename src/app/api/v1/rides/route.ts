import { withApi } from "@/lib/api/middleware";
import { RidesListQuerySchema } from "@/lib/api/schemas/rides";
import { listRides } from "@/lib/api/handlers/rides/list";

export const GET = withApi(
  { schema: RidesListQuerySchema, auth: "public", source: "query", name: "rides.list" },
  listRides
);
