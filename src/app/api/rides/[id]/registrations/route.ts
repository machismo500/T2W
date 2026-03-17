import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/rides/[id]/registrations - list all registrations (admin only)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "superadmin" && user.role !== "core_member")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rideId } = await params;

    const registrations = await prisma.rideRegistration.findMany({
      where: { rideId },
      orderBy: { registeredAt: "asc" },
      select: {
        id: true,
        userId: true,
        riderName: true,
        address: true,
        email: true,
        phone: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        bloodGroup: true,
        referredBy: true,
        foodPreference: true,
        ridingType: true,
        vehicleModel: true,
        vehicleRegNumber: true,
        tshirtSize: true,
        agreedCancellationTerms: true,
        agreedIndemnity: true,
        upiTransactionId: true,
        paymentScreenshot: true,
        registeredAt: true,
        confirmationCode: true,
      },
    });

    return NextResponse.json({
      registrations: registrations.map((r) => ({
        ...r,
        registeredAt: r.registeredAt.toISOString(),
        paymentScreenshot: r.paymentScreenshot ? "Yes" : "No",
      })),
    });
  } catch (error) {
    console.error("[T2W] List registrations error:", error);
    return NextResponse.json(
      { error: "Failed to list registrations" },
      { status: 500 }
    );
  }
}
