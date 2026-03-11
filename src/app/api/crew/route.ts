import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/crew - list crew members (superadmin + core_member) with avatar URLs
export async function GET() {
  try {
    const crewUsers = await prisma.user.findMany({
      where: {
        role: { in: ["superadmin", "core_member"] },
        // Exclude the T2W Official system account
        NOT: { email: { contains: "taleson2wheels.official", mode: "insensitive" } },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        linkedRiderId: true,
        riderProfile: {
          select: {
            id: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const crew = crewUsers.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      linkedRiderId: u.linkedRiderId || u.riderProfile?.id || null,
      avatarUrl: u.riderProfile?.avatarUrl || null,
    }));

    return NextResponse.json({ crew });
  } catch (error) {
    console.error("[T2W] Crew error:", error);
    return NextResponse.json({ error: "Failed to load crew" }, { status: 500 });
  }
}
