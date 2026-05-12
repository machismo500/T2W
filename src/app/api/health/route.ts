import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // `?test_sentry=1` deliberately throws so the operator can verify Sentry
  // is wired correctly post-deploy. The error appears in the Sentry
  // dashboard within ~30s. Returns 500 to the caller as a side effect.
  if (req.nextUrl.searchParams.get("test_sentry") === "1") {
    throw new Error("Sentry verification trigger from /api/health");
  }
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? "set" : "missing",
      POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL ? "set" : "missing",
      POSTGRES_URL: process.env.POSTGRES_URL ? "set" : "missing",
      DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED ? "set" : "missing",
    },
  };

  try {
    const result = await prisma.$queryRaw`SELECT 1 as ok`;
    checks.database = { status: "connected", result };
  } catch (error: unknown) {
    const err = error as Error & { code?: string; meta?: unknown };
    checks.database = {
      status: "error",
      name: err.name,
      message: err.message,
      code: err.code,
      meta: err.meta,
    };
  }

  const isHealthy = (checks.database as { status: string }).status === "connected";
  return NextResponse.json(checks, { status: isHealthy ? 200 : 503 });
}
