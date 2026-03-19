import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PATCH /api/rides/[id]/registrations/[regId] - approve or reject a registration
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; regId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "superadmin" && user.role !== "core_member")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rideId, regId } = await params;
    const { approvalStatus } = await req.json();

    if (!["confirmed", "rejected"].includes(approvalStatus)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'confirmed' or 'rejected'." },
        { status: 400 }
      );
    }

    const registration = await prisma.rideRegistration.findFirst({
      where: { id: regId, rideId },
    });

    if (!registration) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.rideRegistration.update({
      where: { id: regId },
      data: { approvalStatus },
    });

    return NextResponse.json({
      registration: {
        id: updated.id,
        approvalStatus: updated.approvalStatus,
      },
    });
  } catch (error) {
    console.error("[T2W] Registration approval error:", error);
    return NextResponse.json(
      { error: "Failed to update registration" },
      { status: 500 }
    );
  }
}
