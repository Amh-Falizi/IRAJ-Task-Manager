import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { webhookService } from "../server/services/webhook.service.js";
import { dbPromise } from "../server/db.js";
import { encryptSecret } from "../server/config.js";

describe("Webhook Cryptographic HMAC and Token Verification Tests", () => {
  const secret = "super-secret-hmac-key-98765";
  const encryptedSecret = encryptSecret(secret);
  const projectId = "proj-webhook-test-101";

  const rawPayload = JSON.stringify({
    action: "opened",
    repository: { full_name: "testorg/testrepo" },
    pull_request: {
      number: 42,
      html_url: "https://github.com/testorg/testrepo/pull/42",
      state: "open",
      head: { ref: "feature/auth-hardening" }
    }
  });

  const rawPingPayload = JSON.stringify({
    zen: "Non-blocking is better than blocking.",
    hook_id: 1234567,
    repository: { full_name: "testorg/testrepo" }
  });

  test("Setup test database project with encrypted webhook secret", async () => {
    const db = await dbPromise;
    await db.run("DELETE FROM projects WHERE id = ? OR (repoOwner = ? AND repoName = ?)", [projectId, "testorg", "testrepo"]);
    await db.run(
      "INSERT INTO projects (id, name, ownerId, repoOwner, repoName, webhookSecret, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [projectId, "Webhook Test Proj", "user-test-owner", "testorg", "testrepo", encryptedSecret, new Date().toISOString(), new Date().toISOString()]
    );
  });

  test("GitHub sha256 HMAC calculates matching signature", () => {
    const signature = `sha256=${crypto
      .createHmac("sha256", secret)
      .update(Buffer.from(rawPayload, "utf8"))
      .digest("hex")}`;

    assert.ok(signature.startsWith("sha256="));
    assert.equal(signature.length, 7 + 64);
  });

  test("handleGitHubWebhook verifies and accepts signed ping event", async () => {
    const validPingSig = `sha256=${crypto
      .createHmac("sha256", secret)
      .update(Buffer.from(rawPingPayload, "utf8"))
      .digest("hex")}`;

    const res = await webhookService.handleGitHubWebhook(
      "ping",
      JSON.parse(rawPingPayload),
      rawPingPayload,
      validPingSig
    );

    assert.equal(res.success, true);
    assert.equal(res.message, "PONG");
  });

  test("handleGitHubWebhook rejects unsigned or invalid signature on ping event", async () => {
    const invalidPingSig = `sha256=${crypto
      .createHmac("sha256", "wrong-secret-key")
      .update(Buffer.from(rawPingPayload, "utf8"))
      .digest("hex")}`;

    await assert.rejects(
      () =>
        webhookService.handleGitHubWebhook(
          "ping",
          JSON.parse(rawPingPayload),
          rawPingPayload,
          invalidPingSig
        ),
      (err: any) => err.message === "Invalid GitHub webhook signature"
    );

    await assert.rejects(
      () =>
        webhookService.handleGitHubWebhook(
          "ping",
          JSON.parse(rawPingPayload),
          rawPingPayload,
          undefined
        ),
      (err: any) => err.message === "Missing X-Hub-Signature-256 header"
    );
  });

  test("handleGitHubWebhook verifies valid signature and rejects forged signature on PR event", async () => {
    const validSignature = `sha256=${crypto
      .createHmac("sha256", secret)
      .update(Buffer.from(rawPayload, "utf8"))
      .digest("hex")}`;

    const forgedSignature = `sha256=${crypto
      .createHmac("sha256", "wrong-secret-key")
      .update(Buffer.from(rawPayload, "utf8"))
      .digest("hex")}`;

    const parsedPayload = JSON.parse(rawPayload);

    const result = await webhookService.handleGitHubWebhook(
      "pull_request",
      parsedPayload,
      rawPayload,
      validSignature
    );
    assert.equal(result.success, true);

    await assert.rejects(
      () =>
        webhookService.handleGitHubWebhook(
          "pull_request",
          parsedPayload,
          rawPayload,
          forgedSignature
        ),
      (err: any) => err.message === "Invalid GitHub webhook signature"
    );
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
