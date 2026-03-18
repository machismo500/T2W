import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/activity-log - list activity log entries (admin only)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "superadmin" && user.role !== "core_member")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const entries = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id,
        action: e.action,
        performedBy: e.performedBy,
        performedByName: e.performedByName,
        targetId: e.targetId,
        targetName: e.targetName,
        details: e.details,
        rollbackData: e.rollbackData ? JSON.parse(e.rollbackData) : undefined,
        timestamp: e.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[T2W] Activity log GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity log" },
      { status: 500 }
    );
  }
}

// POST /api/activity-log - add an entry
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "superadmin" && user.role !== "core_member")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await req.json();

    const entry = await prisma.activityLog.create({
      data: {
        action: String(data.action),
        performedBy: String(data.performedBy || user.id),
        performedByName: String(data.performedByName || user.name),
        targetId: String(data.targetId || ""),
        targetName: String(data.targetName || ""),
        details: data.details || null,
        rollbackData: data.rollbackData
          ? JSON.stringify(data.rollbackData)
          : null,
      },
    });

    return NextResponse.json({
      entry: {
        id: entry.id,
        action: entry.action,
        timestamp: entry.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[T2W] Activity log POST error:", error);
    return NextResponse.json(
      { error: "Failed to add activity log entry" },
      { status: 500 }
    );
  }
}
