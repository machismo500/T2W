// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAuthedRequest, createNextRequest, parseResponse } from "@/__tests__/helpers";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    riderProfile: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { issueAccessToken } from "@/lib/api/auth/tokens";
import { createToken } from "@/lib/auth";
import { GET } from "@/app/api/v1/auth/me/route";

const mockUser = {
  id: "user-abc",
  name: "Test Rider",
  email: "rider@t2w.com",
  role: "rider",
  isApproved: true,
  avatar: null,
  city: null,
  totalKm: 0,
  ridesCompleted: 0,
  linkedRiderId: null,
};

describe("GET /api/v1/auth/me (dual-mode auth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  });

  it("returns 401 envelope when no auth is presented", async () => {
    const req = createNextRequest("http://localhost/api/v1/auth/me");
    const { status, data } = await parseResponse(await GET(req));
    expect(status).toBe(401);
    expect(data.error.code).toBe("UNAUTHORIZED");
    expect(data.requestId).toBeTypeOf("string");
  });

  it("authenticates via Authorization: Bearer", async () => {
    const { token } = await issueAccessToken("user-abc");
    const req = createAuthedRequest(
      "http://localhost/api/v1/auth/me",
      { mode: "bearer", token }
    );
    const { status, data } = await parseResponse(await GET(req));
    expect(status).toBe(200);
    expect(data.user).toMatchObject({ id: "user-abc", email: "rider@t2w.com" });
  });

  it("falls back to the t2w-token cookie", async () => {
    const cookieToken = await createToken("user-abc");
    const req = createAuthedRequest(
      "http://localhost/api/v1/auth/me",
      { mode: "cookie", token: cookieToken }
    );
    const { status, data } = await parseResponse(await GET(req));
    expect(status).toBe(200);
    expect(data.user.id).toBe("user-abc");
  });

  it("rejects a tampered bearer token", async () => {
    const { token } = await issueAccessToken("user-abc");
    const req = createAuthedRequest(
      "http://localhost/api/v1/auth/me",
      { mode: "bearer", token: token.slice(0, -2) + "xx" }
    );
    const { status } = await parseResponse(await GET(req));
    expect(status).toBe(401);
  });
});
