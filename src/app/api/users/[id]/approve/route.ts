import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyUser } from "@/lib/push/dispatch";

// PUT /api/users/[id]/approve - approve a pending user
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    if (!currentUser || !["superadmin", "core_member"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.user.update({
      where: { id },
      data: { isApproved: true },
    });

    // Push + in-app notification fire-and-forget so HTTP latency stays tight.
    after(() =>
      notifyUser({
        userId: id,
        type: "success",
        title: "You're in!",
        message: "Your T2W account has been approved. Welcome to the brotherhood — ride safe.",
        data: { kind: "account_approved" },
      }).catch((err) => console.warn("[T2W] approve push failed:", err)),
    );

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("[T2W] User approve error:", error);
    return NextResponse.json({ error: "Failed to approve user" }, { status: 500 });
  }
}
