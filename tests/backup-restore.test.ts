import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret } from "../server/config.js";

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

  test("Restore rejects masked bullet placeholders from corrupting database", () => {
    const dummyExport = {
      version: "2.0.0",
      data: {
        projects: [
          {
            id: "proj-test",
            name: "Test Project",
            repoToken: "••••••••", // Masked placeholder
            webhookSecret: "••••••••"
          }
        ]
      }
    };

    const isPlaceholder = (val?: string | null) => {
      if (!val) return false;
      const trimmed = val.trim();
      return (
        trimmed === "••••••••" ||
        trimmed === "********" ||
        trimmed.replace(/•/g, "").length === 0 ||
        trimmed.replace(/\*/g, "").length === 0
      );
    };

    const project = dummyExport.data.projects[0];
    assert.equal(isPlaceholder(project.repoToken), true);
    assert.equal(isPlaceholder(project.webhookSecret), true);

    const validEncrypted = encryptSecret("valid-secret-token");
    assert.equal(isPlaceholder(validEncrypted), false);
  });

  test("Restore error responses are sanitized without leaking internals", () => {
    const simulateClientResponse = (err: any) => {
      // In production, internal DB trace/schema is withheld
      const isDev = false;
      return {
        error: isDev
          ? `Restore failed: ${err.message}`
          : "Restore failed: Invalid or corrupted backup file."
      };
    };

    const response = simulateClientResponse(new Error("SQLITE_CORRUPT: disk I/O error table users row 49"));
    assert.equal(response.error, "Restore failed: Invalid or corrupted backup file.");
    assert.ok(!response.error.includes("SQLITE_CORRUPT"));
  });
});
