import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/upload/avatar-sync - migrate a localStorage avatar to the database
// This is called automatically when a rider profile is viewed and has an avatar
// only in localStorage (not yet persisted to DB)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { riderId, avatarDataUrl } = await req.json();

    if (!riderId || !avatarDataUrl) {
      return NextResponse.json({ error: "riderId and avatarDataUrl are required" }, { status: 400 });
    }

    // Only allow syncing if user owns the profile or is superadmin
    if (user.role !== "superadmin" && user.linkedRiderId !== riderId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if rider already has an avatarUrl in DB
    const profile = await prisma.riderProfile.findUnique({
      where: { id: riderId },
      select: { avatarUrl: true },
    });

    if (profile?.avatarUrl) {
      // Already has an avatar in DB, skip
      return NextResponse.json({ url: profile.avatarUrl, skipped: true });
    }

    // Store the base64 data URL directly in the database
    await prisma.riderProfile.update({
      where: { id: riderId },
      data: { avatarUrl: avatarDataUrl },
    });

    return NextResponse.json({ url: avatarDataUrl, synced: true });
  } catch (error) {
    console.error("[T2W] Avatar sync error:", error);
    return NextResponse.json({ error: "Failed to sync avatar" }, { status: 500 });
  }
}
