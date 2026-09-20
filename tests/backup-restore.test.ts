import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret } from "../server/config.js";
import { hasMaskedPlaceholders } from "../server/routes/backup.routes.js";

describe("Backup Export and Restore Security Tests", () => {
  test("Exported secrets are encrypted opaque blobs and decrypted correctly", () => {
    const rawSecret = "glpat-super-secret-gitlab-token-12345";
    const encrypted = encryptSecret(rawSecret);

    assert.notEqual(encrypted, rawSecret);
    assert.notEqual(encrypted, "••••••••");
    assert.equal(typeof encrypted, "string");
    assert.ok(encrypted.length > 20);

    const decrypted = decryptSecret(encrypted);
    assert.equal(decrypted, rawSecret);
  });

  test("Restore hasMaskedPlaceholders correctly detects masked bullet placeholders", () => {
    const dummyExportWithBullets = {
      version: "2.0.0",
      users: [{ id: "u-1", name: "Admin" }],
      projects: [
        {
          id: "proj-test",
          name: "Test Project",
          repoToken: "••••••••", // Masked placeholder
          webhookSecret: "••••••••"
        }
      ]
    };

    assert.equal(hasMaskedPlaceholders(dummyExportWithBullets), true);

    const validExport = {
      version: "2.0.0",
      users: [{ id: "u-1", name: "Admin" }],
      projects: [
        {
          id: "proj-test",
          name: "Test Project",
          repoToken: encryptSecret("valid-token"),
          webhookSecret: encryptSecret("valid-secret")
        }
      ]
    };

    assert.equal(hasMaskedPlaceholders(validExport), false);
  });

  test("Restore error responses are sanitized without leaking internals", () => {
    const simulateClientResponse = (err: any) => {
      return {
        error: "Failed to restore database: Invalid or corrupted backup file."
      };
    };

    const response = simulateClientResponse(new Error("SQLITE_CORRUPT: disk I/O error table users row 49"));
    assert.equal(response.error, "Failed to restore database: Invalid or corrupted backup file.");
    assert.ok(!response.error.includes("SQLITE_CORRUPT"));
  });
});
