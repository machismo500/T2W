import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyMany } from "@/lib/push/dispatch";

// POST /api/users/bulk-approve - approve multiple pending users at once
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !["superadmin", "core_member"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ids } = await req.json();

    const where: { isApproved: false; id?: { in: string[] } } = { isApproved: false };
    if (Array.isArray(ids) && ids.length > 0) {
      where.id = { in: ids };
    }

    // Read the target ids *before* the update so we know who to notify.
    const targets = await prisma.user.findMany({ where, select: { id: true } });
    const result = await prisma.user.updateMany({ where, data: { isApproved: true } });

    if (targets.length > 0) {
      after(() =>
        notifyMany(
          targets.map((u) => u.id),
          {
            type: "success",
            title: "You're in!",
            message:
              "Your T2W account has been approved. Welcome to the brotherhood — ride safe.",
            data: { kind: "account_approved" },
          },
        ).catch((err) => console.warn("[T2W] bulk-approve push failed:", err)),
      );
    }

    return NextResponse.json({ success: true, approvedCount: result.count });
  } catch (error) {
    console.error("[T2W] Bulk approve error:", error);
    return NextResponse.json({ error: "Failed to approve users" }, { status: 500 });
  }
}
