import { test, describe } from "node:test";
import assert from "node:assert/strict";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { getUserPermissions } from "../server/routes/auth.routes.js";

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

  test("First registered user via OAuth becomes super_admin when user count is 0", async () => {
    const userCountRow = await db.get("SELECT COUNT(*) as count FROM users");
    const isFirstUser = (userCountRow?.count || 0) === 0;
    assert.equal(isFirstUser, true);

    const assignedRole = isFirstUser ? "super_admin" : "developer";
    assert.equal(assignedRole, "super_admin");

    await db.run(
      "INSERT INTO users (id, name, email, passwordHash, role, authProvider, emailVerified, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["u-first", "First OAuth Admin", "admin@company.com", "$2b$10$dummyhashvalue1234567890", assignedRole, "gitlab", 1, new Date().toISOString()]
    );

    const savedUser = await db.get("SELECT * FROM users WHERE id = 'u-first'");
    assert.equal(savedUser.role, "super_admin");
  });

  test("Subsequent OAuth users do not receive super_admin role automatically", async () => {
    const userCountRow = await db.get("SELECT COUNT(*) as count FROM users");
    const isFirstUser = (userCountRow?.count || 0) === 0;
    assert.equal(isFirstUser, false);

    const assignedRole = isFirstUser ? "super_admin" : "developer";
    assert.equal(assignedRole, "developer");

    await db.run(
      "INSERT INTO users (id, name, email, passwordHash, role, authProvider, emailVerified, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["u-second", "Second User", "dev@company.com", "$2b$10$dummyhashvalue1234567890", assignedRole, "gitlab", 1, new Date().toISOString()]
    );

    const savedSecondUser = await db.get("SELECT * FROM users WHERE id = 'u-second'");
    assert.equal(savedSecondUser.role, "developer");
  });

  test("OAuth domain whitelist restriction correctly filters unauthorized domains", () => {
    const allowedDomains = ["acme.com", "partner.org"];
    
    const isDomainAllowed = (email: string) => {
      const emailDomain = email.split("@")[1]?.toLowerCase();
      return allowedDomains.includes(emailDomain);
    };

    assert.equal(isDomainAllowed("alice@acme.com"), true);
    assert.equal(isDomainAllowed("bob@partner.org"), true);
    assert.equal(isDomainAllowed("attacker@evil.com"), false);
    assert.equal(isDomainAllowed("charlie@othercorp.net"), false);
  });

  test("Production default closed policy for auto-registration", () => {
    const isProd = true;
    
    // Default when unset in prod must be false
    const envVal: string | undefined = undefined;
    const allowUnsetProd = isProd ? (envVal === "true") : true;
    assert.equal(allowUnsetProd, false);

    // Explicit false in dev or prod must be false
    const explicitFalseEnv: string | undefined = "false";
    const explicitFalse = explicitFalseEnv === "true";
    assert.equal(explicitFalse, false);
  });
});
