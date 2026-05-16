import type { NextRequest } from "next/server";
import { runApi } from "@/lib/api/middleware";
import { getRide } from "@/lib/api/handlers/rides/get";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return runApi(
    request,
    { auth: "public", name: "rides.get" },
    (_input, ctx) => getRide(id, ctx)
  );
}
