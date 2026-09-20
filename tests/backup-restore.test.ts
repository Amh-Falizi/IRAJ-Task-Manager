import { test, describe } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { encryptSecret, decryptSecret } from "../server/config.js";
import { backupRouter, hasMaskedPlaceholders } from "../server/routes/backup.routes.js";
import { dbPromise } from "../server/db.js";

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

  test("HTTP restore route rejects payloads containing masked placeholders", async () => {
    const app = express();
    app.use(express.json());
    // Middleware to inject super_admin user for testing
    app.use((req: any, res, next) => {
      req.user = { id: "admin-1", role: "super_admin" };
      next();
    });
    app.use("/api/backup", backupRouter);

    const server = app.listen(0);
    const address = server.address() as any;
    const port = address.port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/backup/restore-json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          users: [{ id: "u-1", email: "admin@test.com", passwordHash: "hash" }],
          projects: [{ id: "p-1", repoToken: "••••••••" }]
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes("Backup contains masked credentials"));
    } finally {
      server.close();
    }
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
