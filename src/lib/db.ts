import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../../generated/prisma";

// In Node.js environments (local dev), use the ws package for WebSocket.
// On Vercel/Edge runtimes, the global WebSocket is available natively.
if (typeof globalThis.WebSocket === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    neonConfig.webSocketConstructor = require("ws");
  } catch {
    // ws not available — assume native WebSocket exists at runtime
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Strip channel_binding param — the Neon serverless driver uses HTTP/WebSocket,
// not the PostgreSQL wire protocol, so channel binding is unsupported and causes errors.
function stripChannelBinding(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    // If URL parsing fails, do a simple regex removal as fallback
    return url
      .replace(/[?&]channel_binding=[^&]*/g, "")
      .replace(/\?&/, "?")
      .replace(/\?$/, "");
  }
}

// Support both custom DATABASE_URL and Vercel-Neon integration env vars
function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "Database connection not configured. Please set DATABASE_URL in your Vercel project environment variables."
    );
  }
  return stripChannelBinding(url);
}

function createPrismaClient() {
  const connectionString = getDatabaseUrl();
  const pool = new Pool({ connectionString });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaNeon(pool as any);
  // Pass datasourceUrl so PrismaClient doesn't fall back to env("DATABASE_URL") from the schema
  return new PrismaClient({ adapter, datasourceUrl: connectionString });
}

// Lazy getter — defers initialization until first use so that missing env vars
// produce a catchable error inside API route handlers instead of crashing the
// module at import time.
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
