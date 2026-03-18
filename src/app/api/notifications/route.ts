import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/notifications - list notifications for current user (+ global)
export async function GET() {
  try {
    const user = await getCurrentUser();
    const where = user
      ? { OR: [{ userId: user.id }, { userId: null }] }
      : { userId: null };

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { date: "desc" },
      take: 50,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("[notifications] GET error:", error);
    return NextResponse.json({ notifications: [] });
  }
}

// POST /api/notifications - create a notification (admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !["superadmin", "core_member"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { title, message, type, userId } = body;

    if (!title || !message) {
      return NextResponse.json({ error: "Title and message required" }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type: type || "info",
        userId: userId || null,
      },
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    console.error("[notifications] POST error:", error);
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
  }
}

// PUT /api/notifications - mark notification as read
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Notification ID required" }, { status: 400 });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[notifications] PUT error:", error);
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
  }
}
