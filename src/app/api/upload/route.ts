import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

// POST /api/upload - upload an image file (avatar, motorcycle photo, etc.)
// Returns a public URL path that can be stored in the database
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null; // "avatar" | "motorcycle"
    const targetId = formData.get("targetId") as string | null; // riderId or motorcycleId

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const hash = crypto.randomBytes(8).toString("hex");
    const filename = `${type || "img"}-${hash}.${ext}`;

    // Save to public/uploads directory
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(path.join(uploadDir, filename), buffer);

    const url = `/uploads/${filename}`;

    // If this is an avatar upload, update the RiderProfile in the database
    if (type === "avatar" && targetId) {
      // Verify permission: superadmin or own profile
      const canEdit =
        user.role === "superadmin" ||
        user.linkedRiderId === targetId ||
        user.id === targetId;

      if (canEdit) {
        await prisma.riderProfile.update({
          where: { id: targetId },
          data: { avatarUrl: url },
        });
      }
    }

    return NextResponse.json({ url, filename });
  } catch (error) {
    console.error("[T2W] Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
