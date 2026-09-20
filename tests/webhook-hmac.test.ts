import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

describe("Webhook Cryptographic HMAC and Token Verification Tests", () => {
  const secret = "super-secret-hmac-key-98765";
  const rawPayload = JSON.stringify({
    action: "opened",
    pull_request: {
      number: 42,
      html_url: "https://github.com/org/repo/pull/42",
      state: "open",
      head: { ref: "feature/auth-hardening" }
    }
  });

  test("GitHub sha256 HMAC calculates matching signature", () => {
    const signature = `sha256=${crypto
      .createHmac("sha256", secret)
      .update(Buffer.from(rawPayload, "utf8"))
      .digest("hex")}`;

    assert.ok(signature.startsWith("sha256="));
    assert.equal(signature.length, 7 + 64);
  });

  test("Timing safe equal verifies valid signature and rejects forged signature", () => {
    const validSignature = `sha256=${crypto
      .createHmac("sha256", secret)
      .update(Buffer.from(rawPayload, "utf8"))
      .digest("hex")}`;

    const forgedSignature = `sha256=${crypto
      .createHmac("sha256", "wrong-secret-key")
      .update(Buffer.from(rawPayload, "utf8"))
      .digest("hex")}`;

    const verifyHmac = (received: string, expected: string) => {
      const recBuf = Buffer.from(received);
      const expBuf = Buffer.from(expected);
      if (recBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(recBuf, expBuf);
    };

    assert.equal(verifyHmac(validSignature, validSignature), true);
    assert.equal(verifyHmac(forgedSignature, validSignature), false);
    assert.equal(verifyHmac("short-invalid", validSignature), false);
  });

  test("GitLab secret token verification using timing-safe comparison", () => {
    const configuredToken = "gl-webhook-token-xyz-123";
    const headerToken = "gl-webhook-token-xyz-123";
    const invalidToken = "gl-webhook-token-wrong-999";

    const verifyGitLabToken = (received: string, expected: string) => {
      const recBuf = Buffer.from(received);
      const expBuf = Buffer.from(expected);
      if (recBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(recBuf, expBuf);
    };

    assert.equal(verifyGitLabToken(headerToken, configuredToken), true);
    assert.equal(verifyGitLabToken(invalidToken, configuredToken), false);
  });
});
