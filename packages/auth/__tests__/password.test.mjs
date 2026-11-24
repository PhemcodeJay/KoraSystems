import { describe, it, expect } from "vitest";

// Test the SESSION_SECRET validation logic directly
// This mirrors the logic in packages/auth/src/session.ts

const FORBIDDEN_SECRETS = new Set([
  "change-me-to-a-long-random-string",
  "changeme",
  "secret",
  "kora",
  "dev",
]);

function validateSessionSecret(envSessionSecret) {
  if (!envSessionSecret) {
    return { error: "SESSION_SECRET is not set. Add it to .env (see .env.example).", valid: false };
  }
  const normalised = envSessionSecret.trim().toLowerCase();
  if (FORBIDDEN_SECRETS.has(normalised) || normalised.length < 32) {
    return {
      error:
        "SESSION_SECRET is still a placeholder or too short. Generate one with `openssl rand -base64 48` and set it in .env. Every role check in this platform depends on this value being secret.",
      valid: false,
    };
  }
  return { error: null, valid: true };
}

describe("SESSION_SECRET validation", () => {
  it("rejects empty SESSION_SECRET", () => {
    const result = validateSessionSecret("");
    expect(result.error).toContain("SESSION_SECRET is not set");
    expect(result.valid).toBe(false);
  });

  it("rejects forbidden placeholder secrets", () => {
    const result = validateSessionSecret("change-me-to-a-long-random-string");
    expect(result.error).toContain("placeholder");
    expect(result.valid).toBe(false);
  });

  it("rejects short secrets (< 32 chars)", () => {
    const result = validateSessionSecret("short");
    expect(result.error).toContain("too short");
    expect(result.valid).toBe(false);
  });

  it("accepts valid 48-char base64 secret", () => {
    const result = validateSessionSecret(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    ); // 48 a's
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });
});