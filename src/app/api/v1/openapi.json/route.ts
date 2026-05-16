import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 300;

export async function GET() {
  try {
    const path = join(process.cwd(), "openapi", "openapi.json");
    const raw = await readFile(path, "utf8");
    return new NextResponse(raw, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "OpenAPI spec not generated yet. Run `npm run openapi:generate`." } },
      { status: 404 }
    );
  }
}
