import { describe, it, expect } from "vitest";
import { buildApp } from "@/test/helpers";

describe("Health check", () => {
  it("returns 200 OK", async () => {
    const app = await buildApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(expect.objectContaining({ status: "ok" }));
  });
});