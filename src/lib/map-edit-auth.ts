import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getRolePermissions } from "@/lib/role-permissions";

// Shared gate for every map-edit endpoint. Returns either an authoritative
// NextResponse (error) or the resolved user + session.
//
// Access rules:
//  - super-admin: always allowed
//  - core member: allowed when role_permissions.core_member.canEditRideMap
//    is true (default true; super-admin can toggle in Admin → Permissions)
//  - everyone else: 403
export async function requireMapEditor(rideId: string): Promise<
  | { ok: false; res: NextResponse }
  | {
      ok: true;
      user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
      session: NonNullable<
        Awaited<ReturnType<typeof prisma.liveRideSession.findUnique>>
      >;
    }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const isSuperAdmin = user.role === "superadmin";
  let allowed = isSuperAdmin;
  if (!allowed && user.role === "core_member") {
    const perms = await getRolePermissions();
    allowed = perms.core_member.canEditRideMap;
  }
  if (!allowed) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const session = await prisma.liveRideSession.findUnique({
    where: { rideId },
  });
  if (!session) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "No live session for this ride" },
        { status: 404 }
      ),
    };
  }
  if (session.status === "live") {
    return {
      ok: false,
      res: NextResponse.json(
        {
          error:
            "Cannot edit map data while the ride is live. Pause or end the ride first.",
        },
        { status: 409 }
      ),
    };
  }
  return { ok: true, user, session };
}

// Trim a JSON details blob to the 64 KB cap mandated by the plan.
const MAX_AUDIT_DETAILS = 64 * 1024;
export function clipAuditDetails(details: unknown): string | null {
  if (details == null) return null;
  const json = JSON.stringify(details);
  if (json.length <= MAX_AUDIT_DETAILS) return json;
  return JSON.stringify({ truncated: true, sample: json.slice(0, 1024) });
}
