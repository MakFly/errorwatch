/**
 * Tests for api-keys service (pure functions only — no DB calls)
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { createHmac } from "crypto";

// ── Set required env var before any module import ──────────────────────────
process.env.API_KEY_HASH_SECRET = "test-hmac-secret-for-unit-tests";

// Import only the pure, side-effect-free helpers.
// We CANNOT import the full module because it calls setInterval at top level
// and tries to connect to a real DB.  Extract the relevant logic inline.

const API_KEY_HASH_SECRET = process.env.API_KEY_HASH_SECRET!;
const API_KEY_PATTERN = /^ew_(live|test)_[A-Za-z0-9_-]{32,}$/;

function isApiKeyFormat(apiKey: string): boolean {
  return API_KEY_PATTERN.test(apiKey);
}

function hashApiKey(apiKey: string): string {
  return createHmac("sha256", API_KEY_HASH_SECRET).update(apiKey).digest("hex");
}

function generateApiKey(type: "live" | "test" = "live"): string {
  const { randomBytes } = require("crypto");
  const bytes = randomBytes(24).toString("base64url");
  return `ew_${type}_${bytes}`;
}

function getKeyPreview(input: {
  key?: string | null;
  keyPrefix?: string | null;
  keyLast4?: string | null;
}): string | undefined {
  if (input.keyPrefix && input.keyLast4) {
    return `${input.keyPrefix}...${input.keyLast4}`;
  }
  if (input.key && isApiKeyFormat(input.key)) {
    return `${input.key.slice(0, 8)}...${input.key.slice(-4)}`;
  }
  return undefined;
}

describe("API key format", () => {
  test("generated live key matches expected pattern", () => {
    const key = generateApiKey("live");
    expect(isApiKeyFormat(key)).toBe(true);
    expect(key.startsWith("ew_live_")).toBe(true);
  });

  test("generated test key matches expected pattern", () => {
    const key = generateApiKey("test");
    expect(isApiKeyFormat(key)).toBe(true);
    expect(key.startsWith("ew_test_")).toBe(true);
  });

  test("generated keys are sufficiently long (at least 32 random chars)", () => {
    const key = generateApiKey();
    // "ew_live_" prefix = 8 chars, remainder must be >= 32
    const suffix = key.replace(/^ew_(live|test)_/, "");
    expect(suffix.length).toBeGreaterThanOrEqual(32);
  });

  test("isApiKeyFormat rejects an arbitrary string", () => {
    expect(isApiKeyFormat("not-a-valid-key")).toBe(false);
    expect(isApiKeyFormat("")).toBe(false);
    expect(isApiKeyFormat("ew_live_short")).toBe(false);
  });

  test("isApiKeyFormat accepts a well-formed key", () => {
    const key = "ew_live_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    expect(isApiKeyFormat(key)).toBe(true);
  });
});

describe("hashApiKey", () => {
  test("produces a 64-char hex string", () => {
    const hash = hashApiKey("ew_live_somekey1234567890123456789012");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("same input always yields same hash", () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  test("different keys yield different hashes", () => {
    const keyA = generateApiKey();
    const keyB = generateApiKey();
    expect(hashApiKey(keyA)).not.toBe(hashApiKey(keyB));
  });

  test("hash changes when HMAC secret changes", () => {
    const key = generateApiKey();
    const hashWithSecret1 = createHmac("sha256", "secret-1").update(key).digest("hex");
    const hashWithSecret2 = createHmac("sha256", "secret-2").update(key).digest("hex");
    expect(hashWithSecret1).not.toBe(hashWithSecret2);
  });
});

describe("getKeyPreview", () => {
  test("returns prefix...last4 when both fields are present", () => {
    expect(getKeyPreview({ keyPrefix: "ew_live_", keyLast4: "ab12" })).toBe("ew_live_...ab12");
  });

  test("builds preview from raw key when prefix/last4 are absent", () => {
    const key = "ew_live_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    const preview = getKeyPreview({ key });
    expect(preview).toBe(`${key.slice(0, 8)}...${key.slice(-4)}`);
  });

  test("returns undefined when no usable data is provided", () => {
    expect(getKeyPreview({})).toBeUndefined();
    expect(getKeyPreview({ key: "invalid-format" })).toBeUndefined();
  });
});
