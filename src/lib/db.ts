import { neonConfig } from "@neondatabase/serverless";
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

// Strip parameters unsupported by the Neon serverless driver (which uses
// HTTP/WebSocket, not the PostgreSQL wire protocol).
function cleanConnectionString(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    u.searchParams.delete("sslmode"); // Neon serverless always uses TLS natively
    return u.toString();
  } catch {
    return url
      .replace(/[?&]channel_binding=[^&]*/g, "")
      .replace(/[?&]sslmode=[^&]*/g, "")
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
  return cleanConnectionString(url);
}

function createPrismaClient() {
  const connectionString = getDatabaseUrl();
  // PrismaNeon expects a PoolConfig object — it creates its own Pool internally.
  // Do NOT pass a pre-built Pool instance (the previous code cast with `as any`
  // to hide this type mismatch, which caused silent connection failures).
  const adapter = new PrismaNeon({ connectionString });
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
