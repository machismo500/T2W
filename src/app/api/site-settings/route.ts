import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/site-settings?key=xxx - get a setting by key
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Key required" }, { status: 400 });
    }

    const setting = await prisma.siteSettings.findUnique({
      where: { key },
    });

    return NextResponse.json({
      value: setting ? JSON.parse(setting.value) : null,
    });
  } catch (error) {
    console.error("[T2W] Site settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch setting" },
      { status: 500 }
    );
  }
}

// PUT /api/site-settings - upsert a setting
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "superadmin" && user.role !== "core_member")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { key, value } = await req.json();

    if (!key) {
      return NextResponse.json({ error: "Key required" }, { status: 400 });
    }

    await prisma.siteSettings.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[T2W] Site settings PUT error:", error);
    return NextResponse.json(
      { error: "Failed to save setting" },
      { status: 500 }
    );
  }
}
