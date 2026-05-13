import { apiOk } from "@/lib/api/v1/errors";

export async function GET() {
  return apiOk({ status: "ok", apiVersion: "v1" });
}
