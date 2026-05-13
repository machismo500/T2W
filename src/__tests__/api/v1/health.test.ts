import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/v1/health/route";
import { parseResponse } from "@/__tests__/helpers";

describe("GET /api/v1/health", () => {
  it("returns ok with apiVersion v1", async () => {
    const { status, data } = await parseResponse(await GET());
    expect(status).toBe(200);
    expect(data).toEqual({ status: "ok", apiVersion: "v1" });
  });
});
