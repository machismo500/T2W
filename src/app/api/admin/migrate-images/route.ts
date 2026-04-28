import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { uploadImage } from "@/lib/blob-upload";

// Per-Vercel-function execution budget. Hobby = 60 s, Pro = 300 s. We cap a
// single batch well under the Hobby ceiling so the same code path works on
// either plan. Net throughput comes from looping the endpoint client-side.
export const maxDuration = 50;

/**
 * Admin-only base64 → Vercel Blob migration runner.
 *
 * Replaces the local CLI step that needed `vercel env pull` + `tsx`. The
 * server already has BLOB_READ_WRITE_TOKEN and DATABASE_URL injected, so a
 * superadmin can drive the migration entirely from the browser.
 *
 *   GET  /api/admin/migrate-images          → { counts, blobReady, total }
 *   POST /api/admin/migrate-images          → run a small batch, return progress
 *     body: { batch?: number }   default 10, max 50
 *
 * Both endpoints require `role === "superadmin"`. The migration is idempotent
 * (filters by `startsWith: "data:"`), so the UI can poll POST until counts
 * hit zero.
 */

type Counts = {
  user: number;
  riderProfile: number;
  motorcycle: number;
  ride: number;
  blogPost: number;
  ridePost: number;
};

async function loadCounts(): Promise<Counts> {
  const [user, riderProfile, motorcycle, ride, blogPost, ridePost] = await Promise.all([
    prisma.user.count({ where: { avatar: { startsWith: "data:" } } }),
    prisma.riderProfile.count({ where: { avatarUrl: { startsWith: "data:" } } }),
    prisma.motorcycle.count({ where: { imageUrl: { startsWith: "data:" } } }),
    prisma.ride.count({ where: { posterUrl: { startsWith: "data:" } } }),
    prisma.blogPost.count({ where: { coverImage: { startsWith: "data:" } } }),
    prisma.ridePost.count({ where: { images: { contains: "data:image/" } } }),
  ]);
  return { user, riderProfile, motorcycle, ride, blogPost, ridePost };
}

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated", status: 401 as const };
  if (user.role !== "superadmin") {
    return { error: "Superadmin only", status: 403 as const };
  }
  return { user };
}

export async function GET() {
  const auth = await requireSuperadmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const counts = await loadCounts();
  const total =
    counts.user +
    counts.riderProfile +
    counts.motorcycle +
    counts.ride +
    counts.blogPost +
    counts.ridePost;
  return NextResponse.json({
    counts,
    total,
    blobReady: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    done: total === 0,
  });
}

interface BatchResult {
  migrated: { table: string; id: string; url: string }[];
  failed: { table: string; id: string; error: string }[];
}

/**
 * Migrate a single base64 column on a row. Skips silently if value isn't
 * a `data:` URL (defensive — the WHERE clause should already exclude these).
 */
async function migrateOne(
  table: string,
  id: string,
  value: string,
  scopeType: string,
  persist: (url: string) => Promise<unknown>,
  result: BatchResult
) {
  if (!value.startsWith("data:image/")) return;
  try {
    const { url } = await uploadImage(value, { type: scopeType, scope: id });
    await persist(url);
    result.migrated.push({ table, id, url });
  } catch (err) {
    result.failed.push({ table, id, error: (err as Error).message });
  }
}

/**
 * Process one batch of pending rows. We greedily walk the column list in a
 * deterministic order — User → RiderProfile → Motorcycle → Ride → BlogPost →
 * RidePost — until we exhaust the per-call budget. The order doesn't matter
 * for correctness; it just keeps the UI's "what just moved" log readable.
 */
async function runBatch(limit: number): Promise<BatchResult> {
  const result: BatchResult = { migrated: [], failed: [] };
  let remaining = limit;

  if (remaining > 0) {
    const rows = await prisma.user.findMany({
      where: { avatar: { startsWith: "data:" } },
      select: { id: true, avatar: true },
      take: remaining,
    });
    for (const row of rows) {
      if (!row.avatar) continue;
      await migrateOne(
        "User.avatar",
        row.id,
        row.avatar,
        "avatar",
        (url) => prisma.user.update({ where: { id: row.id }, data: { avatar: url } }),
        result
      );
      remaining--;
    }
  }

  if (remaining > 0) {
    const rows = await prisma.riderProfile.findMany({
      where: { avatarUrl: { startsWith: "data:" } },
      select: { id: true, avatarUrl: true },
      take: remaining,
    });
    for (const row of rows) {
      if (!row.avatarUrl) continue;
      await migrateOne(
        "RiderProfile.avatarUrl",
        row.id,
        row.avatarUrl,
        "avatar",
        (url) =>
          prisma.riderProfile.update({ where: { id: row.id }, data: { avatarUrl: url } }),
        result
      );
      remaining--;
    }
  }

  if (remaining > 0) {
    const rows = await prisma.motorcycle.findMany({
      where: { imageUrl: { startsWith: "data:" } },
      select: { id: true, imageUrl: true },
      take: remaining,
    });
    for (const row of rows) {
      if (!row.imageUrl) continue;
      await migrateOne(
        "Motorcycle.imageUrl",
        row.id,
        row.imageUrl,
        "motorcycle",
        (url) =>
          prisma.motorcycle.update({ where: { id: row.id }, data: { imageUrl: url } }),
        result
      );
      remaining--;
    }
  }

  if (remaining > 0) {
    const rows = await prisma.ride.findMany({
      where: { posterUrl: { startsWith: "data:" } },
      select: { id: true, posterUrl: true },
      take: remaining,
    });
    for (const row of rows) {
      if (!row.posterUrl) continue;
      await migrateOne(
        "Ride.posterUrl",
        row.id,
        row.posterUrl,
        "poster",
        (url) =>
          prisma.ride.update({ where: { id: row.id }, data: { posterUrl: url } }),
        result
      );
      remaining--;
    }
  }

  if (remaining > 0) {
    const rows = await prisma.blogPost.findMany({
      where: { coverImage: { startsWith: "data:" } },
      select: { id: true, coverImage: true },
      take: remaining,
    });
    for (const row of rows) {
      if (!row.coverImage) continue;
      await migrateOne(
        "BlogPost.coverImage",
        row.id,
        row.coverImage,
        "blog",
        (url) =>
          prisma.blogPost.update({ where: { id: row.id }, data: { coverImage: url } }),
        result
      );
      remaining--;
    }
  }

  // RidePost.images is a JSON array of URLs. Each row may contain multiple
  // base64 entries; each successful element conversion counts toward the
  // batch budget so we don't blow our function-time ceiling on a single fat
  // post. Persist after the row's array is fully (re)written.
  if (remaining > 0) {
    const rows = await prisma.ridePost.findMany({
      where: { images: { contains: "data:image/" } },
      select: { id: true, images: true },
      take: remaining,
    });
    for (const row of rows) {
      if (remaining <= 0) break;
      let parsed: string[];
      try {
        parsed = JSON.parse(row.images || "[]");
      } catch {
        result.failed.push({
          table: "RidePost.images",
          id: row.id,
          error: "Malformed images JSON",
        });
        continue;
      }
      const replaced: string[] = [];
      let touched = false;
      for (const img of parsed) {
        if (!img.startsWith("data:image/") || remaining <= 0) {
          replaced.push(img);
          continue;
        }
        try {
          const { url } = await uploadImage(img, {
            type: "ride-post",
            scope: row.id,
          });
          replaced.push(url);
          touched = true;
          remaining--;
        } catch (err) {
          replaced.push(img);
          result.failed.push({
            table: "RidePost.images",
            id: row.id,
            error: (err as Error).message,
          });
        }
      }
      if (touched) {
        try {
          await prisma.ridePost.update({
            where: { id: row.id },
            data: { images: JSON.stringify(replaced) },
          });
          // Report once per row, regardless of how many images flipped.
          result.migrated.push({
            table: "RidePost.images",
            id: row.id,
            url: `(${replaced.filter((u) => u.startsWith("https://")).length} urls)`,
          });
        } catch (err) {
          result.failed.push({
            table: "RidePost.images",
            id: row.id,
            error: `Persist failed: ${(err as Error).message}`,
          });
        }
      }
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN not configured on this deployment" },
      { status: 500 }
    );
  }

  let body: { batch?: number } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — fall through to defaults.
  }
  const requested = Number(body.batch ?? 10);
  const batch = Math.max(1, Math.min(50, Number.isFinite(requested) ? requested : 10));

  const startedAt = Date.now();
  const result = await runBatch(batch);
  const counts = await loadCounts();
  const total =
    counts.user +
    counts.riderProfile +
    counts.motorcycle +
    counts.ride +
    counts.blogPost +
    counts.ridePost;

  return NextResponse.json({
    batch,
    elapsedMs: Date.now() - startedAt,
    migrated: result.migrated,
    failed: result.failed,
    counts,
    total,
    done: total === 0,
  });
}
