import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/users/bulk-delete - delete multiple users (superadmin only)
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "Only super admins can delete users" }, { status: 403 });
    }

    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    // Protect built-in superadmin accounts
    const protectedEmails = ["roshan.manuel@gmail.com", "taleson2wheels.official@gmail.com"];
    const protectedUsers = await prisma.user.findMany({
      where: { id: { in: ids }, email: { in: protectedEmails } },
      select: { id: true },
    });
    const protectedIds = new Set(protectedUsers.map((u) => u.id));
    const safeIds = ids.filter((id: string) => !protectedIds.has(id));

    const result = await prisma.user.deleteMany({ where: { id: { in: safeIds } } });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      skippedProtected: protectedIds.size,
    });
  } catch (error) {
    console.error("[T2W] Bulk delete error:", error);
    return NextResponse.json({ error: "Failed to delete users" }, { status: 500 });
  }
}
