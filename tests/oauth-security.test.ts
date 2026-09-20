import { test, describe } from "node:test";
import assert from "node:assert/strict";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { validateAndGetOAuthRole, getUserPermissions } from "../server/routes/auth.routes.js";

describe("OAuth Security and Auto-Registration Tests", () => {
  let db: any;

  test("Initialize in-memory database with auth schema", async () => {
    db = await open({
      filename: ":memory:",
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        passwordHash TEXT,
        role TEXT,
        skills TEXT,
        rolePrefix TEXT,
        status TEXT,
        tokenVersion INTEGER DEFAULT 1,
        authProvider TEXT DEFAULT 'local',
        emailVerified INTEGER DEFAULT 1,
        createdAt TEXT
      );
      CREATE TABLE roles (
        id TEXT PRIMARY KEY,
        name TEXT,
        permissions TEXT
      );
      INSERT INTO roles (id, name, permissions) VALUES 
        ('super_admin', 'Super Admin', '{"create_tasks":true,"manage_roles":true,"reset_database":true}'),
        ('developer', 'Developer', '{"create_tasks":false,"manage_roles":false}');
    `);
  });

  test("First registered user via validateAndGetOAuthRole becomes super_admin when user count is 0", async () => {
    const role = await validateAndGetOAuthRole(db, "firstadmin@company.com");
    assert.equal(role, "super_admin");

    await db.run(
      "INSERT INTO users (id, name, email, passwordHash, role, authProvider, emailVerified, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["u-first", "First OAuth Admin", "firstadmin@company.com", "$2b$10$dummyhashvalue1234567890", role, "gitlab", 1, new Date().toISOString()]
    );

    const savedUser = await db.get("SELECT * FROM users WHERE id = 'u-first'");
    assert.equal(savedUser.role, "super_admin");
  });

  test("Subsequent OAuth users receive developer role when allowed", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const role = await validateAndGetOAuthRole(db, "developer@company.com");
      assert.equal(role, "developer");

      await db.run(
        "INSERT INTO users (id, name, email, passwordHash, role, authProvider, emailVerified, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["u-second", "Second User", "developer@company.com", "$2b$10$dummyhashvalue1234567890", role, "gitlab", 1, new Date().toISOString()]
      );

      const savedSecondUser = await db.get("SELECT * FROM users WHERE id = 'u-second'");
      assert.equal(savedSecondUser.role, "developer");
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  test("OAuth domain whitelist restriction throws error for unauthorized domains", async () => {
    const origDomains = process.env.OAUTH_ALLOWED_DOMAINS;
    process.env.OAUTH_ALLOWED_DOMAINS = "acme.com, partner.org";
    try {
      await assert.doesNotReject(async () => {
        await validateAndGetOAuthRole(db, "alice@acme.com");
      });
      await assert.doesNotReject(async () => {
        await validateAndGetOAuthRole(db, "bob@partner.org");
      });
      await assert.rejects(async () => {
        await validateAndGetOAuthRole(db, "attacker@evil.com");
      }, /not authorized for OAuth sign-in/);
    } finally {
      process.env.OAUTH_ALLOWED_DOMAINS = origDomains;
    }
  });

  test("Production default closed policy for auto-registration", async () => {
    const origEnv = process.env.NODE_ENV;
    const origAuto = process.env.OAUTH_AUTO_REGISTER;
    const origDomains = process.env.OAUTH_ALLOWED_DOMAINS;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.OAUTH_AUTO_REGISTER;
      delete process.env.OAUTH_ALLOWED_DOMAINS;

      // Unset in prod should reject
      await assert.rejects(async () => {
        await validateAndGetOAuthRole(db, "newuser@example.com");
      }, /Self-registration via OAuth is disabled in production/);

      // Explicit true in prod should allow
      process.env.OAUTH_AUTO_REGISTER = "true";
      const role = await validateAndGetOAuthRole(db, "newuser@example.com");
      assert.equal(role, "developer");
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.OAUTH_AUTO_REGISTER = origAuto;
      process.env.OAUTH_ALLOWED_DOMAINS = origDomains;
    }
  });
});
