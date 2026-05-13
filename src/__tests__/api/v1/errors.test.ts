import { describe, it, expect } from "vitest";
import { apiError, apiOk } from "@/lib/api/v1/errors";

describe("api/v1 envelope helpers", () => {
  it("apiOk returns 200 by default with the payload as the body", async () => {
    const res = apiOk({ hello: "world" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hello: "world" });
  });

  it("apiOk honours an explicit status", async () => {
    const res = apiOk({ id: "x" }, { status: 201 });
    expect(res.status).toBe(201);
  });

  it("apiError maps codes to known statuses", async () => {
    const bad = apiError("BAD_REQUEST", "nope");
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({
      error: { code: "BAD_REQUEST", message: "nope" },
    });

    const forbidden = apiError("FORBIDDEN", "no");
    expect(forbidden.status).toBe(403);

    const conflict = apiError("RIDE_FULL", "full");
    expect(conflict.status).toBe(409);
  });

  it("apiError includes details when provided", async () => {
    const res = apiError("UNPROCESSABLE", "bad", { field: "email" });
    expect(await res.json()).toEqual({
      error: { code: "UNPROCESSABLE", message: "bad", details: { field: "email" } },
    });
  });
});
