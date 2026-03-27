import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/upload - upload an image file (avatar, poster, etc.)
// Stores as base64 data URL in the database for cross-device persistence.
// Images should be compressed on the client side before uploading.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null; // "avatar" | "poster" | "motorcycle"
    const targetId = formData.get("targetId") as string | null; // riderId or rideId
    // Accept pre-compressed base64 data URL from client (preferred for avatars)
    const dataUrl = formData.get("dataUrl") as string | null;

    // Either a file or a pre-compressed dataUrl must be provided
    if (!file && !dataUrl) {
      return NextResponse.json({ error: "No file or dataUrl provided" }, { status: 400 });
    }

    let url: string;

    if (dataUrl) {
      // Validate dataUrl format
      if (!dataUrl.startsWith("data:image/")) {
        return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
      }
      // 2MB limit: base64 overhead is ~4/3, so 2MB binary ≈ 2.73MB string
      if (dataUrl.length > 2 * 1024 * 1024 * 1.4) {
        return NextResponse.json({ error: "Image must be under 2MB" }, { status: 400 });
      }
      // Client already compressed and sent as data URL
      url = dataUrl;
    } else if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
      }

      // Validate file size (5MB max raw, but should be pre-compressed)
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString("base64");
      url = `data:${file.type};base64,${base64}`;
    } else {
      return NextResponse.json({ error: "No image data" }, { status: 400 });
    }

    // For avatar uploads, MUST persist to DB — fail loudly if we can't
    if (type === "avatar" && targetId) {
      const canEdit =
        user.role === "superadmin" ||
        user.role === "core_member" ||
        user.linkedRiderId === targetId ||
        user.id === targetId;

      if (!canEdit) {
        return NextResponse.json(
          { error: "You don't have permission to update this profile picture" },
          { status: 403 }
        );
      }

      await prisma.riderProfile.update({
        where: { id: targetId },
        data: { avatarUrl: url },
      });

      return NextResponse.json({ url, persisted: true });
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[T2W] Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
