import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/rides/[id]/register - register for a ride
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rideId } = await params;
    const data = await req.json();

    // Verify ride exists
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: { registrations: { select: { id: true } } },
    });

    if (!ride) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }

    if (ride.status !== "upcoming") {
      return NextResponse.json(
        { error: "Registration is only open for upcoming rides" },
        { status: 400 }
      );
    }

    // Check capacity
    if (ride.registrations.length >= ride.maxRiders) {
      return NextResponse.json(
        { error: "This ride is full — no spots available" },
        { status: 400 }
      );
    }

    // Generate confirmation code
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const confirmationCode = `T2W-${rideId.toUpperCase().slice(0, 10)}-${randomPart}`;

    const registration = await prisma.rideRegistration.create({
      data: {
        userId: user.id,
        rideId,
        riderName: String(data.riderName || user.name || ""),
        address: String(data.address || ""),
        email: String(data.email || user.email || ""),
        phone: String(data.phone || ""),
        emergencyContactName: String(data.emergencyContactName || ""),
        emergencyContactPhone: String(data.emergencyContactPhone || ""),
        bloodGroup: String(data.bloodGroup || ""),
        referredBy: String(data.referredBy || ""),
        foodPreference: String(data.foodPreference || ""),
        ridingType: String(data.ridingType || ""),
        vehicleModel: String(data.vehicleModel || ""),
        vehicleRegNumber: String(data.vehicleRegNumber || ""),
        tshirtSize: String(data.tshirtSize || ""),
        agreedCancellationTerms: Boolean(data.agreedCancellationTerms),
        agreedIndemnity: Boolean(data.agreedIndemnity),
        paymentScreenshot: String(data.paymentScreenshot || ""),
        upiTransactionId: String(data.upiTransactionId || ""),
        confirmationCode,
      },
    });

    return NextResponse.json({
      registration: {
        id: registration.id,
        confirmationCode: registration.confirmationCode,
        registeredAt: registration.registeredAt.toISOString(),
      },
      confirmationCode,
    });
  } catch (error: unknown) {
    // Handle duplicate registration (unique constraint on userId + rideId)
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You are already registered for this ride" },
        { status: 409 }
      );
    }
    console.error("[T2W] Registration error:", error);
    return NextResponse.json(
      { error: "Failed to register for ride" },
      { status: 500 }
    );
  }
}
