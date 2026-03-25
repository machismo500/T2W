import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/riders/check-links
 * Reports all Users with no linked RiderProfile, and all RiderProfiles with no linked User.
 * Also identifies potential matches by email or name that could be auto-linked.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "superadmin" && user.role !== "core_member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find all Users without a linked RiderProfile
    const unlinkedUsers = await prisma.user.findMany({
      where: { linkedRiderId: null },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });

    // Find all RiderProfiles with no linked Users
    const unlinkedProfiles = await prisma.riderProfile.findMany({
      where: { mergedIntoId: null, linkedUsers: { none: {} } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });

    // Build lookup maps for potential matches
    const profilesByEmail = new Map<string, { id: string; name: string; email: string }>();
    for (const p of unlinkedProfiles) {
      profilesByEmail.set(p.email.toLowerCase().trim(), p);
    }
    const profilesByName = new Map<string, { id: string; name: string; email: string }>();
    for (const p of unlinkedProfiles) {
      profilesByName.set(p.name.toLowerCase().trim(), p);
    }

    // Categorize unlinked users
    const matchableByEmail: Array<{ user: typeof unlinkedUsers[0]; profile: { id: string; name: string; email: string } }> = [];
    const matchableByName: Array<{ user: typeof unlinkedUsers[0]; profile: { id: string; name: string; email: string } }> = [];
    const noMatch: typeof unlinkedUsers = [];

    for (const u of unlinkedUsers) {
      const emailMatch = profilesByEmail.get(u.email.toLowerCase().trim());
      if (emailMatch) {
        matchableByEmail.push({ user: u, profile: emailMatch });
      } else {
        const nameMatch = profilesByName.get(u.name.toLowerCase().trim());
        if (nameMatch) {
          matchableByName.push({ user: u, profile: nameMatch });
        } else {
          noMatch.push(u);
        }
      }
    }

    // Count totals
    const totalUsers = await prisma.user.count();
    const totalProfiles = await prisma.riderProfile.count({ where: { mergedIntoId: null } });
    const linkedUsers = totalUsers - unlinkedUsers.length;

    return NextResponse.json({
      summary: {
        totalUsers,
        totalProfiles,
        linkedUsers,
        unlinkedUsers: unlinkedUsers.length,
        unlinkedProfiles: unlinkedProfiles.length,
        matchableByEmail: matchableByEmail.length,
        matchableByName: matchableByName.length,
        noMatch: noMatch.length,
      },
      matchableByEmail,
      matchableByName,
      noMatch,
      unlinkedProfiles: unlinkedProfiles.filter(
        (p) => !matchableByEmail.some((m) => m.profile.id === p.id) &&
               !matchableByName.some((m) => m.profile.id === p.id)
      ),
    });
  } catch (error) {
    console.error("[T2W] Check links error:", error);
    return NextResponse.json({ error: "Failed to check links" }, { status: 500 });
  }
}

/**
 * POST /api/riders/check-links
 * Auto-links all unlinked Users to matching RiderProfiles by email,
 * and optionally by name (if ?includeNameMatches=true).
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const includeNameMatches = url.searchParams.get("includeNameMatches") === "true";

    // Find all unlinked Users
    const unlinkedUsers = await prisma.user.findMany({
      where: { linkedRiderId: null },
      select: { id: true, name: true, email: true },
    });

    // Find all unlinked RiderProfiles
    const unlinkedProfiles = await prisma.riderProfile.findMany({
      where: { mergedIntoId: null, linkedUsers: { none: {} } },
      select: { id: true, name: true, email: true },
    });

    const profilesByEmail = new Map<string, string>();
    const profilesByName = new Map<string, string>();
    for (const p of unlinkedProfiles) {
      profilesByEmail.set(p.email.toLowerCase().trim(), p.id);
      profilesByName.set(p.name.toLowerCase().trim(), p.id);
    }

    let linkedByEmail = 0;
    let linkedByName = 0;
    const linked: Array<{ userName: string; userEmail: string; matchType: string }> = [];

    for (const u of unlinkedUsers) {
      const emailKey = u.email.toLowerCase().trim();
      const nameKey = u.name.toLowerCase().trim();

      let profileId = profilesByEmail.get(emailKey);
      let matchType = "email";

      if (!profileId && includeNameMatches) {
        profileId = profilesByName.get(nameKey);
        matchType = "name";
      }

      if (profileId) {
        await prisma.user.update({
          where: { id: u.id },
          data: { linkedRiderId: profileId },
        });

        // Sync stats
        const participations = await prisma.rideParticipation.findMany({
          where: { riderProfileId: profileId },
          include: { ride: { select: { distanceKm: true } } },
        });
        const totalKm = participations.reduce((sum, p) => sum + p.ride.distanceKm, 0);
        await prisma.user.update({
          where: { id: u.id },
          data: { totalKm, ridesCompleted: participations.length },
        });

        if (matchType === "email") linkedByEmail++;
        else linkedByName++;
        linked.push({ userName: u.name, userEmail: u.email, matchType });

        // Remove from maps so we don't double-link
        profilesByEmail.delete(emailKey);
        profilesByName.delete(nameKey);
      }
    }

    return NextResponse.json({
      success: true,
      linkedByEmail,
      linkedByName,
      totalLinked: linkedByEmail + linkedByName,
      linked,
    });
  } catch (error) {
    console.error("[T2W] Auto-link error:", error);
    return NextResponse.json({ error: "Failed to auto-link profiles" }, { status: 500 });
  }
}
