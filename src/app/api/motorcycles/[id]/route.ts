import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PUT /api/motorcycles/[id] - update a motorcycle
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.motorcycle.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Motorcycle not found" }, { status: 404 });
    }

    const data = await req.json();
    const updateData: Record<string, unknown> = {};
    if (data.make !== undefined) updateData.make = String(data.make).trim();
    if (data.model !== undefined) updateData.model = String(data.model).trim();
    if (data.year !== undefined) updateData.year = Number(data.year);
    if (data.cc !== undefined) updateData.cc = Number(data.cc);
    if (data.color !== undefined) updateData.color = String(data.color).trim();
    if (data.nickname !== undefined) updateData.nickname = data.nickname ? String(data.nickname).trim() : null;

    const motorcycle = await prisma.motorcycle.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ motorcycle });
  } catch (error) {
    console.error("[T2W] Update motorcycle error:", error);
    return NextResponse.json({ error: "Failed to update motorcycle" }, { status: 500 });
  }
}

// DELETE /api/motorcycles/[id] - delete a motorcycle
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.motorcycle.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Motorcycle not found" }, { status: 404 });
    }

    await prisma.motorcycle.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[T2W] Delete motorcycle error:", error);
    return NextResponse.json({ error: "Failed to delete motorcycle" }, { status: 500 });
  }
}
