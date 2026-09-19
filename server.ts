// AI Studio Editor Sync
// Security and Role Review Complete
import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { Pool } from "pg";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import nodemailer from "nodemailer";
import cookieParser from "cookie-parser";
import {
  escapeHtml,
  safeJsonForScriptTag,
  getAppUrl,
  PORT,
  HOST,
  SECRET_KEY,
  encryptSecret,
  decryptSecret,
  AUTH_COOKIE_NAME,
  getCookieOptions,
  setAuthCookie,
  clearAuthCookie
} from "./server/config.js";
import { DatabaseWrapper, User, Task, Role } from "./server/types.js";
import {
  dbPromise,
  getDb,
  activeSqlitePath,
  extractTaskNumber,
  purgeStaleUnverifiedUsers,
  PgWrapper
} from "./server/db.js";
import {
  authenticateToken,
  isSuperAdmin,
  isAdminOrSuperAdmin,
  isProjectAdminOrOwner,
  checkProjectAccess,
  checkTaskAccess,
  hasPermission,
  canManageUsers,
  canManageRoles
} from "./server/middleware/auth.js";

const app = express();
app.set("trust proxy", 1); // Trust first proxy for rate limiting (Cloud Run/Nginx)

// Request logging
app.use(morgan("dev"));

// Attach CSP nonce to res.locals for HTML script tags
app.use((req: any, res: any, next: any) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Basic security headers
const gitlabOrigin = process.env.GITLAB_URL && /^https?:\/\//i.test(process.env.GITLAB_URL)
  ? new URL(process.env.GITLAB_URL).origin
  : null;

const cspImgSrc = ["'self'", "data:", "blob:", "https://*.githubusercontent.com", "https://*.googleusercontent.com", "https://gitlab.com", "https://*.gitlab.com", "https://secure.gravatar.com"];
if (gitlabOrigin && !cspImgSrc.includes(gitlabOrigin)) {
  cspImgSrc.push(gitlabOrigin);
}

const cspConnectSrc = ["'self'", "https://github.com", "https://api.github.com", "https://gitlab.com", "https://*.gitlab.com", "https://www.googleapis.com", "https://*.googleapis.com"];
if (gitlabOrigin && !cspConnectSrc.includes(gitlabOrigin)) {
  cspConnectSrc.push(gitlabOrigin);
}

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req: any, res: any) => `'nonce-${res.locals.cspNonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: cspImgSrc,
      connectSrc: cspConnectSrc,
      frameSrc: ["'self'"],
    }
  } : false,
  crossOriginEmbedderPolicy: false
}));

// Compress responses
app.use(compression());

// Basic Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: "Too many requests from this IP, please try again after 15 minutes" }
});

// Apply rate limiting to API routes
app.use("/api/", apiLimiter);

// Protect auth routes more strictly
const authLimiter = rateLimit({
  windowMs: 60 * 1000 * 60, // 1 hour window
  max: 50, // limit to 50 auth requests per hour
  validate: { xForwardedForHeader: false },
  message: { error: "Too many auth attempts from this IP, please try again after an hour" }
});
app.use("/api/auth/", authLimiter);

app.use(express.json({ limit: '10mb' })); // Limit body size to prevent payload bombing
app.use(cookieParser());


/* --- API ROUTES --- */

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    let { name, email, password, role } = req.body;
    
    // Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: "Name is required and must be a valid string." });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "A valid email address is required." });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    email = email.toLowerCase().trim();
    const db = await dbPromise;

    const result = await db.transaction(async (tx) => {
      const existing = await tx.get("SELECT * FROM users WHERE email = ?", email);
      if (existing) {
        if (existing.authProvider === 'local' && (existing.emailVerified === 0 || existing.emailVerified === false)) {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          if (existing.createdAt && existing.createdAt > oneDayAgo) {
            throw new Error("Email is already registered and pending verification. Please wait 24 hours before re-registering.");
          }
          // Clear previous unverified reservation so the legitimate user can register
          await tx.run("DELETE FROM users WHERE id = ?", existing.id);
        } else {
          throw new Error("Email already exists");
        }
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const id = uuidv4();
      const createdAt = new Date().toISOString();

      const userCount = await tx.get("SELECT COUNT(*) as count FROM users");
      const isFirstUser = parseInt(userCount.count, 10) === 0;
      const assignedRole = isFirstUser ? "super_admin" : "developer";
      const emailVerified = isFirstUser ? 1 : 0;

      await tx.run(
        "INSERT INTO users (id, name, email, passwordHash, role, tokenVersion, authProvider, emailVerified, status, createdAt) VALUES (?, ?, ?, ?, ?, 1, 'local', ?, 'Available', ?)",
        [id, name, email, passwordHash, assignedRole, emailVerified, createdAt]
      );
      
      return { id, name, email, role: assignedRole, emailVerified };
    });

    if (result.emailVerified === 1) {
      const token = jwt.sign({ id: result.id, role: result.role, tokenVersion: 1 }, SECRET_KEY, { expiresIn: "7d" });
      setAuthCookie(res, token);
      return res.json({ user: { id: result.id, name: result.name, email: result.email, role: result.role, rolePrefix: "" } });
    } else {
      return res.json({
        message: "Registration successful. Please contact an administrator or use 'Forgot Password' to verify your email address before logging in.",
        requiresVerification: true
      });
    }
  } catch (e: any) {
    if (e.message && (e.message.includes("Email already") || e.message.includes("pending verification"))) {
      return res.status(400).json({ error: e.message });
    }
    console.error("REGISTER ERROR:", e);
    res.status(500).json({ error: "An unexpected error occurred during registration." });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return res.status(400).json({ error: "Email is required." });
    }
    if (!password || typeof password !== 'string' || password.trim() === '') {
      return res.status(400).json({ error: "Password is required." });
    }

    email = email.toLowerCase().trim();
    const db = await dbPromise;
    
    const user = await db.get("SELECT * FROM users WHERE email = ? ", email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.status && (user.status.toLowerCase() === 'inactive' || user.status.toLowerCase() === 'disabled' || user.status.toLowerCase() === 'suspended')) {
      return res.status(403).json({ error: "Account is inactive or disabled. Contact administrator." });
    }

    if (user.emailVerified === 0 || user.emailVerified === false) {
      return res.status(403).json({ error: "Email address is not verified. Please verify your account or contact an administrator before logging in." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const tokenVersion = user.tokenVersion || 1;
    const token = jwt.sign({ id: user.id, role: user.role, tokenVersion }, SECRET_KEY, { expiresIn: "7d" });
    setAuthCookie(res, token);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, rolePrefix: user.rolePrefix || "" } });
  } catch (e: any) {
    console.error("LOGIN ERROR:", e);
    res.status(500).json({ error: "An unexpected error occurred during login." });
  }
});

// Logout
app.post("/api/auth/logout", async (req: any, res: any) => {
  try {
    const authHeader = req.headers["authorization"];
    const rawBearer = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
    const token = (rawBearer && rawBearer !== "cookie_authenticated" && rawBearer !== "null") ? rawBearer : cookieToken;

    if (token) {
      try {
        const decoded: any = jwt.verify(token, SECRET_KEY);
        if (decoded?.id) {
          const db = await dbPromise;
          await db.run("UPDATE users SET tokenVersion = COALESCE(tokenVersion, 1) + 1 WHERE id = ?", decoded.id);
        }
      } catch (e) {
        // Ignore token verification errors during logout
      }
    }
  } catch (e) {
    console.error("LOGOUT ERROR:", e);
  } finally {
    clearAuthCookie(res);
    res.json({ success: true, message: "Logged out successfully" });
  }
});

// Forgot Password
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    let { email } = req.body;
    if (!email || typeof email !== 'string' || email.trim() === '') {
      return res.status(400).json({ error: "A valid email is required." });
    }
    email = email.toLowerCase().trim();

    const db = await dbPromise;
    const user = await db.get("SELECT * FROM users WHERE email = ? ", email);
    if (!user) {
      // Return success to avoid email enumeration
      return res.json({ message: "If that email is registered, a password reset link has been sent." });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = Date.now() + 3600000; // 1 hour token validity

    // Invalidate any active previous reset tokens for this user
    await db.run("DELETE FROM password_resets WHERE userId = ?", user.id);
    await db.run("INSERT INTO password_resets (token, userId, expiresAt) VALUES (?, ?, ?)", [tokenHash, user.id, expiresAt]);

    const baseUrl = getAppUrl(req);
    const resetLink = `${baseUrl}/reset-password/${resetToken}`;

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Project Manager" <noreply@example.com>',
        to: user.email,
        subject: "Password Reset Request",
        text: `You requested a password reset. Click this link to reset your password: ${resetLink}\n\nIf you did not request this, please ignore this email.`,
        html: `<p>You requested a password reset.</p><p><a href="${resetLink}">Click here to reset your password</a></p><p>If you did not request this, please ignore this email.</p>`,
      });

      return res.json({ message: "If that email is registered, a password reset link has been sent." });
    } else {
      console.log(`[DEV MODE] Password reset link for ${email}: ${resetLink}`);
      return res.json({ message: "If that email is registered, a password reset link has been sent." });
    }
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    return res.status(500).json({ error: "Failed to process password reset request." });
  }
});

// Reset Password
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || typeof token !== 'string') return res.status(400).json({ error: "Invalid token." });
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters long." });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const db = await dbPromise;
    const resetRecord = await db.get("SELECT * FROM password_resets WHERE token = ?", tokenHash);

    if (!resetRecord || resetRecord.expiresAt < Date.now()) {
      if (resetRecord) await db.run("DELETE FROM password_resets WHERE token = ?", tokenHash);
      return res.status(400).json({ error: "Invalid or expired reset token." });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    // Invalidate existing sessions by incrementing tokenVersion
    await db.run("UPDATE users SET passwordHash = ?, tokenVersion = COALESCE(tokenVersion, 1) + 1, emailVerified = 1 WHERE id = ?", [hash, resetRecord.userId]);
    await db.run("DELETE FROM password_resets WHERE userId = ?", resetRecord.userId);

    res.json({ message: "Password has been successfully reset" });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    return res.status(500).json({ error: "Failed to reset password." });
  }
});

// OAuth State Management & Security
// Nonce expiry handled via periodic cleanup or implicit expiry via state timestamp (15 mins)

const createSignedOAuthState = (provider: string, redirectUri: string): string => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const payload = `${provider}:${redirectUri}:${nonce}:${timestamp}`;
  const sig = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ provider, redirectUri, nonce, timestamp, sig })).toString('base64url');
};

const verifyOAuthState = async (db: any, req: any, provider: string, state: any): Promise<string> => {
  if (!state || typeof state !== 'string') {
    throw new Error('Missing or invalid OAuth state parameter (CSRF verification failed).');
  }
  try {
    const raw = Buffer.from(state, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.provider !== provider || !parsed.sig || !parsed.timestamp || !parsed.redirectUri || !parsed.nonce) {
      throw new Error('Malformed OAuth state parameter.');
    }
    // Check state expiry (15 minutes)
    if (Date.now() - parseInt(parsed.timestamp, 10) > 15 * 60 * 1000) {
      throw new Error('OAuth state parameter has expired. Please try signing in again.');
    }
    // Prevent replay attacks by ensuring nonce is used only once (cross-process safe via SQLite)
    const existingNonce = await db.get("SELECT nonce FROM oauth_nonces WHERE nonce = ?", parsed.nonce);
    if (existingNonce) {
      throw new Error('OAuth state parameter has already been used. Please try signing in again.');
    }
    const payload = `${parsed.provider}:${parsed.redirectUri}:${parsed.nonce}:${parsed.timestamp}`;
    const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(parsed.sig), Buffer.from(expectedSig))) {
      await db.run("INSERT INTO oauth_nonces (nonce, timestamp) VALUES (?, ?)", [parsed.nonce, Date.now()]);
      return getValidatedCallbackRedirect(req, provider, parsed.redirectUri);
    } else {
      throw new Error('OAuth state signature verification failed.');
    }
  } catch (e: any) {
    if (e.message && e.message.includes('OAuth')) throw e;
    throw new Error('OAuth state verification failed. Authentication aborted for security.');
  }
};

// GitLab OAuth
const getSafeOAuthRedirectUri = (req: any, provider: string) => {
  const defaultBase = getAppUrl(req);
  let base = defaultBase;
  if (req.query.origin && typeof req.query.origin === 'string') {
    try {
      const parsedOrigin = new URL(req.query.origin);
      const parsedHost = new URL(defaultBase);
      if (
        parsedOrigin.hostname === parsedHost.hostname || 
        (process.env.NODE_ENV !== 'production' && (parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1'))
      ) {
        base = parsedOrigin.origin;
      }
    } catch (e) {
      base = defaultBase;
    }
  }
  return `${base}/api/auth/${provider}/callback`;
};

const getValidatedCallbackRedirect = (req: any, provider: string, state: any): string => {
  const defaultRedirect = `${getAppUrl(req)}/api/auth/${provider}/callback`;
  if (state && typeof state === 'string') {
    try {
      const parsed = new URL(state);
      const host = new URL(defaultRedirect);
      if (
        (parsed.hostname === host.hostname || (process.env.NODE_ENV !== 'production' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))) &&
        (parsed.pathname === `/api/auth/${provider}/callback` || parsed.pathname === `/api/auth/${provider}/callback/`)
      ) {
        return state;
      }
    } catch (e) {
      // fallback
    }
  }
  return defaultRedirect;
};

app.get("/api/auth/gitlab/url", (req, res) => {
  const redirectUri = getSafeOAuthRedirectUri(req, "gitlab");
  const state = createSignedOAuthState("gitlab", redirectUri);

  const params = new URLSearchParams({
    client_id: process.env.GITLAB_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read_user', // Requires 'read_user' scope for user profile info
    state
  });

  const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
  res.json({ url: `${gitlabUrl}/oauth/authorize?${params.toString()}` });
});

app.get("/api/auth/gitlab/callback", async (req: any, res: any) => {
  const { code, state } = req.query;
  const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
  const clientId = process.env.GITLAB_CLIENT_ID || '';
  const clientSecret = process.env.GITLAB_CLIENT_SECRET || '';

  try {
    const db = await dbPromise;
    const redirectUri = await verifyOAuthState(db, req, "gitlab", state);
    if (!code) throw new Error('No authorization code provided');
    if (!clientId) throw new Error('GITLAB_CLIENT_ID not configured');

    const tokenRes = await fetch(`${gitlabUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error_description || 'Failed to get token');

    const userRes = await fetch(`${gitlabUrl}/api/v4/user`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    if (!userRes.ok) throw new Error('Failed to get user data');
    if (userData.state && userData.state !== 'active') {
      throw new Error('GitLab account is inactive or blocked.');
    }
    if (!userData.email) throw new Error('GitLab account has no email address. Please make sure your email is verified and public on GitLab.');

    // Fetch user emails from GitLab to ensure email is confirmed
    let isEmailConfirmed = !!userData.confirmed_at;
    try {
      const glEmailsRes = await fetch(`${gitlabUrl}/api/v4/user/emails`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (glEmailsRes.ok) {
        const glEmails = await glEmailsRes.json();
        if (Array.isArray(glEmails)) {
          const match = glEmails.find((e: any) => e.email && e.email.toLowerCase() === userData.email.toLowerCase());
          if (match && match.confirmed_at) {
            isEmailConfirmed = true;
          }
        }
      }
    } catch (e) {
      // ignore
    }

    if (!isEmailConfirmed) {
      throw new Error("GitLab account email is not confirmed. Please confirm your email on GitLab before signing in.");
    }

    const email = userData.email.toLowerCase().trim();
    let user = await db.get("SELECT * FROM users WHERE email = ? ", email);

    if (!user) {
      const id = uuidv4();
      const role = "developer";
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(randomPassword, salt);
      await db.run(
        "INSERT INTO users (id, name, email, passwordHash, role, tokenVersion, authProvider, emailVerified, status) VALUES (?, ?, ?, ?, ?, 1, 'gitlab', 1, 'Available')",
        [id, userData.name || userData.username || 'GitLab User', email, hash, role]
      );
      user = await db.get("SELECT id, name, email, role, status, tokenVersion FROM users WHERE id = ?", id);
    } else {
      if (user.status && (user.status.toLowerCase() === 'inactive' || user.status.toLowerCase() === 'disabled' || user.status.toLowerCase() === 'suspended')) {
        throw new Error("Account is inactive or disabled. Contact administrator.");
      }
      if (user.authProvider === 'local') {
        throw new Error("An account with this email already exists with password authentication. Please sign in with your email and password.");
      } else if (user.authProvider !== 'gitlab') {
        throw new Error(`An account with this email already exists registered via ${user.authProvider}. Please sign in using ${user.authProvider}.`);
      }
    }

    const tokenVersion = user.tokenVersion || 1;
    const token = jwt.sign({ id: user.id, role: user.role, tokenVersion }, SECRET_KEY, { expiresIn: "7d" });
    setAuthCookie(res, token);
    const userPayload = safeJsonForScriptTag({ id: user.id, name: user.name, email: user.email, role: user.role });

    res.send(`
      <!DOCTYPE html>
      <html>
        <body>
          <script nonce="${res.locals.cspNonce}">
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                user: ${userPayload} 
              }, window.location.origin);
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. Closing...</p>
        </body>
      </html>
    `);

  } catch (e: any) {
    console.error("GitLab OAuth error:", e);
    res.send(`
      <!DOCTYPE html>
      <html><body>
        <p>OAuth Error: ${escapeHtml(e.message)}</p>
        <p>Note: Ensure GITLAB_CLIENT_ID and GITLAB_CLIENT_SECRET are configured.</p>
        <script nonce="${res.locals.cspNonce}">setTimeout(() => window.close(), 5000);</script>
      </body></html>
    `);
  }
});

// Google OAuth Integration
app.get("/api/auth/google/url", (req, res) => {
  const redirectUri = getSafeOAuthRedirectUri(req, "google");
  const state = createSignedOAuthState("google", redirectUri);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

app.get(["/api/auth/google/callback", "/api/auth/google/callback/"], async (req: any, res: any) => {
  const { code, state } = req.query;
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  try {
    const db = await dbPromise;
    const redirectUri = await verifyOAuthState(db, req, "google", state);
    if (!code) throw new Error('No authorization code provided');
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error_description || tokenData.error || 'Failed to get token');

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    if (!userRes.ok) throw new Error('Failed to get user data');
    if (!userData.email) throw new Error('Google account has no email address.');
    if (userData.email_verified !== true && userData.email_verified !== 'true') throw new Error('Google account email is not verified.');

    const email = userData.email.toLowerCase().trim();
    let user = await db.get("SELECT * FROM users WHERE email = ? ", email);

    if (!user) {
      const id = uuidv4();
      const role = "developer";
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(randomPassword, salt);
      await db.run(
        "INSERT INTO users (id, name, email, passwordHash, role, tokenVersion, authProvider, emailVerified, status) VALUES (?, ?, ?, ?, ?, 1, 'google', 1, 'Available')",
        [id, userData.name || userData.given_name || 'Google User', email, hash, role]
      );
      user = await db.get("SELECT id, name, email, role, status, tokenVersion FROM users WHERE id = ?", id);
    } else {
      if (user.status && (user.status.toLowerCase() === 'inactive' || user.status.toLowerCase() === 'disabled' || user.status.toLowerCase() === 'suspended')) {
        throw new Error("Account is inactive or disabled. Contact administrator.");
      }
      if (user.authProvider === 'local') {
        throw new Error("An account with this email already exists with password authentication. Please sign in with your email and password.");
      } else if (user.authProvider !== 'google') {
        throw new Error(`An account with this email already exists registered via ${user.authProvider}. Please sign in using ${user.authProvider}.`);
      }
    }

    const tokenVersion = user.tokenVersion || 1;
    const token = jwt.sign({ id: user.id, role: user.role, tokenVersion }, SECRET_KEY, { expiresIn: "7d" });
    setAuthCookie(res, token);
    const userPayload = safeJsonForScriptTag({ id: user.id, name: user.name, email: user.email, role: user.role });

    res.send(`
      <!DOCTYPE html>
      <html>
        <body>
          <script nonce="${res.locals.cspNonce}">
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                user: ${userPayload} 
              }, window.location.origin);
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. Closing...</p>
        </body>
      </html>
    `);

  } catch (e: any) {
    console.error("Google OAuth error:", e);
    res.send(`
      <!DOCTYPE html>
      <html><body>
        <p>Google OAuth Error: ${escapeHtml(e.message)}</p>
        <p>Note: Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured in the environment variables.</p>
        <script nonce="${res.locals.cspNonce}">setTimeout(() => window.close(), 5000);</script>
      </body></html>
    `);
  }
});

// GitHub OAuth Integration
app.get("/api/auth/github/url", (req, res) => {
  const redirectUri = getSafeOAuthRedirectUri(req, "github");
  const state = createSignedOAuthState("github", redirectUri);

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || '',
    redirect_uri: redirectUri,
    scope: 'user:email',
    state
  });

  res.json({ url: `https://github.com/login/oauth/authorize?${params.toString()}` });
});

app.get(["/api/auth/github/callback", "/api/auth/github/callback/"], async (req: any, res: any) => {
  const { code, state } = req.query;
  const clientId = process.env.GITHUB_CLIENT_ID || '';
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || '';

  try {
    const db = await dbPromise;
    const redirectUri = await verifyOAuthState(db, req, "github", state);
    if (!code) throw new Error('No authorization code provided');
    if (!clientId) throw new Error('GITHUB_CLIENT_ID not configured');

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) throw new Error(tokenData.error_description || tokenData.error || 'Failed to get token');

    const userRes = await fetch("https://api.github.com/user", {
      headers: { 
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "devteam-taskmanager"
      }
    });
    const userData = await userRes.json();
    if (!userRes.ok) throw new Error('Failed to get user data from GitHub');

    let email = null;
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: { 
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "devteam-taskmanager"
      }
    });
    if (emailsRes.ok) {
      const emails = await emailsRes.json();
      const verifiedPrimary = emails.find((e: any) => e.primary && e.verified);
      const verifiedAny = emails.find((e: any) => e.verified);
      if (verifiedPrimary) {
        email = verifiedPrimary.email;
      } else if (verifiedAny) {
        email = verifiedAny.email;
      }
    }

    if (!email) throw new Error('GitHub account has no verified email address. Please make sure your primary email is verified on GitHub.');
    email = email.toLowerCase().trim();

    let user = await db.get("SELECT * FROM users WHERE email = ? ", email);

    if (!user) {
      const id = uuidv4();
      const role = "developer";
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(randomPassword, salt);
      await db.run(
        "INSERT INTO users (id, name, email, passwordHash, role, tokenVersion, authProvider, emailVerified, status) VALUES (?, ?, ?, ?, ?, 1, 'github', 1, 'Available')",
        [id, userData.name || userData.login || 'GitHub User', email, hash, role]
      );
      user = await db.get("SELECT id, name, email, role, status, tokenVersion FROM users WHERE id = ?", id);
    } else {
      if (user.status && (user.status.toLowerCase() === 'inactive' || user.status.toLowerCase() === 'disabled' || user.status.toLowerCase() === 'suspended')) {
        throw new Error("Account is inactive or disabled. Contact administrator.");
      }
      if (user.authProvider === 'local') {
        throw new Error("An account with this email already exists with password authentication. Please sign in with your email and password.");
      } else if (user.authProvider !== 'github') {
        throw new Error(`An account with this email already exists registered via ${user.authProvider}. Please sign in using ${user.authProvider}.`);
      }
    }

    const tokenVersion = user.tokenVersion || 1;
    const token = jwt.sign({ id: user.id, role: user.role, tokenVersion }, SECRET_KEY, { expiresIn: "7d" });
    setAuthCookie(res, token);
    const userPayload = safeJsonForScriptTag({ id: user.id, name: user.name, email: user.email, role: user.role });

    res.send(`
      <!DOCTYPE html>
      <html>
        <body>
          <script nonce="${res.locals.cspNonce}">
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                user: ${userPayload} 
              }, window.location.origin);
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. Closing...</p>
        </body>
      </html>
    `);

  } catch (e: any) {
    console.error("GitHub OAuth error:", e);
    res.send(`
      <!DOCTYPE html>
      <html><body>
        <p>GitHub OAuth Error: ${escapeHtml(e.message)}</p>
        <p>Note: Ensure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are configured in the environment variables.</p>
        <script nonce="${res.locals.cspNonce}">setTimeout(() => window.close(), 5000);</script>
      </body></html>
    `);
  }
});

// Get Me
app.get("/api/auth/me", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const user = await db.get("SELECT id, name, email, role, skills, rolePrefix, status FROM users WHERE id = ?", req.user.id);
  if (!user) return res.sendStatus(404);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, skills: user.skills ? JSON.parse(user.skills) : [], rolePrefix: user.rolePrefix || "", status: user.status || "Available" });
});

// Update Profile
app.put("/api/users/me", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { name, skills, status } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Name is required." });
  }

  // Prevent users from setting admin lockout statuses on themselves
  const disallowedStatuses = ['inactive', 'disabled', 'suspended'];
  let statusVal = status || "Available";
  if (disallowedStatuses.includes(statusVal.toLowerCase())) {
    statusVal = "Available";
  }

  if (skills !== undefined) {
    await db.run(
      "UPDATE users SET name = ?, skills = ?, status = ? WHERE id = ?",
      [name, JSON.stringify(skills), statusVal, req.user.id]
    );
  } else {
    await db.run(
      "UPDATE users SET name = ?, status = ? WHERE id = ?",
      [name, statusVal, req.user.id]
    );
  }
  
  const updatedUser = await db.get("SELECT id, name, email, role, skills, rolePrefix, status FROM users WHERE id = ?", req.user.id);
  res.json({
    ...updatedUser,
    skills: updatedUser.skills ? JSON.parse(updatedUser.skills) : [],
    rolePrefix: updatedUser.rolePrefix || "",
    status: updatedUser.status || "Available"
  });
});

// Change Password
app.put("/api/users/me/password", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new passwords are required." });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters long." });
  }

  const user = await db.get("SELECT passwordHash, tokenVersion, role FROM users WHERE id = ?", req.user.id);
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return res.status(400).json({ error: "Incorrect current password." });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);
  const nextTokenVersion = (user.tokenVersion || 1) + 1;
  await db.run("UPDATE users SET passwordHash = ?, tokenVersion = ? WHERE id = ?", [passwordHash, nextTokenVersion, req.user.id]);
  
  const newToken = jwt.sign({ id: req.user.id, role: user.role, tokenVersion: nextTokenVersion }, SECRET_KEY, { expiresIn: "7d" });
  setAuthCookie(res, newToken);
  res.json({ success: true });
});

// User Stats
app.get("/api/users/me/stats", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const tasksCount = await db.get("SELECT COUNT(*) as count FROM tasks WHERE assigneeId = ?", req.user.id);
  const projectsCountQuery = isAdminOrSuperAdmin(req.user) 
    ? "SELECT COUNT(*) as count FROM projects" 
    : "SELECT COUNT(DISTINCT projectId) as count FROM project_members WHERE userId = ?";
  const projectsCount = await db.get(projectsCountQuery, isAdminOrSuperAdmin(req.user) ? [] : [req.user.id]);
  
  const recentActivity = await db.all(`
    SELECT a.*, t.title as taskTitle
    FROM task_activities a
    JOIN tasks t ON a.taskId = t.id
    WHERE a.userId = ?
    ORDER BY a.createdAt DESC
    LIMIT 10
  `, [req.user.id]);

  res.json({
    tasks: tasksCount ? Number(tasksCount.count) : 0,
    projects: projectsCount ? Number(projectsCount.count) : 0,
    recentActivity
  });
});

// Global Search
app.get("/api/search", authenticateToken, async (req: any, res: any) => {
  const query = req.query.q;
  if (!query) return res.json({ projects: [], tasks: [], documents: [], users: [] });

  const userId = req.user.id;
  const userRole = req.user.role;
  const searchTerm = `%${query.toLowerCase()}%`;
  const db = await dbPromise;

  try {
    let projects;
    let tasks;
    let documents;

    if (isAdminOrSuperAdmin(req.user)) {
      projects = await db.all("SELECT id, name as title, description, 'project' as type FROM projects WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ?", [searchTerm, searchTerm]);
      tasks = await db.all("SELECT id, title, description, 'task' as type, projectId FROM tasks WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ?", [searchTerm, searchTerm]);
      documents = await db.all("SELECT id, title, 'document' as type, projectId FROM documents WHERE LOWER(title) LIKE ? OR LOWER(content) LIKE ?", [searchTerm, searchTerm]);
    } else {
      projects = await db.all(`
        SELECT DISTINCT p.id, p.name as title, p.description, 'project' as type 
        FROM projects p
        LEFT JOIN project_members pm ON p.id = pm.projectId
        LEFT JOIN team_projects tp ON p.id = tp.projectId
        LEFT JOIN team_members tm ON tp.teamId = tm.teamId
        LEFT JOIN tasks t ON p.id = t.projectId
        WHERE (p.ownerId = ? OR pm.userId = ? OR tm.userId = ? OR t.assigneeId = ? OR t.creatorId = ?) AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ?)
      `, [userId, userId, userId, userId, userId, searchTerm, searchTerm]);

      tasks = await db.all(`
        SELECT DISTINCT t.id, t.title, t.description, 'task' as type, t.projectId
        FROM tasks t
        LEFT JOIN projects p ON t.projectId = p.id
        LEFT JOIN project_members pm ON p.id = pm.projectId
        LEFT JOIN team_projects tp ON p.id = tp.projectId
        LEFT JOIN team_members tm ON tp.teamId = tm.teamId
        WHERE (p.ownerId = ? OR pm.userId = ? OR tm.userId = ? OR t.creatorId = ? OR t.assigneeId = ?) 
        AND (LOWER(t.title) LIKE ? OR LOWER(t.description) LIKE ?)
      `, [userId, userId, userId, userId, userId, searchTerm, searchTerm]);

      documents = await db.all(`
        SELECT DISTINCT d.id, d.title, 'document' as type, d.projectId
        FROM documents d
        LEFT JOIN projects p ON d.projectId = p.id
        LEFT JOIN project_members pm ON p.id = pm.projectId
        LEFT JOIN team_projects tp ON p.id = tp.projectId
        LEFT JOIN team_members tm ON tp.teamId = tm.teamId
        WHERE (p.ownerId = ? OR pm.userId = ? OR tm.userId = ? OR d.authorId = ?) 
        AND (LOWER(d.title) LIKE ? OR LOWER(d.content) LIKE ?)
      `, [userId, userId, userId, userId, searchTerm, searchTerm]);
    }

    let users: any[] = [];
    if (userRole === 'admin' || userRole === 'super_admin') {
      users = await db.all(`
        SELECT id, name as title, email as description, 'user' as type
        FROM users
        WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ?
      `, [searchTerm, searchTerm]);
    }

    res.json({ projects, tasks, documents, users });
  } catch (e: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get Users (for assigning tasks and team directories)
app.get("/api/users", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const canSeeAll = isAdminOrSuperAdmin(req.user) || await canManageUsers(req.user);
  
  if (canSeeAll) {
    const users = await db.all("SELECT id, name, email, role, skills, rolePrefix, status FROM users");
    return res.json(users.map((u: any) => ({ ...u, skills: u.skills ? JSON.parse(u.skills) : [], rolePrefix: u.rolePrefix || "", status: u.status || "Available" })));
  }

  // Non-admins only get peers who share projects/teams with them (and self), preventing stranger enumeration
  const users = await db.all(`
    SELECT DISTINCT u.id, u.name, u.role, u.skills, u.rolePrefix, u.status, u.email
    FROM users u
    JOIN (
      SELECT ? as peerId
      UNION
      SELECT pm_peer.userId as peerId
      FROM project_members pm_my
      JOIN project_members pm_peer ON pm_peer.projectId = pm_my.projectId
      WHERE pm_my.userId = ?
      UNION
      SELECT p.ownerId as peerId
      FROM project_members pm_my
      JOIN projects p ON p.id = pm_my.projectId
      WHERE pm_my.userId = ?
      UNION
      SELECT pm.userId as peerId
      FROM projects p
      JOIN project_members pm ON pm.projectId = p.id
      WHERE p.ownerId = ?
      UNION
      SELECT tm_peer.userId as peerId
      FROM team_members tm_my
      JOIN team_members tm_peer ON tm_peer.teamId = tm_my.teamId
      WHERE tm_my.userId = ?
    ) peers ON peers.peerId = u.id
    WHERE u.status IS NULL OR (LOWER(u.status) != 'disabled' AND LOWER(u.status) != 'inactive' AND LOWER(u.status) != 'suspended')
  `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);
  
  res.json(users.map((u: any) => ({ ...u, skills: u.skills ? JSON.parse(u.skills) : [], rolePrefix: u.rolePrefix || "", status: u.status || "Available" })));
});

// Admin create user
app.post("/api/users", authenticateToken, async (req: any, res: any) => {
  const allowed = await canManageUsers(req.user);
  if (!allowed) {
    return res.status(403).json({ error: "Only users with user management permissions can create users." });
  }
  let { name, email, password, role, rolePrefix } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Missing required fields." });
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long." });
  }
  if (email) email = email.toLowerCase().trim();

  if (role === "super_admin" && req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Only Super Admin can assign the Super Admin role." });
  }
  
  const db = await dbPromise;
  const existing = await db.get("SELECT * FROM users WHERE email = ? ", email);
  if (existing) return res.status(400).json({ error: "Email already registered." });

  const roleExists = role ? await db.get("SELECT * FROM roles WHERE id = ?", role) : null;
  const finalRole = roleExists ? role : "developer";

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  const id = uuidv4();

  await db.run(
    "INSERT INTO users (id, name, email, passwordHash, role, rolePrefix, status, tokenVersion, authProvider, emailVerified) VALUES (?, ?, ?, ?, ?, ?, 'Available', 1, 'local', 1)",
    [id, name, email, passwordHash, finalRole, rolePrefix || null]
  );
  const newUser = await db.get("SELECT id, name, email, role, rolePrefix, status FROM users WHERE id = ?", id);
  res.json({ ...newUser, rolePrefix: newUser.rolePrefix || "", status: newUser.status || "Available" });
});

// Admin bulk change user roles
app.put("/api/users/bulk/role", authenticateToken, async (req: any, res: any) => {
  const allowed = await canManageUsers(req.user);
  if (!allowed) {
    return res.status(403).json({ error: "Only users with user management permissions can perform bulk actions." });
  }

  const { userIds, role } = req.body;
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "At least one user must be selected." });
  }
  if (!role) {
    return res.status(400).json({ error: "Role is required." });
  }

  if (role === "super_admin" && req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Only Super Admin can assign the Super Admin role." });
  }

  const db = await dbPromise;
  
  // Check if any target user is super_admin
  const placeholders = userIds.map(() => "?").join(",");
  const targetSuperAdmins = await db.all(`SELECT id FROM users WHERE role = 'super_admin' AND id IN (${placeholders})`, userIds);
  if (targetSuperAdmins.length > 0 && req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Only Super Admin can modify Super Admin accounts." });
  }

  const roleExists = await db.get("SELECT * FROM roles WHERE id = ?", role);
  if (!roleExists) {
    return res.status(400).json({ error: "Invalid role. Role does not exist in definitions." });
  }

  await db.run(`UPDATE users SET role = ?, tokenVersion = COALESCE(tokenVersion, 1) + 1 WHERE id IN (${placeholders})`, [role, ...userIds]);

  res.json({ success: true, message: `Successfully updated roles for ${userIds.length} users.` });
});

// Admin update user
app.put("/api/users/:id", authenticateToken, async (req: any, res: any) => {
  const allowed = await canManageUsers(req.user);
  if (!allowed) {
    return res.status(403).json({ error: "Permission denied." });
  }
  const { name, email, role, password, rolePrefix, status } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: "Missing required fields." });
  
  const db = await dbPromise;
  const targetUser = await db.get("SELECT * FROM users WHERE id = ?", req.params.id);
  if (!targetUser) return res.status(404).json({ error: "User not found." });

  if (targetUser.role === "super_admin" && req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Only Super Admin can edit Super Admin accounts." });
  }
  if (role === "super_admin" && req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Only Super Admin can assign the Super Admin role." });
  }

  const existing = await db.get("SELECT * FROM users WHERE email = ? AND id != ?", [email, req.params.id]);
  if (existing) return res.status(400).json({ error: "Email already in use." });

  const roleExists = await db.get("SELECT * FROM roles WHERE id = ?", role);
  if (!roleExists) {
    return res.status(400).json({ error: "Invalid role selected." });
  }

  const statusVal = status || "Available";

  if (password) {
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    await db.run(
      "UPDATE users SET name = ?, email = ?, role = ?, passwordHash = ?, rolePrefix = ?, status = ?, tokenVersion = COALESCE(tokenVersion, 1) + 1 WHERE id = ?",
      [name, email, role, passwordHash, rolePrefix || null, statusVal, req.params.id]
    );
  } else {
    const shouldInvalidate = (statusVal.toLowerCase() === 'disabled' || statusVal.toLowerCase() === 'suspended' || role !== targetUser.role);
    if (shouldInvalidate) {
      await db.run(
        "UPDATE users SET name = ?, email = ?, role = ?, rolePrefix = ?, status = ?, tokenVersion = COALESCE(tokenVersion, 1) + 1 WHERE id = ?",
        [name, email, role, rolePrefix || null, statusVal, req.params.id]
      );
    } else {
      await db.run(
        "UPDATE users SET name = ?, email = ?, role = ?, rolePrefix = ?, status = ? WHERE id = ?",
        [name, email, role, rolePrefix || null, statusVal, req.params.id]
      );
    }
  }
  const updatedUser = await db.get("SELECT id, name, email, role, rolePrefix, status FROM users WHERE id = ?", req.params.id);
  res.json({ ...updatedUser, rolePrefix: updatedUser.rolePrefix || "", status: updatedUser.status || "Available" });
});

// Admin delete user
app.delete("/api/users/:id", authenticateToken, async (req: any, res: any) => {
  const allowed = await canManageUsers(req.user);
  if (!allowed) {
    return res.status(403).json({ error: "Permission denied." });
  }
  
  const db = await dbPromise;
  const targetUser = await db.get("SELECT * FROM users WHERE id = ?", req.params.id);
  if (!targetUser) return res.status(404).json({ error: "User not found." });

  if (targetUser.role === "super_admin" && req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Only Super Admin can delete Super Admin accounts." });
  }

  if (req.user.id === req.params.id) {
     return res.status(400).json({ error: "Cannot delete your own account." });
  }

  await db.run("DELETE FROM users WHERE id = ?", req.params.id);
  await db.run("DELETE FROM project_members WHERE userId = ?", req.params.id);
  await db.run("DELETE FROM team_members WHERE userId = ?", req.params.id);
  await db.run("DELETE FROM password_resets WHERE userId = ?", req.params.id);
  await db.run("UPDATE tasks SET assigneeId = NULL WHERE assigneeId = ?", req.params.id);
  res.json({ success: true });
});

// Admin change user role
app.put("/api/users/:id/role", authenticateToken, async (req: any, res: any) => {
  const allowed = await canManageUsers(req.user);
  if (!allowed) {
    return res.status(403).json({ error: "Permission denied." });
  }

  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ error: "Role is required." });
  }

  if (role === "super_admin" && req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Only Super Admin can assign the Super Admin role." });
  }

  const db = await dbPromise;
  const targetUser = await db.get("SELECT * FROM users WHERE id = ?", req.params.id);
  if (!targetUser) return res.status(404).json({ error: "User not found." });

  if (targetUser.role === "super_admin" && req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Only Super Admin can edit Super Admin accounts." });
  }

  const roleExists = await db.get("SELECT * FROM roles WHERE id = ?", role);
  if (!roleExists) {
    return res.status(400).json({ error: "Invalid role. Role does not exist in definitions." });
  }

  await db.run("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
  const updatedUser = await db.get("SELECT id, name, email, role FROM users WHERE id = ?", req.params.id);
  res.json(updatedUser);
});

// Roles API endpoints
const VALID_PERMS = [
  "manage_users",
  "manage_roles",
  "manage_projects",
  "manage_teams",
  "reset_database",
  "create_tasks",
  "edit_all_tasks",
  "delete_tasks",
] as const;

function sanitizeAndValidatePermissions(permissions: any, userRole: string): { valid: boolean; perms: Record<string, boolean>; error?: string } {
  let inputPerms: any = {};
  if (permissions !== undefined && permissions !== null) {
    try {
      inputPerms = typeof permissions === "string" ? JSON.parse(permissions) : (typeof permissions === "object" ? permissions : {});
    } catch {
      inputPerms = {};
    }
  }
  const parsedPerms: Record<string, boolean> = {};
  for (const key of VALID_PERMS) {
    if (inputPerms[key] === true) {
      if ((key === "manage_users" || key === "manage_roles" || key === "reset_database") && userRole !== "super_admin") {
        return { valid: false, perms: {}, error: "Only Super Admin can grant manage_users, manage_roles, or reset_database." };
      }
      parsedPerms[key] = true;
    }
  }
  return { valid: true, perms: parsedPerms };
}

// Get all roles
app.get("/api/roles", authenticateToken, async (req: any, res: any) => {
  try {
    const allowed = await canManageRoles(req.user) || isAdminOrSuperAdmin(req.user);
    if (!allowed) {
      return res.status(403).json({ error: "Only admins or role managers can view roles." });
    }
    const db = await dbPromise;
    const roles = await db.all("SELECT * FROM roles ORDER BY is_custom ASC, name ASC");
    res.json(roles);
  } catch (e: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Create custom role
app.post("/api/roles", authenticateToken, async (req: any, res: any) => {
  try {
    const allowed = await canManageRoles(req.user);
    if (!allowed) {
      return res.status(403).json({ error: "Only users with role management permissions can create custom roles." });
    }
    let { id, name, description, permissions } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: "Role ID and Name are required." });
    }
    id = id.toLowerCase().replace(/[^a-z0-9_-]/g, "").trim();
    if (id === "") {
      return res.status(400).json({ error: "Invalid Role ID. Must be alphanumeric." });
    }

    const BUILT_IN_ROLES = ["super_admin", "admin", "manager", "developer"];
    if (BUILT_IN_ROLES.includes(id)) {
      return res.status(400).json({ error: "Cannot create a role with a reserved system role ID." });
    }
    
    const db = await dbPromise;
    const existing = await db.get("SELECT * FROM roles WHERE id = ?", id);
    if (existing) {
      return res.status(400).json({ error: "A role with this ID already exists." });
    }

    const permCheck = sanitizeAndValidatePermissions(permissions, req.user.role);
    if (!permCheck.valid) {
      return res.status(403).json({ error: permCheck.error });
    }

    const permsStr = JSON.stringify(permCheck.perms);

    await db.run(
      "INSERT INTO roles (id, name, description, is_custom, permissions) VALUES (?, ?, ?, 1, ?)",
      [id, name, description || "", permsStr]
    );

    const newRole = await db.get("SELECT * FROM roles WHERE id = ?", id);
    res.json(newRole);
  } catch (e: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update role permissions and settings
app.put("/api/roles/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    if (id === "super_admin") {
      return res.status(400).json({ error: "Super Admin role permissions are immutable." });
    }
    const BUILT_IN_ROLES = ["admin", "manager", "developer"];
    if (BUILT_IN_ROLES.includes(id) && req.user.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can modify built-in role permissions." });
    }

    const allowed = await canManageRoles(req.user);
    if (!allowed) {
      return res.status(403).json({ error: "Only users with role management permissions can update roles." });
    }

    const { name, description, permissions } = req.body;
    
    let permsToSave: string | undefined = undefined;
    if (permissions !== undefined) {
      const permCheck = sanitizeAndValidatePermissions(permissions, req.user.role);
      if (!permCheck.valid) {
        return res.status(403).json({ error: permCheck.error });
      }
      permsToSave = JSON.stringify(permCheck.perms);
    }

    const db = await dbPromise;
    const role = await db.get("SELECT * FROM roles WHERE id = ?", id);
    if (!role) {
      return res.status(404).json({ error: "Role not found." });
    }

    let finalName = role.name;
    if (role.is_custom === 1) {
      if (!name) {
        return res.status(400).json({ error: "Role Name is required." });
      }
      finalName = name;
    }

    const finalPerms = permsToSave !== undefined ? permsToSave : (role.permissions || "{}");

    await db.run(
      "UPDATE roles SET name = ?, description = ?, permissions = ? WHERE id = ?",
      [finalName, description !== undefined ? description : role.description, finalPerms, id]
    );

    const updatedRole = await db.get("SELECT * FROM roles WHERE id = ?", id);
    res.json(updatedRole);
  } catch (e: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete custom role
app.delete("/api/roles/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const allowed = await canManageRoles(req.user);
    if (!allowed) {
      return res.status(403).json({ error: "Only users with role management permissions can delete roles." });
    }
    const { id } = req.params;

    const db = await dbPromise;
    const role = await db.get("SELECT * FROM roles WHERE id = ?", id);
    if (!role) {
      return res.status(404).json({ error: "Role not found." });
    }
    if (role.is_custom !== 1) {
      return res.status(400).json({ error: "Default roles cannot be deleted." });
    }

    // Delete the role
    await db.run("DELETE FROM roles WHERE id = ?", id);

    // Reassign any users who had this role to 'developer' as default
    await db.run("UPDATE users SET role = 'developer' WHERE role = ?", id);

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get Settings
app.get("/api/settings", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const settings = await db.all("SELECT * FROM settings");
  const settingsObj = settings.reduce((acc: any, curr: any) => {
    acc[curr.key] = curr.value || "";
    return acc;
  }, {});
  res.json(settingsObj);
});

// Update Settings
app.put("/api/settings", authenticateToken, async (req: any, res: any) => {
  if (!isAdminOrSuperAdmin(req.user)) {
    return res.status(403).json({ error: "Only admins can change settings." });
  }

  const db = await dbPromise;
  const keys = Object.keys(req.body);
  for (const key of keys) {
    if (!/^[a-zA-Z0-9_]{1,64}$/.test(key)) continue;
    const value = req.body[key];
    if (typeof value !== 'string') continue;
    if (db.isPg) {
      await db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [key, value]);
    } else {
      await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
    }
  }
  
  const settings = await db.all("SELECT * FROM settings");
  const settingsObj = settings.reduce((acc: any, curr: any) => {
    acc[curr.key] = curr.value || "";
    return acc;
  }, {});
  res.json(settingsObj);
});

// Get Tasks
app.get("/api/tasks", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  
  let query = `
    SELECT DISTINCT t.* 
    FROM tasks t
    LEFT JOIN projects p ON t.projectId = p.id
    LEFT JOIN project_members pm ON p.id = pm.projectId
    LEFT JOIN team_projects tp ON p.id = tp.projectId
    LEFT JOIN team_members tm ON tp.teamId = tm.teamId
  `;
  
  const conditions = [];
  const queryParams = [];
  
  if (!isAdminOrSuperAdmin(req.user)) {
    conditions.push(`(p.ownerId = ? OR pm.userId = ? OR tm.userId = ? OR t.assigneeId = ? OR t.creatorId = ?)`);
    queryParams.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
  }
  
  if (req.query.projectId) {
    conditions.push("t.projectId = ?");
    queryParams.push(req.query.projectId);
  }
  
  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  const tasks = await db.all(query, queryParams);
  
  if (tasks.length > 0) {
    const taskIds = tasks.map((t: any) => t.id);
    const placeholders = taskIds.map(() => '?').join(',');
    const deps = await db.all(`SELECT * FROM task_dependencies WHERE taskId IN (${placeholders})`, taskIds);
    tasks.forEach((t: any) => {
      t.dependencies = deps.filter((d: any) => d.taskId === t.id).map((d: any) => d.blockedByTaskId);
    });
  } else {
    tasks.forEach((t: any) => {
      t.dependencies = [];
    });
  }
  
  res.json(tasks);
});

// Logs activity
async function logActivity(db: any, taskId: string, userId: string, action: string) {
  const activityId = uuidv4();
  await db.run(
    "INSERT INTO task_activities (id, taskId, userId, action, createdAt) VALUES (?, ?, ?, ?, ?)",
    [activityId, taskId, userId, action, new Date().toISOString()]
  );
}

// Get Task Details (Comments and Activities)
app.get("/api/tasks/:id/details", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const taskId = req.params.id;
  const access = await checkTaskAccess(db, taskId, req.user);
  if (!access.allowed) {
    return res.status(403).json({ error: "Access denied to task details." });
  }

  const comments = await db.all("SELECT * FROM task_comments WHERE taskId = ? ORDER BY createdAt ASC", taskId);
  const activities = await db.all("SELECT * FROM task_activities WHERE taskId = ? ORDER BY createdAt DESC", taskId);
  res.json({ comments, activities });
});

// Create Comment
app.post("/api/tasks/:id/comments", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const taskId = req.params.id;
  const access = await checkTaskAccess(db, taskId, req.user);
  if (!access.allowed) {
    return res.status(403).json({ error: "Access denied to comment on this task." });
  }

  if (!req.body.content || typeof req.body.content !== 'string' || req.body.content.trim() === '') {
    return res.status(400).json({ error: "Comment content is required." });
  }

  const commentId = uuidv4();
  await db.run(
    "INSERT INTO task_comments (id, taskId, userId, content, createdAt) VALUES (?, ?, ?, ?, ?)",
    [commentId, taskId, req.user.id, req.body.content, new Date().toISOString()]
  );
  await logActivity(db, taskId, req.user.id, `commented: ${req.body.content.substring(0, 50)}...`);
  const comment = await db.get("SELECT * FROM task_comments WHERE id = ?", commentId);
  res.json(comment);
});

// Edit Comment
app.put("/api/tasks/:taskId/comments/:commentId", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { taskId, commentId } = req.params;
  const { content } = req.body;
  
  const access = await checkTaskAccess(db, taskId, req.user);
  if (!access.allowed) {
    return res.status(403).json({ error: "Access denied to this task." });
  }

  const comment = await db.get("SELECT * FROM task_comments WHERE id = ? AND taskId = ?", [commentId, taskId]);
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.userId !== req.user.id && !isAdminOrSuperAdmin(req.user)) {
    return res.status(403).json({ error: "Unauthorized to edit this comment" });
  }

  await db.run("UPDATE task_comments SET content = ? WHERE id = ?", [content, commentId]);
  const updatedComment = await db.get("SELECT * FROM task_comments WHERE id = ?", commentId);
  res.json(updatedComment);
});

// Delete Comment
app.delete("/api/tasks/:taskId/comments/:commentId", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { taskId, commentId } = req.params;

  const access = await checkTaskAccess(db, taskId, req.user);
  if (!access.allowed) {
    return res.status(403).json({ error: "Access denied to this task." });
  }

  const comment = await db.get("SELECT * FROM task_comments WHERE id = ? AND taskId = ?", [commentId, taskId]);
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.userId !== req.user.id && !isAdminOrSuperAdmin(req.user)) {
    return res.status(403).json({ error: "Unauthorized to delete this comment" });
  }

  await db.run("DELETE FROM task_comments WHERE id = ?", commentId);
  res.json({ success: true });
});

// Create Task
app.post("/api/tasks", authenticateToken, async (req: any, res: any) => {
  const isAllowed = await hasPermission(req.user, "create_tasks");
  if (!isAllowed) {
    return res.status(403).json({ error: "You do not have permission to create tasks." });
  }

  if (!req.body.projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }
  if (!req.body.title || typeof req.body.title !== 'string' || req.body.title.trim() === '') {
    return res.status(400).json({ error: "Task title is required" });
  }

  const db = await dbPromise;

  const project = await db.get("SELECT ownerId, projectKey, taskCounter FROM projects WHERE id = ?", req.body.projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const hasProjectAccess = await checkProjectAccess(db, req.body.projectId, req.user);
  if (!hasProjectAccess) {
     return res.status(403).json({ error: "You must have access to the project to create tasks in it." });
  }
  
  if (req.body.parentId) {
    const parentTask = await db.get("SELECT id, projectId FROM tasks WHERE id = ?", req.body.parentId);
    if (!parentTask) {
      return res.status(400).json({ error: "Parent task does not exist." });
    }
    if (String(parentTask.projectId) !== String(req.body.projectId)) {
      return res.status(400).json({ error: "Parent task must belong to the same project." });
    }
  }

  const taskStatus = req.body.status || "todo";
  if (typeof taskStatus !== 'string' || taskStatus.trim() === '' || taskStatus.length > 50) {
    return res.status(400).json({ error: "Invalid task status." });
  }

  if (req.body.projectId) {
    const colRow = await db.get("SELECT columnsJson FROM project_columns WHERE projectId = ?", req.body.projectId);
    if (colRow && colRow.columnsJson) {
      try {
        const parsedCols = JSON.parse(colRow.columnsJson);
        if (Array.isArray(parsedCols) && parsedCols.length > 0) {
          const validIds = new Set(parsedCols.map((c: any) => c.id || c.name));
          if (!validIds.has(taskStatus)) {
            return res.status(400).json({ error: "Specified status is not a valid column in this project." });
          }
        }
      } catch (e) {
        // fallback
      }
    }
  }

  let branchName = req.body.branchName;
  if (!branchName) {
    if (project && project.projectKey) {
        const updatedProj = await db.get("UPDATE projects SET taskCounter = COALESCE(taskCounter, 0) + 1 WHERE id = ? RETURNING taskCounter", [req.body.projectId]);
        const nextCount = updatedProj ? updatedProj.taskCounter : 1;
        branchName = `${project.projectKey}-${nextCount}`;
    }
  } else {
    const taskNum = extractTaskNumber(branchName);
    if (taskNum !== null && taskNum > (project.taskCounter || 0)) {
        await db.run("UPDATE projects SET taskCounter = ? WHERE id = ?", [taskNum, req.body.projectId]);
    }
  }

  const newTask: Task = {
    id: uuidv4(),
    title: req.body.title,
    description: req.body.description || "",
    status: req.body.status || "todo",
    priority: req.body.priority || "medium",
    deadline: req.body.deadline || new Date().toISOString(),
    assigneeId: req.body.assigneeId || null,
    creatorId: req.user.id,
    branchName: branchName || null,
    parentId: req.body.parentId || null,
    projectId: req.body.projectId || null,
    milestoneId: req.body.milestoneId || null,
    createdAt: new Date().toISOString(),
    orderIndex: req.body.orderIndex !== undefined ? req.body.orderIndex : Date.now(),
  };

  await db.run(
    "INSERT INTO tasks (id, title, description, status, priority, deadline, assigneeId, creatorId, branchName, parentId, projectId, milestoneId, createdAt, orderIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [newTask.id, newTask.title, newTask.description, newTask.status, newTask.priority, newTask.deadline, newTask.assigneeId, newTask.creatorId, newTask.branchName, newTask.parentId, newTask.projectId, newTask.milestoneId, newTask.createdAt, newTask.orderIndex]
  );
  
  if (req.body.dependencies && Array.isArray(req.body.dependencies)) {
    for (const depId of req.body.dependencies) {
      if (!depId || depId === newTask.id) continue;
      const depTask = await db.get("SELECT id, projectId FROM tasks WHERE id = ?", depId);
      if (depTask && depTask.projectId === newTask.projectId) {
        await db.run("INSERT INTO task_dependencies (taskId, blockedByTaskId) VALUES (?, ?)", [newTask.id, depId]);
      }
    }
  }

  if (newTask.parentId) {
    const parentTask = await db.get("SELECT * FROM tasks WHERE id = ? AND projectId = ?", [newTask.parentId, newTask.projectId]);
    if (parentTask) {
       const subtasks = await db.all("SELECT status FROM tasks WHERE parentId = ? AND projectId = ?", [newTask.parentId, newTask.projectId]);
       if (subtasks.length > 0) {
           const allDone = subtasks.every((st: any) => st.status === 'done');
           if (allDone && parentTask.status !== 'done') {
               await db.run("UPDATE tasks SET status = 'done' WHERE id = ? AND projectId = ?", [newTask.parentId, newTask.projectId]);
           } else if (!allDone && parentTask.status === 'done') {
               await db.run("UPDATE tasks SET status = 'in_progress' WHERE id = ? AND projectId = ?", [newTask.parentId, newTask.projectId]);
           }
       }
    }
  }

  await logActivity(db, newTask.id, req.user.id, "created task");

  res.json(newTask);
});

// Update Task
app.put("/api/tasks/:id", authenticateToken, async (req: any, res: any) => {
  if (req.body.title !== undefined && (typeof req.body.title !== 'string' || req.body.title.trim() === '')) {
    return res.status(400).json({ error: "Task title cannot be empty" });
  }

  const db = await dbPromise;
  const task = await db.get("SELECT * FROM tasks WHERE id = ?", req.params.id);
  if (!task) return res.sendStatus(404);

  if (task.projectId) {
    const hasProjectAccess = await checkProjectAccess(db, task.projectId, req.user);
    if (!hasProjectAccess) {
      return res.status(403).json({ error: "Access denied to the project containing this task." });
    }
  }

  let canManageTask = false;
  if (task.projectId) {
    canManageTask = await isProjectAdminOrOwner(db, task.projectId, req.user);
    if (!canManageTask) {
      const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [task.projectId, req.user.id]);
      if (pm && pm.role !== 'viewer') {
        canManageTask = await hasPermission(req.user, "edit_all_tasks");
      }
    }
  } else {
    canManageTask = isAdminOrSuperAdmin(req.user);
  }

  if (!canManageTask) {
    if (task.assigneeId !== req.user.id && task.creatorId !== req.user.id) {
      return res.status(403).json({ error: "Only admins, managers, the assigned contributor, or the task creator can update this task." });
    }

    // Check if projectId is changed
    if (req.body.projectId !== undefined && String(req.body.projectId) !== String(task.projectId)) {
      return res.status(403).json({ error: "You are not allowed to change the project." });
    }

    // Check if assigneeId is changed
    if (req.body.assigneeId !== undefined && (req.body.assigneeId || null) !== (task.assigneeId || null)) {
      return res.status(403).json({ error: "You are not allowed to change the assignee." });
    }

    // Check if priority is changed
    if (req.body.priority !== undefined && req.body.priority !== task.priority) {
      return res.status(403).json({ error: "You are not allowed to change the priority." });
    }

    // Check if deadline is changed
    if (req.body.deadline !== undefined && req.body.deadline !== task.deadline) {
      return res.status(403).json({ error: "You are not allowed to change the deadline." });
    }

    // Check if milestoneId is changed
    if (req.body.milestoneId !== undefined && (req.body.milestoneId || null) !== (task.milestoneId || null)) {
      return res.status(403).json({ error: "You are not allowed to change the milestone." });
    }

    // Check if parentId is changed
    if (req.body.parentId !== undefined && (req.body.parentId || null) !== (task.parentId || null)) {
      return res.status(403).json({ error: "You are not allowed to change the parent task." });
    }

    // Check if branchName is changed
    if (req.body.branchName !== undefined && (req.body.branchName || null) !== (task.branchName || null)) {
      return res.status(403).json({ error: "You are not allowed to change the branch name." });
    }

    // Check if dependencies are changed
    if (req.body.dependencies !== undefined && Array.isArray(req.body.dependencies)) {
      const currentDepsRows = await db.all("SELECT blockedByTaskId FROM task_dependencies WHERE taskId = ?", task.id);
      const currentDepIds = currentDepsRows.map((r: any) => r.blockedByTaskId).sort();
      const newDepIds = [...req.body.dependencies].sort();
      if (JSON.stringify(currentDepIds) !== JSON.stringify(newDepIds)) {
        return res.status(403).json({ error: "You are not allowed to change dependencies." });
      }
    }
  }

  if (!canManageTask && task.creatorId !== req.user.id && task.assigneeId !== req.user.id) {
    return res.status(403).json({ error: "Only authorized roles, task creators, or assignees can edit tasks." });
  }

  if (req.body.projectId === null || req.body.projectId === "") {
    return res.status(400).json({ error: "projectId cannot be removed from a task" });
  }

  if (req.body.projectId !== undefined && String(req.body.projectId) !== String(task.projectId)) {
    const hasDestAccess = await checkProjectAccess(db, req.body.projectId, req.user);
    if (!hasDestAccess) {
      return res.status(403).json({ error: "You do not have access to the destination project." });
    }
  }
  
  if (req.body.parentId !== undefined && req.body.parentId !== null && req.body.parentId !== "") {
    if (req.body.parentId === task.id) {
      return res.status(400).json({ error: "A task cannot be its own parent." });
    }
    const targetProjectId = req.body.projectId !== undefined ? req.body.projectId : task.projectId;
    const parentTask = await db.get("SELECT id, projectId FROM tasks WHERE id = ?", req.body.parentId);
    if (!parentTask) {
      return res.status(400).json({ error: "Parent task does not exist." });
    }
    if (String(parentTask.projectId) !== String(targetProjectId)) {
      return res.status(400).json({ error: "Parent task must belong to the same project." });
    }
  }

  if (req.body.status !== undefined) {
    if (typeof req.body.status !== 'string' || req.body.status.trim() === '' || req.body.status.length > 50) {
      return res.status(400).json({ error: "Invalid task status." });
    }
    const targetProjId = req.body.projectId !== undefined ? req.body.projectId : task.projectId;
    if (targetProjId) {
      const colRow = await db.get("SELECT columnsJson FROM project_columns WHERE projectId = ?", targetProjId);
      if (colRow && colRow.columnsJson) {
        try {
          const parsedCols = JSON.parse(colRow.columnsJson);
          if (Array.isArray(parsedCols) && parsedCols.length > 0) {
            const validIds = new Set(parsedCols.map((c: any) => c.id || c.name));
            if (!validIds.has(req.body.status)) {
              return res.status(400).json({ error: "Specified status is not a valid column in this project." });
            }
          }
        } catch (e) {
          // ignore column json parse error fallback
        }
      }
    }
  }

  const updated: Task = {
    id: task.id,
    title: req.body.title !== undefined ? String(req.body.title).trim() : task.title,
    description: req.body.description !== undefined ? String(req.body.description || '') : task.description,
    status: req.body.status !== undefined ? String(req.body.status) : task.status,
    priority: req.body.priority !== undefined ? String(req.body.priority) : task.priority,
    deadline: req.body.deadline !== undefined ? String(req.body.deadline) : task.deadline,
    assigneeId: req.body.assigneeId !== undefined ? (req.body.assigneeId || null) : task.assigneeId,
    creatorId: task.creatorId,
    branchName: req.body.branchName !== undefined ? (req.body.branchName || null) : task.branchName,
    parentId: req.body.parentId !== undefined ? (req.body.parentId || null) : task.parentId,
    projectId: req.body.projectId !== undefined ? (req.body.projectId || null) : task.projectId,
    milestoneId: req.body.milestoneId !== undefined ? (req.body.milestoneId || null) : task.milestoneId,
    createdAt: task.createdAt,
    orderIndex: req.body.orderIndex !== undefined ? Number(req.body.orderIndex) : task.orderIndex,
    prUrl: task.prUrl,
    prStatus: task.prStatus
  };

  if (updated.status === 'done') {
    // Check if there are pending dependencies
    let depIds = [];
    if (req.body.dependencies !== undefined && Array.isArray(req.body.dependencies)) {
       depIds = req.body.dependencies;
    } else {
       const rows = await db.all("SELECT blockedByTaskId FROM task_dependencies WHERE taskId = ?", updated.id);
       depIds = rows.map((r: any) => r.blockedByTaskId);
    }
    
    if (depIds.length > 0) {
      const placeholders = depIds.map(() => '?').join(',');
      const pendingDeps = await db.all(`SELECT id FROM tasks WHERE id IN (${placeholders}) AND status != 'done'`, depIds);
      if (pendingDeps.length > 0) {
        return res.status(400).json({ error: `Cannot mark task as done. ${pendingDeps.length} dependencies are still pending.` });
      }
    }
  }

  await db.run(
    "UPDATE tasks SET title=?, description=?, status=?, priority=?, deadline=?, assigneeId=?, branchName=?, parentId=?, projectId=?, milestoneId=?, orderIndex=? WHERE id=?",
    [updated.title, updated.description, updated.status, updated.priority, updated.deadline, updated.assigneeId, updated.branchName, updated.parentId, updated.projectId, updated.milestoneId, updated.orderIndex !== undefined ? updated.orderIndex : task.orderIndex, updated.id]
  );

  if (updated.branchName && updated.projectId) {
    const taskNum = extractTaskNumber(updated.branchName);
    if (taskNum !== null) {
      const proj = await db.get("SELECT taskCounter FROM projects WHERE id = ?", updated.projectId);
      if (proj && taskNum > (proj.taskCounter || 0)) {
        await db.run("UPDATE projects SET taskCounter = ? WHERE id = ?", [taskNum, updated.projectId]);
      }
    }
  }
  
  if (req.body.dependencies !== undefined && Array.isArray(req.body.dependencies)) {
    await db.run("DELETE FROM task_dependencies WHERE taskId = ?", updated.id);
    for (const depId of req.body.dependencies) {
      if (!depId || depId === updated.id) continue;
      const depTask = await db.get("SELECT id, projectId FROM tasks WHERE id = ?", depId);
      if (depTask && depTask.projectId === updated.projectId) {
        await db.run("INSERT INTO task_dependencies (taskId, blockedByTaskId) VALUES (?, ?)", [updated.id, depId]);
      }
    }
  }

  if (updated.parentId) {
    const parentTask = await db.get("SELECT * FROM tasks WHERE id = ? AND projectId = ?", [updated.parentId, updated.projectId]);
    if (parentTask) {
       const subtasks = await db.all("SELECT status FROM tasks WHERE parentId = ? AND projectId = ?", [updated.parentId, updated.projectId]);
       if (subtasks.length > 0) {
           const allDone = subtasks.every((st: any) => st.status === 'done');
           if (allDone && parentTask.status !== 'done') {
               await db.run("UPDATE tasks SET status = 'done' WHERE id = ? AND projectId = ?", [updated.parentId, updated.projectId]);
           } else if (!allDone && parentTask.status === 'done') {
               await db.run("UPDATE tasks SET status = 'in_progress' WHERE id = ? AND projectId = ?", [updated.parentId, updated.projectId]);
           }
       }
    }
  }

  const changes: string[] = [];
  if (task.status !== updated.status) {
    changes.push(`status to ${updated.status}`);
  }
  if (task.assigneeId !== updated.assigneeId) {
    if (updated.assigneeId) {
       const newAssignee = await db.get("SELECT name FROM users WHERE id = ?", updated.assigneeId);
       changes.push(`assigned to ${newAssignee ? newAssignee.name : 'Unknown'}`);
    } else {
       changes.push(`unassigned`);
    }
  }
  if (task.priority !== updated.priority) {
    changes.push(`priority to ${updated.priority}`);
  }
  if (task.title !== updated.title) {
    changes.push(`title`);
  }
  
  let actionStr = "updated task";
  if (changes.length > 0) {
    actionStr = `Updated ${changes.join(', ')}`;
  }
  await logActivity(db, updated.id, req.user.id, actionStr);

  res.json(updated);
});

// Delete Task
app.delete("/api/tasks/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const task = await db.get("SELECT * FROM tasks WHERE id = ?", req.params.id);
  if (!task) return res.sendStatus(404);

  if (task.projectId) {
    const hasProjectAccess = await checkProjectAccess(db, task.projectId, req.user);
    if (!hasProjectAccess) {
      return res.status(403).json({ error: "Access denied to the project containing this task." });
    }
  }

  let canManageTask = false;
  if (task.projectId) {
    canManageTask = await isProjectAdminOrOwner(db, task.projectId, req.user);
    if (!canManageTask) {
      const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [task.projectId, req.user.id]);
      if (pm && pm.role !== 'viewer') {
        canManageTask = await hasPermission(req.user, "delete_tasks");
      }
    }
  } else {
    canManageTask = isAdminOrSuperAdmin(req.user);
  }

  if (!canManageTask && task.creatorId !== req.user.id) {
    return res.status(403).json({ error: "Only project admins, owners, or the task creator can delete this task." });
  }

  // Get subtasks to cascade delete relations
  const subtasks = await db.all("SELECT id FROM tasks WHERE parentId = ?", req.params.id);
  const allTargetIds = [req.params.id, ...subtasks.map((st: any) => st.id)];

  for (const tid of allTargetIds) {
    await db.run("DELETE FROM task_dependencies WHERE taskId = ? OR blockedByTaskId = ?", [tid, tid]);
    await db.run("DELETE FROM task_comments WHERE taskId = ?", tid);
    await db.run("DELETE FROM task_activities WHERE taskId = ?", tid);
  }

  await db.run("DELETE FROM tasks WHERE parentId = ?", req.params.id);
  await db.run("DELETE FROM tasks WHERE id = ?", req.params.id);
  
  if (task.parentId) {
    const parentTask = await db.get("SELECT * FROM tasks WHERE id = ? AND projectId = ?", [task.parentId, task.projectId]);
    if (parentTask) {
       const remainingSubtasks = await db.all("SELECT status FROM tasks WHERE parentId = ? AND projectId = ?", [task.parentId, task.projectId]);
       if (remainingSubtasks.length > 0) {
           const allDone = remainingSubtasks.every((st: any) => st.status === 'done');
           if (allDone && parentTask.status !== 'done') {
               await db.run("UPDATE tasks SET status = 'done' WHERE id = ? AND projectId = ?", [task.parentId, task.projectId]);
           } else if (!allDone && parentTask.status === 'done') {
               await db.run("UPDATE tasks SET status = 'in_progress' WHERE id = ? AND projectId = ?", [task.parentId, task.projectId]);
           }
       }
    }
  }

  res.json({ success: true });
});

// Generate Branch Name
app.post("/api/tasks/branch", authenticateToken, async (req: any, res: any) => {
  try {
    const { title, type, projectId } = req.body;
    let projectKey = "";
    
    if (projectId) {
      const db = await dbPromise;
      if (!(await checkProjectAccess(db, projectId, req.user))) {
        return res.status(403).json({ error: "Access denied to this project." });
      }
      const project = await db.get("SELECT projectKey, taskCounter FROM projects WHERE id = ?", projectId);
      if (project && project.projectKey) {
        const nextNum = (project.taskCounter || 0) + 1;
        projectKey = `${project.projectKey}-${nextNum}`;
      }
    }
    
    if (!projectKey) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const randomLetters = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const nextNumber = Math.floor(Math.random() * 90000) + 10000;
      projectKey = `${randomLetters}-${nextNumber}`;
    }
    
    let branchName = projectKey;
    
    res.json({ branchName });
  } catch (error: any) {
    console.error("Generate branch error:", error);
    res.status(500).json({ error: "Failed to generate branch name." });
  }
});


// Projects APIs
app.get("/api/projects/:id/workload", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied to project workload." });
  }
  const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  if (!project) return res.sendStatus(404);

  const tasks = await db.all("SELECT id, status, assigneeId FROM tasks WHERE projectId = ?", req.params.id);
  const assigneeIds = Array.from(new Set(tasks.map((t: any) => t.assigneeId).filter(Boolean)));
  let users: any[] = [];
  if (assigneeIds.length > 0) {
    const placeholders = assigneeIds.map(() => '?').join(',');
    users = await db.all(`SELECT id, name, email FROM users WHERE id IN (${placeholders})`, assigneeIds);
  }

  const workload: Record<string, any> = {};
  
  tasks.forEach((task: any) => {
    if (!task.assigneeId) return; 
    if (!workload[task.assigneeId]) {
      const user = users.find(u => u.id === task.assigneeId);
      workload[task.assigneeId] = {
        user: user || { id: task.assigneeId, name: 'Unknown User', email: '' },
        total: 0,
        statuses: {}
      };
    }
    workload[task.assigneeId].total++;
    const s = task.status || 'todo';
    if (!workload[task.assigneeId].statuses[s]) {
      workload[task.assigneeId].statuses[s] = 0;
    }
    workload[task.assigneeId].statuses[s]++;
  });

  const result = Object.values(workload).map((w: any) => {
    // For legacy 'done' logic calculation where custom boards might use something else, we take 'done' if present, otherwise 0
    const doneCount = w.statuses['done'] || 0;
    return {
      ...w,
      completionPercentage: w.total > 0 ? Math.round((doneCount / w.total) * 100) : 0
    };
  }).sort((a: any, b: any) => b.total - a.total);

  res.json(result);
});

const sanitizeProject = (project: any) => {
  if (!project) return project;
  const sanitized = { ...project };
  if (sanitized.repoToken && sanitized.repoToken.trim() !== '') {
    sanitized.repoToken = '••••••••';
  } else {
    sanitized.repoToken = '';
  }
  return sanitized;
};

app.get("/api/projects", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  let projects;
  if (isAdminOrSuperAdmin(req.user)) {
    projects = await db.all("SELECT * FROM projects");
  } else {
    projects = await db.all(`
      SELECT DISTINCT p.* 
      FROM projects p 
      LEFT JOIN project_members pm ON p.id = pm.projectId 
      LEFT JOIN team_projects tp ON p.id = tp.projectId 
      LEFT JOIN team_members tm ON tp.teamId = tm.teamId 
      LEFT JOIN tasks t ON p.id = t.projectId 
      WHERE p.ownerId = ? 
         OR pm.userId = ? 
         OR tm.userId = ? 
         OR t.assigneeId = ?
         OR t.creatorId = ?
    `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);
  }
  res.json(projects.map(sanitizeProject));
});

app.get("/api/projects/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const hasAccess = await checkProjectAccess(db, req.params.id, req.user);
  if (!hasAccess) {
    return res.status(403).json({ error: "Access denied to project." });
  }

  res.json(sanitizeProject(project));
});

app.post("/api/projects", authenticateToken, async (req: any, res: any) => {
  const canCreate = await hasPermission(req.user, "manage_projects") || isAdminOrSuperAdmin(req.user);
  if (!canCreate) {
    return res.status(403).json({ error: "You do not have permission to create projects." });
  }

  const db = await dbPromise;

  const { name, description, projectKey: customProjectKey } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: "Project name is required" });
  }

  const projectId = uuidv4();
  
  let projectKey = customProjectKey ? customProjectKey.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase() : null;
  
  if (!projectKey) {
    if (name) {
      projectKey = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
    }
    if (!projectKey || projectKey.length < 2) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      projectKey = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }
  }

  try {
    if (db.isPg) {
      await db.run(
        "INSERT INTO projects (id, name, description, ownerId, projectKey, taskCounter, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [projectId, name, description || "", req.user.id, projectKey, 0, new Date().toISOString()]
      );
      await db.run(
        "INSERT INTO project_members (projectId, userId, role, joinedAt) VALUES (?, ?, 'admin', ?) ON CONFLICT (projectId, userId) DO NOTHING",
        [projectId, req.user.id, new Date().toISOString()]
      );
    } else {
      await db.run(
        "INSERT INTO projects (id, name, description, ownerId, projectKey, taskCounter, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [projectId, name, description || "", req.user.id, projectKey, 0, new Date().toISOString()]
      );
      await db.run(
        "INSERT INTO project_members (projectId, userId, role, joinedAt) VALUES (?, ?, 'admin', ?)",
        [projectId, req.user.id, new Date().toISOString()]
      );
    }
    
    const newProject = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
    res.json(sanitizeProject(newProject));
  } catch (err: any) {
    console.error("Error creating project:", err);
    res.status(500).json({ error: err?.message || "Failed to create project" });
  }
});

// Get Project Activity
app.get("/api/projects/:id/activity", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied to project activity." });
  }
  
  const activities = await db.all(`
    SELECT a.*, t.title as taskTitle
    FROM task_activities a
    JOIN tasks t ON a.taskId = t.id
    WHERE t.projectId = ?
    ORDER BY a.createdAt DESC
    LIMIT 50
  `, req.params.id);
  
  res.json(activities);
});

app.put("/api/projects/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied: user is not a member of this project." });
  }

  const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  if (!project) return res.sendStatus(404);

  const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [req.params.id, req.user.id]);
  const isProjectAdmin = pm && pm.role === 'admin';

  if (project.ownerId !== req.user.id && !isProjectAdmin && !isAdminOrSuperAdmin(req.user)) {
    return res.status(403).json({ error: "Only project owners, project admins, or system administrators can edit project details." });
  }

  const { name, description } = req.body;
  await db.run(
    "UPDATE projects SET name = ?, description = ? WHERE id = ?",
    [name, description, req.params.id]
  );
  
  const updatedProject = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  res.json(sanitizeProject(updatedProject));
});

// Update Project Repository Settings
app.put("/api/projects/:id/repo", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied: user is not a member of this project." });
  }

  const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [req.params.id, req.user.id]);
  const isProjectAdmin = pm && pm.role === 'admin';

  if (project.ownerId !== req.user.id && !isProjectAdmin && !isAdminOrSuperAdmin(req.user)) {
    return res.status(403).json({ error: "Only project owners, project admins, or system administrators can configure repository settings." });
  }

  const { repoProvider, repoOwner, repoName, repoUrl, repoToken, defaultBranch } = req.body;

  let owner = repoOwner || '';
  let name = repoName || '';
  if (repoUrl && (!owner || !name)) {
    try {
      const parsed = new URL(repoUrl);
      const parts = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
      if (parts.length >= 2) {
        owner = owner || parts[0];
        name = name || parts.slice(1).join('/');
      }
    } catch (e) {}
  }

  const rawToken = repoToken !== undefined && repoToken !== '••••••••' ? repoToken : (project.repoToken ? decryptSecret(project.repoToken) : '');
  const storedToken = rawToken ? encryptSecret(rawToken) : '';

  await db.run(
    `UPDATE projects SET 
      repoProvider = ?, 
      repoOwner = ?, 
      repoName = ?, 
      repoUrl = ?, 
      repoToken = ?, 
      defaultBranch = ? 
     WHERE id = ?`,
    [
      repoProvider || 'github',
      owner,
      name,
      repoUrl || '',
      storedToken,
      defaultBranch || 'main',
      req.params.id
    ]
  );

  const updated = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  res.json(sanitizeProject(updated));
});

// Get Live Branches from GitHub or GitLab for a Project
app.get("/api/projects/:id/git/branches", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied to project git branches." });
  }
  const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const tasks = await db.all("SELECT id, title, branchName, prUrl, prStatus FROM tasks WHERE projectId = ? AND branchName IS NOT NULL AND branchName != ''", req.params.id);
  const taskBranchMap = new Map();
  tasks.forEach((t: any) => {
    taskBranchMap.set(t.branchName, t);
  });

  const provider = project.repoProvider || 'github';
  const owner = project.repoOwner;
  const name = project.repoName;
  const token = decryptSecret(project.repoToken);

  const canUsePat = await isProjectAdminOrOwner(db, req.params.id, req.user);

  if (!owner || !name || !canUsePat) {
    // Fallback: return local task-linked branches
    const localBranches = Array.from(taskBranchMap.entries()).map(([bName, task]: [string, any]) => ({
      name: bName,
      commitSha: 'local',
      commitMessage: `Linked to task: ${task.title}`,
      isDefault: bName === (project.defaultBranch || 'main'),
      linkedTaskId: task.id,
      linkedTaskTitle: task.title,
      prUrl: task.prUrl,
      prStatus: task.prStatus
    }));

    if (localBranches.length === 0) {
      localBranches.push({
        name: project.defaultBranch || 'main',
        commitSha: 'main',
        commitMessage: 'Default branch',
        isDefault: true,
        linkedTaskId: null,
        linkedTaskTitle: null,
        prUrl: null,
        prStatus: null
      });
    }

    return res.json({ branches: localBranches, provider: 'none', configured: false });
  }

  try {
    if (provider === 'github') {
      const headers: Record<string, string> = {
        'User-Agent': 'devteam-taskmanager',
        'Accept': 'application/vnd.github.v3+json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const ghRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/branches`, { headers, signal: AbortSignal.timeout(8000) });
      if (!ghRes.ok) {
        const errText = await ghRes.text();
        throw new Error(`GitHub API Error (${ghRes.status}): ${errText}`);
      }

      const rawBranches = await ghRes.json();
      const branches = rawBranches.map((b: any) => {
        const linkedTask = taskBranchMap.get(b.name);
        return {
          name: b.name,
          commitSha: b.commit?.sha?.substring(0, 7) || '',
          protected: b.protected || false,
          webUrl: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/tree/${encodeURIComponent(b.name)}`,
          isDefault: b.name === (project.defaultBranch || 'main'),
          linkedTaskId: linkedTask?.id,
          linkedTaskTitle: linkedTask?.title,
          prUrl: linkedTask?.prUrl,
          prStatus: linkedTask?.prStatus
        };
      });

      return res.json({ branches, provider: 'github', configured: true });
    } else if (provider === 'gitlab') {
      const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
      const encodedProjectPath = encodeURIComponent(`${owner}/${name}`);
      const headers: Record<string, string> = {};
      if (token) headers['PRIVATE-TOKEN'] = token;

      const glRes = await fetch(`${gitlabUrl}/api/v4/projects/${encodedProjectPath}/repository/branches`, { headers, signal: AbortSignal.timeout(8000) });
      if (!glRes.ok) {
        const errText = await glRes.text();
        throw new Error(`GitLab API Error (${glRes.status}): ${errText}`);
      }

      const rawBranches = await glRes.json();
      const branches = rawBranches.map((b: any) => {
        const linkedTask = taskBranchMap.get(b.name);
        return {
          name: b.name,
          commitSha: b.commit?.short_id || b.commit?.id?.substring(0, 7) || '',
          commitMessage: b.commit?.title || '',
          protected: b.protected || false,
          webUrl: b.web_url || `${gitlabUrl}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/-/tree/${encodeURIComponent(b.name)}`,
          isDefault: b.default || b.name === (project.defaultBranch || 'main'),
          linkedTaskId: linkedTask?.id,
          linkedTaskTitle: linkedTask?.title,
          prUrl: linkedTask?.prUrl,
          prStatus: linkedTask?.prStatus
        };
      });

      return res.json({ branches, provider: 'gitlab', configured: true });
    }
  } catch (err: any) {
    console.error("Git API error:", err.message);
    // Return graceful fallback with error notice
    const localBranches = Array.from(taskBranchMap.entries()).map(([bName, task]: [string, any]) => ({
      name: bName,
      commitSha: 'local',
      commitMessage: `Linked to task: ${task.title}`,
      isDefault: bName === (project.defaultBranch || 'main'),
      linkedTaskId: task.id,
      linkedTaskTitle: task.title,
      prUrl: task.prUrl,
      prStatus: task.prStatus
    }));

    return res.json({ 
      branches: localBranches, 
      provider, 
      configured: true, 
      error: err.message || "Failed to connect to remote Git provider" 
    });
  }
});

// Create Branch on Remote GitHub or GitLab Repository
app.post("/api/projects/:id/git/branches", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied to project git branches." });
  }
  const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const { branchName, taskId, baseBranch } = req.body;
  if (!branchName) return res.status(400).json({ error: "Branch name is required" });

  if (taskId) {
    const task = await db.get("SELECT projectId FROM tasks WHERE id = ?", taskId);
    if (!task || task.projectId !== req.params.id) {
      return res.status(400).json({ error: "Specified task does not belong to this project." });
    }
    const taskAccess = await checkTaskAccess(db, taskId, req.user);
    if (!taskAccess.allowed) {
      return res.status(403).json({ error: "Access denied to specified task." });
    }
  }

  const targetBaseBranch = baseBranch || project.defaultBranch || 'main';
  const provider = project.repoProvider || 'github';
  const owner = project.repoOwner;
  const name = project.repoName;
  const token = decryptSecret(project.repoToken);

  // Protect against Confused Deputy: only project admins/owners can execute remote Git operations with configured PAT
  if (owner && name && token) {
    const canUsePat = await isProjectAdminOrOwner(db, req.params.id, req.user);
    if (!canUsePat) {
      return res.status(403).json({ error: "Only project administrators or owners can execute remote repository operations using the configured repository token." });
    }
  }

  let remoteCreated = false;
  let remoteUrl = '';
  let remoteError = null;

  if (owner && name && token) {
    try {
      if (provider === 'github') {
        const headers: Record<string, string> = {
          'User-Agent': 'devteam-taskmanager',
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${token}`
        };

        // 1. Get SHA of base branch
        const baseRefRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/ref/heads/${targetBaseBranch}`, { headers, signal: AbortSignal.timeout(8000) });
        if (!baseRefRes.ok) {
          let errMsg = `Failed to find base branch '${targetBaseBranch}' on GitHub`;
          try {
            const errJson = await baseRefRes.json();
            if (errJson.message) {
              errMsg += ` (${errJson.message})`;
            }
          } catch (e) {}
          throw new Error(errMsg);
        }
        const baseRefData = await baseRefRes.json();
        const sha = baseRefData.object.sha;

        // 2. Create ref
        const createRefRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/refs`, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            ref: `refs/heads/${branchName}`,
            sha
          })
        });

        if (!createRefRes.ok) {
          let errMsg = 'Failed to create branch on GitHub';
          try {
            const createErr = await createRefRes.json();
            errMsg = createErr.message || errMsg;
            if (createErr.errors && Array.isArray(createErr.errors)) {
              const details = createErr.errors.map((e: any) => e.message || JSON.stringify(e)).join(', ');
              errMsg += `: ${details}`;
            }
          } catch (e) {
            try {
              errMsg = await createRefRes.text() || errMsg;
            } catch (inner) {}
          }
          throw new Error(errMsg);
        }

        remoteCreated = true;
        remoteUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/tree/${encodeURIComponent(branchName)}`;
      } else if (provider === 'gitlab') {
        const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
        const encodedProjectPath = encodeURIComponent(`${owner}/${name}`);
        
        const glRes = await fetch(`${gitlabUrl}/api/v4/projects/${encodedProjectPath}/repository/branches`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'PRIVATE-TOKEN': token
          },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            branch: branchName,
            ref: targetBaseBranch
          })
        });

        if (!glRes.ok) {
          let errMsg = 'Failed to create branch on GitLab';
          try {
            const glErr = await glRes.json();
            errMsg = glErr.message || glErr.error || errMsg;
          } catch (e) {
            try {
              errMsg = await glRes.text() || errMsg;
            } catch (inner) {}
          }
          throw new Error(errMsg);
        }

        const glData = await glRes.json();
        remoteCreated = true;
        remoteUrl = glData.web_url || `${gitlabUrl}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/-/tree/${encodeURIComponent(branchName)}`;
      }
    } catch (err: any) {
      console.error("Error creating remote branch:", err.message);
      remoteError = err.message;
    }
  }

  // If a remote repo is configured, but remote branch creation failed, return an error response
  if (owner && name && token && !remoteCreated) {
    return res.status(400).json({
      success: false,
      error: remoteError || "Failed to create remote branch on Git provider. Check your repository token permissions, repository path, and default branch settings."
    });
  }

  // Save branch onto task if taskId provided
  if (taskId) {
    await db.run("UPDATE tasks SET branchName = ? WHERE id = ?", [branchName, taskId]);
    
    const taskNum = extractTaskNumber(branchName);
    if (taskNum !== null) {
      const proj = await db.get("SELECT taskCounter FROM projects WHERE id = ?", req.params.id);
      if (proj && taskNum > (proj.taskCounter || 0)) {
        await db.run("UPDATE projects SET taskCounter = ? WHERE id = ?", [taskNum, req.params.id]);
      }
    }
    
    // Add activity
    const activityId = uuidv4();
    const actionText = remoteCreated 
      ? `created remote branch ${branchName} on ${provider.toUpperCase()}`
      : `linked branch ${branchName} to task`;

    await db.run(
      "INSERT INTO task_activities (id, taskId, userId, action, createdAt) VALUES (?, ?, ?, ?, ?)",
      [activityId, taskId, req.user.id, actionText, new Date().toISOString()]
    );
  }

  res.json({
    success: true,
    branchName,
    remoteCreated,
    remoteUrl,
    remoteError,
    message: remoteCreated ? `Branch '${branchName}' created successfully on ${provider.toUpperCase()}` : `Branch '${branchName}' linked locally`
  });
});

// Create Pull Request / Merge Request for a Task
app.post("/api/projects/:id/git/pull-requests", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied to project git pull requests." });
  }
  const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const { taskId, sourceBranch, targetBranch, title, description } = req.body;
  if (!sourceBranch) return res.status(400).json({ error: "Source branch is required" });

  if (taskId) {
    const task = await db.get("SELECT projectId FROM tasks WHERE id = ?", taskId);
    if (!task || task.projectId !== req.params.id) {
      return res.status(400).json({ error: "Specified task does not belong to this project." });
    }
    const taskAccess = await checkTaskAccess(db, taskId, req.user);
    if (!taskAccess.allowed) {
      return res.status(403).json({ error: "Access denied to specified task." });
    }
  }

  const baseBranch = targetBranch || project.defaultBranch || 'main';
  const provider = project.repoProvider || 'github';
  const owner = project.repoOwner;
  const name = project.repoName;
  const token = decryptSecret(project.repoToken);

  // Protect against Confused Deputy: only project admins/owners can execute remote Git operations with configured PAT
  if (owner && name && token) {
    const canUsePat = await isProjectAdminOrOwner(db, req.params.id, req.user);
    if (!canUsePat) {
      return res.status(403).json({ error: "Only project administrators or owners can execute remote repository operations using the configured repository token." });
    }
  }

  let prUrl = '';
  let prStatus = 'open';
  let isFallback = false;

  if (!owner || !name || !token) {
    isFallback = true;
    // If no token or repo configured, generate web creation URL
    if (provider === 'github') {
      prUrl = `https://github.com/${encodeURIComponent(owner || 'owner')}/${encodeURIComponent(name || 'repo')}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(sourceBranch)}?expand=1`;
    } else {
      const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
      prUrl = `${gitlabUrl}/${encodeURIComponent(owner || 'owner')}/${encodeURIComponent(name || 'repo')}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(sourceBranch)}&merge_request%5Btarget_branch%5D=${encodeURIComponent(baseBranch)}`;
    }
  } else {
    try {
      if (provider === 'github') {
        const ghRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls`, {
          method: 'POST',
          headers: {
            'User-Agent': 'devteam-taskmanager',
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            title: title || `[Task] ${sourceBranch}`,
            head: sourceBranch,
            base: baseBranch,
            body: description || `Automated Pull Request created from DevTeam TaskManager`
          })
        });

        if (!ghRes.ok) {
          const ghErr = await ghRes.json();
          throw new Error(ghErr.message || 'Failed to create PR on GitHub');
        }

        const ghData = await ghRes.json();
        prUrl = ghData.html_url;
      } else if (provider === 'gitlab') {
        const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
        const encodedProjectPath = encodeURIComponent(`${owner}/${name}`);

        const glRes = await fetch(`${gitlabUrl}/api/v4/projects/${encodedProjectPath}/merge_requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'PRIVATE-TOKEN': token
          },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            title: title || `[Task] ${sourceBranch}`,
            source_branch: sourceBranch,
            target_branch: baseBranch,
            description: description || `Automated Merge Request created from DevTeam TaskManager`
          })
        });

        if (!glRes.ok) {
          const glErr = await glRes.json();
          throw new Error(glErr.message || 'Failed to create Merge Request on GitLab');
        }

        const glData = await glRes.json();
        prUrl = glData.web_url;
      }
    } catch (err: any) {
      console.error("PR Creation error:", err.message);
      isFallback = true;
      // Fallback web URL
      if (provider === 'github') {
        prUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(sourceBranch)}?expand=1`;
      } else {
        const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
        prUrl = `${gitlabUrl}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(sourceBranch)}&merge_request%5Btarget_branch%5D=${encodeURIComponent(baseBranch)}`;
      }
    }
  }

  if (taskId) {
    await db.run("UPDATE tasks SET prUrl = ?, prStatus = ? WHERE id = ?", [prUrl, prStatus, taskId]);
    
    // Add activity
    const activityId = uuidv4();
    await db.run(
      "INSERT INTO task_activities (id, taskId, userId, action, createdAt) VALUES (?, ?, ?, ?, ?)",
      [activityId, taskId, req.user.id, `opened Pull Request on ${provider.toUpperCase()}`, new Date().toISOString()]
    );
  }

  res.json({ success: true, prUrl, prStatus, isFallback });
});

// Project Custom Columns Management
app.get("/api/projects/:id/columns", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied to project." });
  }
  const row = await db.get("SELECT columnsJson FROM project_columns WHERE projectId = ?", req.params.id);
  if (!row) {
    return res.json({ columns: null });
  }
  try {
    const columns = JSON.parse(row.columnsJson);
    return res.json({ columns });
  } catch (e) {
    return res.json({ columns: null });
  }
});

app.put("/api/projects/:id/columns", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied: user is not a member of this project." });
  }

  const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [req.params.id, req.user.id]);
  const isProjectAdmin = pm && (pm.role === 'admin' || pm.role === 'lead');

  if (project.ownerId !== req.user.id && !isProjectAdmin && !isAdminOrSuperAdmin(req.user)) {
    return res.status(403).json({ error: "Permission denied. Only project owners, project admins, or system administrators can modify board column structure." });
  }

  const { columns } = req.body;
  if (!columns || !Array.isArray(columns)) {
    return res.status(400).json({ error: "Columns must be an array." });
  }

  const columnsJson = JSON.stringify(columns);
  const id = uuidv4();
  const now = new Date().toISOString();

  if (db.isPg) {
    await db.run(`
      INSERT INTO project_columns (id, projectId, columnsJson, updatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (projectId) DO UPDATE SET columnsJson = EXCLUDED.columnsJson, updatedAt = EXCLUDED.updatedAt
    `, [id, req.params.id, columnsJson, now]);
  } else {
    const existing = await db.get("SELECT id FROM project_columns WHERE projectId = ?", req.params.id);
    if (existing) {
      await db.run("UPDATE project_columns SET columnsJson = ?, updatedAt = ? WHERE projectId = ?", [columnsJson, now, req.params.id]);
    } else {
      await db.run("INSERT INTO project_columns (id, projectId, columnsJson, updatedAt) VALUES (?, ?, ?, ?)", [id, req.params.id, columnsJson, now]);
    }
  }

  res.json({ success: true, columns });
});

// Sync and Update Statuses of Pull/Merge Requests of a Project
app.post("/api/projects/:id/git/pull-requests/sync", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied to project git pull requests." });
  }
  const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const provider = project.repoProvider || 'github';
  const owner = project.repoOwner;
  const name = project.repoName;
  const token = decryptSecret(project.repoToken);

  const tasks = await db.all("SELECT id, title, prUrl, prStatus, status FROM tasks WHERE projectId = ? AND prUrl IS NOT NULL AND prUrl != ''", req.params.id);
  if (tasks.length === 0) {
    return res.json({ success: true, message: "No active Pull Requests to sync.", updatedCount: 0 });
  }

  if (!owner || !name || !token) {
    return res.status(400).json({ error: "Repository or authentication credentials are not configured for this project." });
  }

  const canUsePat = await isProjectAdminOrOwner(db, req.params.id, req.user);
  if (!canUsePat) {
    return res.status(403).json({ error: "Only project administrators or owners can execute remote repository sync using the configured token." });
  }

  let updatedCount = 0;
  const errors: string[] = [];

  for (const task of tasks) {
    try {
      let prNumber: string | null = null;
      if (provider === 'github') {
        const match = task.prUrl.match(/\/pull\/(\d+)/);
        if (match) prNumber = match[1];
      } else if (provider === 'gitlab') {
        const match = task.prUrl.match(/\/merge_requests\/(\d+)/);
        if (match) prNumber = match[1];
      }

      if (!prNumber) continue;

      let remotePrStatus = task.prStatus || 'open';
      let remoteMerged = false;

      if (provider === 'github') {
        const headers: Record<string, string> = {
          'User-Agent': 'devteam-taskmanager',
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${token}`
        };
        const ghRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${prNumber}`, { headers, signal: AbortSignal.timeout(8000) });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          remoteMerged = ghData.merged || false;
          remotePrStatus = ghData.state; // 'open' or 'closed'
          if (remoteMerged) {
            remotePrStatus = 'merged';
          }
        } else {
          errors.push(`GitHub error for task ${task.title}: ${ghRes.statusText}`);
        }
      } else if (provider === 'gitlab') {
        const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
        const encodedProjectPath = encodeURIComponent(`${owner}/${name}`);
        const headers = { 'PRIVATE-TOKEN': token };
        const glRes = await fetch(`${gitlabUrl}/api/v4/projects/${encodedProjectPath}/merge_requests/${prNumber}`, { headers, signal: AbortSignal.timeout(8000) });
        if (glRes.ok) {
          const glData = await glRes.json();
          const glState = glData.state; // 'opened', 'closed', 'merged', 'locked'
          if (glState === 'opened') {
            remotePrStatus = 'open';
          } else if (glState === 'merged') {
            remotePrStatus = 'merged';
            remoteMerged = true;
          } else if (glState === 'closed') {
            remotePrStatus = 'closed';
          }
        } else {
          errors.push(`GitLab error for task ${task.title}: ${glRes.statusText}`);
        }
      }

      // If status changed, update the task!
      if (remotePrStatus !== task.prStatus) {
        let nextTaskStatus = task.status;
        
        // Auto-transition to 'done' column if merged!
        if (remotePrStatus === 'merged' && task.status !== 'done') {
          nextTaskStatus = 'done';
        } else if (remotePrStatus === 'open' && (task.status === 'todo' || task.status === 'backlog')) {
          // If PR is open, auto-transition to 'review' column
          nextTaskStatus = 'review';
        }

        await db.run(
          "UPDATE tasks SET prStatus = ?, status = ? WHERE id = ?",
          [remotePrStatus, nextTaskStatus, task.id]
        );

        // Add activity
        const activityId = uuidv4();
        await db.run(
          "INSERT INTO task_activities (id, taskId, userId, action, createdAt) VALUES (?, ?, ?, ?, ?)",
          [activityId, task.id, req.user.id, `synchronized PR status: updated PR to '${remotePrStatus}' and Board Status to '${nextTaskStatus}'`, new Date().toISOString()]
        );

        updatedCount++;
      }
    } catch (err: any) {
      console.error(`Sync error for task ${task.id}:`, err.message);
      errors.push(`Failed to sync task ${task.title}: ${err.message}`);
    }
  }

  res.json({
    success: true,
    updatedCount,
    errors: errors.length > 0 ? errors : null,
    message: `PR sync completed. Updated ${updatedCount} task(s).`
  });
});

app.delete("/api/projects/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied: user is not a member of this project." });
  }

  const project = await db.get("SELECT * FROM projects WHERE id = ?", req.params.id);
  if (!project) return res.sendStatus(404);

  const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [req.params.id, req.user.id]);
  const isProjectAdmin = pm && pm.role === 'admin';

  if (project.ownerId !== req.user.id && !isProjectAdmin && !isAdminOrSuperAdmin(req.user)) {
    return res.status(403).json({ error: "Only project owners, project admins, or system administrators can delete projects." });
  }

  const projectId = req.params.id;
  const projectTasks = await db.all("SELECT id FROM tasks WHERE projectId = ?", projectId);
  if (projectTasks.length > 0) {
    const taskIds = projectTasks.map((t: any) => t.id);
    const placeholders = taskIds.map(() => "?").join(",");
    await db.run(`DELETE FROM task_dependencies WHERE taskId IN (${placeholders}) OR blockedByTaskId IN (${placeholders})`, [...taskIds, ...taskIds]);
    await db.run(`DELETE FROM task_comments WHERE taskId IN (${placeholders})`, taskIds);
    await db.run(`DELETE FROM task_activities WHERE taskId IN (${placeholders})`, taskIds);
    await db.run(`DELETE FROM tasks WHERE id IN (${placeholders})`, taskIds);
  }

  await db.run("DELETE FROM documents WHERE projectId = ?", projectId);
  await db.run("DELETE FROM milestones WHERE projectId = ?", projectId);
  await db.run("DELETE FROM project_members WHERE projectId = ?", projectId);
  await db.run("DELETE FROM team_projects WHERE projectId = ?", projectId);
  await db.run("DELETE FROM projects WHERE id = ?", projectId);
  res.json({ success: true });
});

// Integration Connectivity Status API for GitHub & GitLab
app.get("/api/integrations/status", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  let projects;
  if (isAdminOrSuperAdmin(req.user)) {
    projects = await db.all("SELECT id, name, repoProvider, repoOwner, repoName, repoToken FROM projects");
  } else {
    projects = await db.all(`
      SELECT DISTINCT p.id, p.name, p.repoProvider, p.repoOwner, p.repoName, p.repoToken 
      FROM projects p 
      LEFT JOIN project_members pm ON p.id = pm.projectId 
      LEFT JOIN team_projects tp ON p.id = tp.projectId 
      LEFT JOIN team_members tm ON tp.teamId = tm.teamId 
      LEFT JOIN tasks t ON p.id = t.projectId 
      WHERE p.ownerId = ? 
         OR pm.userId = ? 
         OR tm.userId = ? 
         OR t.assigneeId = ?
    `, [req.user.id, req.user.id, req.user.id, req.user.id]);
  }

  const githubProjects = projects.filter(p => p.repoProvider === 'github' && p.repoOwner && p.repoName);
  const gitlabProjects = projects.filter(p => p.repoProvider === 'gitlab' && p.repoOwner && p.repoName);

  // Evaluate GitHub (Optional by default)
  let ghStatus = 'disconnected';
  let ghText = 'Not Linked';
  let ghColor = 'slate';
  let ghDetail = 'Optional - No GitHub repository linked';

  if (githubProjects.length > 0) {
    const ghWithToken = githubProjects.filter(p => p.repoToken && p.repoToken.trim() !== '');
    if (ghWithToken.length === githubProjects.length) {
      ghStatus = 'connected';
      ghText = 'Connected';
      ghColor = 'emerald';
      ghDetail = `${githubProjects.length} GitHub ${githubProjects.length === 1 ? 'repo' : 'repos'} connected`;
    } else if (ghWithToken.length > 0) {
      ghStatus = 'connected_partial';
      ghText = 'Partial';
      ghColor = 'emerald';
      ghDetail = `${ghWithToken.length} of ${githubProjects.length} GitHub repos configured`;
    } else {
      ghStatus = 'not_linked';
      ghText = 'Not Linked';
      ghColor = 'slate';
      ghDetail = `Optional - Token not configured for ${githubProjects.length} GitHub repo(s)`;
    }
  }

  // Evaluate GitLab (Optional by default)
  let glStatus = 'disconnected';
  let glText = 'Not Linked';
  let glColor = 'slate';
  let glDetail = 'Optional - No GitLab repository linked';

  if (gitlabProjects.length > 0) {
    const glWithToken = gitlabProjects.filter(p => p.repoToken && p.repoToken.trim() !== '');
    if (glWithToken.length === gitlabProjects.length) {
      glStatus = 'connected';
      glText = 'Connected';
      glColor = 'emerald';
      glDetail = `${gitlabProjects.length} GitLab ${gitlabProjects.length === 1 ? 'repo' : 'repos'} connected`;
    } else if (glWithToken.length > 0) {
      glStatus = 'connected_partial';
      glText = 'Partial';
      glColor = 'emerald';
      glDetail = `${glWithToken.length} of ${gitlabProjects.length} GitLab repos configured`;
    } else {
      glStatus = 'not_linked';
      glText = 'Not Linked';
      glColor = 'slate';
      glDetail = `Optional - Token not configured for ${gitlabProjects.length} GitLab repo(s)`;
    }
  }

  res.json({
    github: {
      provider: 'github',
      name: 'GitHub',
      status: ghStatus,
      label: ghText,
      color: ghColor,
      details: ghDetail,
      count: githubProjects.length,
      repoCount: githubProjects.length,
      hasToken: githubProjects.length > 0 && githubProjects.every(p => p.repoToken && p.repoToken.trim() !== '')
    },
    gitlab: {
      provider: 'gitlab',
      name: 'GitLab',
      status: glStatus,
      label: glText,
      color: glColor,
      details: glDetail,
      count: gitlabProjects.length,
      repoCount: gitlabProjects.length,
      hasToken: gitlabProjects.length > 0 && gitlabProjects.every(p => p.repoToken && p.repoToken.trim() !== '')
    }
  });
});

// Project Members APIs
app.get("/api/projects/:id/members", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied to project members." });
  }
  const members = await db.all(`
    SELECT u.id, u.name, u.email, u.role as globalRole, pm.role, pm.joinedAt, pm.projectId
    FROM project_members pm
    JOIN users u ON pm.userId = u.id
    WHERE pm.projectId = ?
  `, req.params.id);
  res.json(members);
});

app.post("/api/projects/:id/members", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const projectId = req.params.id;
  const { userId, role } = req.body;

  const project = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
  if (!project) return res.sendStatus(404);

  const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [projectId, req.user.id]);
  const isProjectAdmin = pm && pm.role === 'admin';

  if (!isAdminOrSuperAdmin(req.user) && project.ownerId !== req.user.id && !isProjectAdmin) {
    return res.status(403).json({ error: "Only admins, project owner or project admins can manage members." });
  }

  const ALLOWED_PROJECT_ROLES = ['admin', 'member', 'viewer', 'contributor', 'lead'];
  const newRole = ALLOWED_PROJECT_ROLES.includes(role) ? role : 'member';

  const targetUser = await db.get("SELECT id FROM users WHERE id = ?", userId);
  if (!targetUser) {
    return res.status(404).json({ error: "User not found." });
  }

  try {
    await db.run(
      "INSERT INTO project_members (projectId, userId, role, joinedAt) VALUES (?, ?, ?, ?) ON CONFLICT(projectId, userId) DO UPDATE SET role = ?",
      [projectId, userId, newRole, new Date().toISOString(), newRole]
    );
    res.json({ success: true });
  } catch (e: any) {
    if (e.message?.includes("UNIQUE constraint failed") || e.code === 'SQLITE_CONSTRAINT' || e.code === '23505' || e.message?.includes("duplicate key value")) {
      await db.run("UPDATE project_members SET role = ? WHERE projectId = ? AND userId = ?", [newRole, projectId, userId]);
      res.json({ success: true });
    } else {
      res.status(500).json({ error: "Failed to add/update member" });
    }
  }
});

app.delete("/api/projects/:id/members/:userId", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const projectId = req.params.id;

  const project = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
  if (!project) return res.sendStatus(404);

  const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [projectId, req.user.id]);
  const isProjectAdmin = pm && pm.role === 'admin';

  if (!isAdminOrSuperAdmin(req.user) && project.ownerId !== req.user.id && !isProjectAdmin && req.user.id !== req.params.userId) {
    return res.status(403).json({ error: "Only admins, project owner or project admins can remove members." });
  }

  await db.run("DELETE FROM project_members WHERE projectId = ? AND userId = ?", [projectId, req.params.userId]);
  res.json({ success: true });
});

// Teams APIs
app.get("/api/teams", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  let teams;
  if (isAdminOrSuperAdmin(req.user)) {
    teams = await db.all("SELECT * FROM teams");
  } else {
    teams = await db.all(`
      SELECT DISTINCT t.* 
      FROM teams t 
      LEFT JOIN project_members pm ON t.projectId = pm.projectId 
      LEFT JOIN projects p ON t.projectId = p.id
      LEFT JOIN team_members tm ON t.id = tm.teamId
      WHERE t.ownerId = ? 
         OR tm.userId = ? 
         OR (t.projectId IS NOT NULL AND (pm.userId = ? OR p.ownerId = ?))
    `, [req.user.id, req.user.id, req.user.id, req.user.id]);
  }
  res.json(teams);
});

app.post("/api/teams", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;

  const { name, description, projectId } = req.body;

  if (projectId) {
    const project = await db.get("SELECT ownerId FROM projects WHERE id = ?", projectId);
    const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [projectId, req.user.id]);
    const isProjectAdmin = pm && pm.role === 'admin';
    if (!project || (!isAdminOrSuperAdmin(req.user) && project.ownerId !== req.user.id && !isProjectAdmin)) {
       return res.status(403).json({ error: "Only admins, project owner or project admins can create teams for this project." });
    }
  } else {
    const canManageTeams = await hasPermission(req.user, "manage_teams");
    if (!canManageTeams) {
      return res.status(403).json({ error: "You do not have permission to create global teams." });
    }
  }

  const teamId = uuidv4();
  await db.run(
    "INSERT INTO teams (id, name, description, ownerId, createdAt, projectId) VALUES (?, ?, ?, ?, ?, ?)",
    [teamId, name, description || "", req.user.id, new Date().toISOString(), projectId || null]
  );
  // add owner to members
  await db.run(
    "INSERT INTO team_members (id, teamId, userId, joinedAt) VALUES (?, ?, ?, ?)",
    [uuidv4(), teamId, req.user.id, new Date().toISOString()]
  );
  const newTeam = await db.get("SELECT * FROM teams WHERE id = ?", teamId);
  res.json(newTeam);
});

const checkTeamAccess = async (db: any, teamId: string, user: any): Promise<boolean> => {
  if (isAdminOrSuperAdmin(user)) return true;
  const team = await db.get("SELECT * FROM teams WHERE id = ?", teamId);
  if (!team) return false;
  if (team.ownerId === user.id) return true;
  const tm = await db.get("SELECT 1 FROM team_members WHERE teamId = ? AND userId = ?", [teamId, user.id]);
  if (tm) return true;
  if (team.projectId) {
    return await checkProjectAccess(db, team.projectId, user);
  }
  return false;
};

app.get("/api/teams/:id/members", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkTeamAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied to team members." });
  }
  const members = await db.all(`
    SELECT u.id, u.name, u.email, u.role, tm.joinedAt, tm.teamId
    FROM team_members tm
    JOIN users u ON tm.userId = u.id
    WHERE tm.teamId = ?
  `, req.params.id);
  res.json(members);
});

app.post("/api/teams/:id/members", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const { userId } = req.body;
  const teamId = req.params.id;

  const team = await db.get("SELECT * FROM teams WHERE id = ?", teamId);
  if (!team) return res.sendStatus(404);

  if (!isAdminOrSuperAdmin(req.user) && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: "Only admins or the team owner can add members." });
  }

  try {
    const newMemberId = uuidv4();
    await db.run(
      "INSERT INTO team_members (id, teamId, userId, joinedAt) VALUES (?, ?, ?, ?)",
      [newMemberId, teamId, userId, new Date().toISOString()]
    );
    res.json({ success: true, memberId: newMemberId });
  } catch (err: any) {
    if (err.message?.includes("UNIQUE constraint failed") || err.code === '23505' || err.message?.includes("duplicate key value")) {
      res.status(400).json({ error: "User is already in team" });
    } else {
      res.status(500).json({ error: "Failed to add member" });
    }
  }
});

app.delete("/api/teams/:id/members/:userId", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;

  const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  if (!team) return res.sendStatus(404);

  if (!isAdminOrSuperAdmin(req.user) && team.ownerId !== req.user.id && req.user.id !== req.params.userId) {
    return res.status(403).json({ error: "Only admins or the team owner can remove members." });
  }

  await db.run("DELETE FROM team_members WHERE teamId = ? AND userId = ?", [req.params.id, req.params.userId]);
  res.json({ success: true });
});

app.get("/api/teams/:id/projects", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkTeamAccess(db, req.params.id, req.user))) {
    return res.status(403).json({ error: "Access denied to team projects." });
  }
  const projects = await db.all(`
    SELECT p.* 
    FROM projects p
    JOIN team_projects tp ON p.id = tp.projectId
    WHERE tp.teamId = ?
  `, req.params.id);
  res.json(projects.map(sanitizeProject));
});

app.post("/api/teams/:id/projects", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;

  const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  if (!team) return res.sendStatus(404);

  if (!isAdminOrSuperAdmin(req.user)) {
    if (team.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Only admins or the team owner can add projects." });
    }
    const project = await db.get("SELECT ownerId FROM projects WHERE id = ?", req.body.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const pm = await db.get("SELECT role FROM project_members WHERE projectId = ? AND userId = ?", [req.body.projectId, req.user.id]);
    if (project.ownerId !== req.user.id && (!pm || pm.role !== 'admin')) {
      return res.status(403).json({ error: "You must be a project admin or owner to link this project to a team." });
    }
  }

  try {
    await db.run(
      "INSERT INTO team_projects (teamId, projectId) VALUES (?, ?)",
      [req.params.id, req.body.projectId]
    );
    res.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes("UNIQUE constraint failed") || err.code === '23505' || err.message?.includes("duplicate key value")) {
      res.status(400).json({ error: "Project is already in team" });
    } else {
      res.status(500).json({ error: "Failed to add project" });
    }
  }
});

app.delete("/api/teams/:id/projects/:projectId", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;

  const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  if (!team) return res.sendStatus(404);

  if (!isAdminOrSuperAdmin(req.user) && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: "Only admins or the team owner can remove projects." });
  }

  await db.run("DELETE FROM team_projects WHERE teamId = ? AND projectId = ?", [req.params.id, req.params.projectId]);
  res.json({ success: true });
});

app.put("/api/teams/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  if (!team) return res.sendStatus(404);

  const canManageTeams = await hasPermission(req.user, "manage_teams");
  if (!canManageTeams && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: "Only team owners, admins, or authorized roles can edit this team." });
  }

  const { name = null, description = null, projectId } = req.body;
  
  if (projectId !== undefined) {
    await db.run(
      "UPDATE teams SET name = COALESCE(?, name), description = COALESCE(?, description), projectId = ? WHERE id = ?",
      [name, description, projectId, req.params.id]
    );
  } else {
    await db.run(
      "UPDATE teams SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?",
      [name, description, req.params.id]
    );
  }
  
  const updatedTeam = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  res.json(updatedTeam);
});

app.delete("/api/teams/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const team = await db.get("SELECT * FROM teams WHERE id = ?", req.params.id);
  if (!team) return res.sendStatus(404);
  
  const canManageTeams = await hasPermission(req.user, "manage_teams");
  if (!canManageTeams && team.ownerId !== req.user.id) {
    return res.status(403).json({ error: "Only team owners, admins, or authorized roles can delete this team." });
  }

  await db.run("DELETE FROM teams WHERE id = ?", req.params.id);
  await db.run("DELETE FROM team_members WHERE teamId = ?", req.params.id);
  await db.run("DELETE FROM team_projects WHERE teamId = ?", req.params.id);
  res.json({ success: true });
});

// Documents APIs

app.get("/api/projects/:projectId/documents", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const docs = await db.all("SELECT * FROM documents WHERE projectId = ? ORDER BY updatedAt DESC", req.params.projectId);
  res.json(docs);
});

app.post("/api/projects/:projectId/documents", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const { title, content } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  
  await db.run(
    "INSERT INTO documents (id, projectId, title, content, authorId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, req.params.projectId, title, content || "", req.user.id, now, now]
  );
  
  const doc = await db.get("SELECT * FROM documents WHERE id = ?", id);
  res.json(doc);
});

app.get("/api/documents/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const doc = await db.get("SELECT * FROM documents WHERE id = ?", req.params.id);
  if (!doc) return res.sendStatus(404);
  if (!(await checkProjectAccess(db, doc.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  res.json(doc);
});

app.put("/api/documents/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const docCheck = await db.get("SELECT projectId FROM documents WHERE id = ?", req.params.id);
  if (!docCheck) return res.sendStatus(404);
  if (!(await checkProjectAccess(db, docCheck.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const { title, content } = req.body;
  const now = new Date().toISOString();
  
  await db.run(
    "UPDATE documents SET title = COALESCE(?, title), content = COALESCE(?, content), updatedAt = ? WHERE id = ?",
    [title, content, now, req.params.id]
  );
  
  const doc = await db.get("SELECT * FROM documents WHERE id = ?", req.params.id);
  res.json(doc);
});

app.delete("/api/documents/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const docCheck = await db.get("SELECT projectId FROM documents WHERE id = ?", req.params.id);
  if (!docCheck) return res.sendStatus(404);
  if (!(await checkProjectAccess(db, docCheck.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  await db.run("DELETE FROM documents WHERE id = ?", req.params.id);
  res.json({ success: true });
});

// Milestones APIs
app.get("/api/milestones", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  let milestones = [];
  if (isAdminOrSuperAdmin(req.user)) {
    milestones = await db.all("SELECT * FROM milestones");
  } else {
    milestones = await db.all(`
      SELECT DISTINCT m.* 
      FROM milestones m
      LEFT JOIN projects p ON m.projectId = p.id
      LEFT JOIN project_members pm ON p.id = pm.projectId
      LEFT JOIN team_projects tp ON p.id = tp.projectId
      LEFT JOIN team_members tm ON tp.teamId = tm.teamId
      WHERE p.ownerId = ? OR pm.userId = ? OR tm.userId = ?
    `, [req.user.id, req.user.id, req.user.id]);
  }
  res.json(milestones);
});

app.get("/api/projects/:projectId/milestones", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const milestones = await db.all("SELECT * FROM milestones WHERE projectId = ? ORDER BY startDate ASC", req.params.projectId);
  res.json(milestones);
});

app.post("/api/projects/:projectId/milestones", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  if (!(await checkProjectAccess(db, req.params.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const { name, description, startDate, endDate, status } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  
  await db.run(
    "INSERT INTO milestones (id, projectId, name, description, startDate, endDate, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, req.params.projectId, name, description, startDate, endDate, status || "pending", now]
  );
  
  const milestone = await db.get("SELECT * FROM milestones WHERE id = ?", id);
  res.json(milestone);
});

app.put("/api/milestones/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const msCheck = await db.get("SELECT projectId FROM milestones WHERE id = ?", req.params.id);
  if (!msCheck) return res.sendStatus(404);
  if (!(await checkProjectAccess(db, msCheck.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const { name, description, startDate, endDate, status } = req.body;
  
  await db.run(
    "UPDATE milestones SET name = COALESCE(?, name), description = COALESCE(?, description), startDate = COALESCE(?, startDate), endDate = COALESCE(?, endDate), status = COALESCE(?, status) WHERE id = ?",
    [name, description, startDate, endDate, status, req.params.id]
  );
  
  const milestone = await db.get("SELECT * FROM milestones WHERE id = ?", req.params.id);
  res.json(milestone);
});

app.delete("/api/milestones/:id", authenticateToken, async (req: any, res: any) => {
  const db = await dbPromise;
  const msCheck = await db.get("SELECT projectId FROM milestones WHERE id = ?", req.params.id);
  if (!msCheck) return res.sendStatus(404);
  if (!(await checkProjectAccess(db, msCheck.projectId, req.user))) {
    return res.status(403).json({ error: "Access denied" });
  }
  await db.run("DELETE FROM milestones WHERE id = ?", req.params.id);
  res.json({ success: true });
});

// --- DATABASE BACKUP AND RESTORE APIS ---

/**
 * Middleware to restrict route access exclusively to users with the 'admin' role.
 */
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user && (isAdminOrSuperAdmin(req.user) || req.user.role === "super_admin")) {
    next();
  } else {
    res.status(403).json({ error: "Access denied. Admin privileges required." });
  }
};

const requireSuperAdmin = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === "super_admin") {
    next();
  } else {
    res.status(403).json({ error: "Access denied. Super Admin privileges required." });
  }
};

/**
 * GET /api/backup/info
 * @description Retrieves current database metadata, active engine (SQLite vs PostgreSQL), 
 * and row count statistics across core workspace tables (Users, Tasks, Projects, Teams, Documents).
 * Requires authorization token.
 */
app.get("/api/backup/info", authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const isSqlite = !(db instanceof PgWrapper);

    let sqliteSize = 0;
    if (isSqlite && fs.existsSync(activeSqlitePath)) {
      const stats = fs.statSync(activeSqlitePath);
      sqliteSize = stats.size;
    }

    // Retrieve active count statistics concurrently or fallback safely on table-level failures
    const userCount = await db.get("SELECT COUNT(*) as count FROM users").then(r => r?.count || 0).catch(() => 0);
    const taskCount = await db.get("SELECT COUNT(*) as count FROM tasks").then(r => r?.count || 0).catch(() => 0);
    const projectCount = await db.get("SELECT COUNT(*) as count FROM projects").then(r => r?.count || 0).catch(() => 0);
    const teamCount = await db.get("SELECT COUNT(*) as count FROM teams").then(r => r?.count || 0).catch(() => 0);
    const documentCount = await db.get("SELECT COUNT(*) as count FROM documents").then(r => r?.count || 0).catch(() => 0);

    res.json({
      dbType: isSqlite ? "SQLite" : "PostgreSQL",
      sqliteSize,
      stats: {
        users: Number(userCount),
        tasks: Number(taskCount),
        projects: Number(projectCount),
        teams: Number(teamCount),
        documents: Number(documentCount)
      }
    });
  } catch (error: any) {
    console.error("Backup info error:", error);
    res.status(500).json({ error: "Failed to get database details." });
  }
});

/**
 * GET /api/backup/export-json
 * @description Exports all core database tables into a unified JSON format.
 * This provides engine-independent database persistence, allowing transfers between SQLite and Postgres.
 * Requires authorization token.
 */
app.get("/api/backup/export-json", authenticateToken, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const backupData: Record<string, any[]> = {};
    const tables = [
      "users", "tasks", "teams", "projects", "project_members",
      "documents", "milestones", "team_members", "team_projects",
      "task_dependencies", "task_comments", "task_activities", "settings", "roles",
      "project_columns"
    ];

    for (const table of tables) {
      try {
        let rows = await db.all(`SELECT * FROM ${table}`);
        if (table === 'projects') {
          rows = rows.map((p: any) => ({
            ...p,
            repoToken: p.repoToken ? '••••••••' : null
          }));
        }
        if (table === 'users') {
          rows = rows.map((u: any) => ({
            ...u,
            passwordHash: '••••••••'
          }));
        }
        backupData[table] = rows;
      } catch (e) {
        backupData[table] = [];
      }
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=workspace-backup.json");
    res.json(backupData);
  } catch (error: any) {
    console.error("Export JSON error:", error);
    res.status(500).json({ error: "Failed to export JSON backup." });
  }
});

/**
 * POST /api/backup/restore-json
 * @description Restores workspace database records from a portable JSON schema.
 * Purges all active data in target tables and inserts rows from JSON payload.
 * Requires authorization token.
 */
app.post("/api/backup/restore-json", authenticateToken, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const db = await dbPromise;
    const backupData = req.body;

    if (!backupData || typeof backupData !== "object") {
      return res.status(400).json({ error: "Invalid backup data format." });
    }

    if (!backupData.users || !Array.isArray(backupData.users)) {
      return res.status(400).json({ error: "Invalid backup: 'users' table data is missing." });
    }

    const ALLOWED_TABLE_COLUMNS: Record<string, string[]> = {
      users: ["id", "name", "email", "passwordHash", "role", "skills", "rolePrefix", "status"],
      tasks: ["id", "title", "description", "status", "priority", "deadline", "assigneeId", "creatorId", "branchName", "parentId", "projectId", "milestoneId", "createdAt", "orderIndex", "prUrl", "prStatus"],
      teams: ["id", "name", "description", "ownerId", "createdAt", "projectId"],
      projects: ["id", "name", "description", "ownerId", "projectKey", "taskCounter", "createdAt", "repoProvider", "repoOwner", "repoName", "repoUrl", "repoToken", "defaultBranch"],
      project_members: ["projectId", "userId", "role", "joinedAt"],
      documents: ["id", "projectId", "title", "content", "authorId", "createdAt", "updatedAt"],
      milestones: ["id", "projectId", "name", "description", "startDate", "endDate", "status", "createdAt"],
      team_members: ["id", "teamId", "userId", "joinedAt"],
      team_projects: ["teamId", "projectId"],
      task_dependencies: ["taskId", "blockedByTaskId"],
      task_comments: ["id", "taskId", "userId", "content", "createdAt"],
      task_activities: ["id", "taskId", "userId", "action", "createdAt"],
      settings: ["key", "value"],
      roles: ["id", "name", "description", "is_custom", "permissions"],
      project_columns: ["id", "projectId", "columnsJson", "updatedAt"]
    };

    const executingAdmin = await db.get("SELECT id, email, passwordHash FROM users WHERE id = ?", req.user.id);

    // Execute wipe and sequential restore inside a transactional block
    await db.transaction(async (tx) => {
      try {
        await tx.exec("DELETE FROM password_resets;");
      } catch (delPrErr: any) {
        const msg = delPrErr.message?.toLowerCase() || '';
        if (!msg.includes('no such table') && !msg.includes('does not exist')) {
          throw delPrErr;
        }
      }

      for (const table of Object.keys(ALLOWED_TABLE_COLUMNS)) {
        try {
          await tx.exec(`DELETE FROM ${table}`);
        } catch (delErr: any) {
          const msg = delErr.message?.toLowerCase() || '';
          if (!msg.includes('no such table') && !msg.includes('does not exist')) {
            throw delErr;
          }
          console.warn(`Skipping missing table ${table} during restore`);
        }
      }

      for (const table of Object.keys(ALLOWED_TABLE_COLUMNS)) {
        const rows = backupData[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const allowedCols = ALLOWED_TABLE_COLUMNS[table];
        for (const row of rows) {
          if (!row || typeof row !== "object") continue;
          const presentCols = Object.keys(row).filter(c => allowedCols.includes(c));
          if (presentCols.length === 0) continue;

          const placeholders = presentCols.map(() => "?").join(", ");
          const insertSql = `INSERT INTO ${table} (${presentCols.join(", ")}) VALUES (${placeholders})`;
          const params = presentCols.map(col => {
            if (table === "projects" && col === "repoToken" && row[col] === "••••••••") {
              return null;
            }
            if (table === "users" && col === "passwordHash" && row[col] === "••••••••") {
              if (executingAdmin && (row.id === executingAdmin.id || row.email === executingAdmin.email)) {
                return executingAdmin.passwordHash;
              }
              return "$2b$10$UnusablePlaceholderPasswordHash00000000000000000000000";
            }
            return row[col];
          });
          await tx.run(insertSql, params);
        }
      }
    });

    res.json({ success: true, message: "Workspace restored successfully from JSON backup!" });
  } catch (error: any) {
    console.error("Restore JSON error:", error);
    res.status(500).json({ error: `Failed to restore database: ${error.message}` });
  }
});

// Vite middleware for development

async function runBackgroundPrSync() {
  console.log("[Background Sync] Starting automatic pull request sync...");
  try {
    const db = await dbPromise;
    // Get all projects with Git configured
    const projects = await db.all("SELECT * FROM projects WHERE repoOwner IS NOT NULL AND repoName IS NOT NULL AND repoToken IS NOT NULL");
    if (!projects || projects.length === 0) {
      console.log("[Background Sync] No projects configured with Git. Skipping.");
      return;
    }

    for (const project of projects) {
      const provider = project.repoProvider || 'github';
      const owner = project.repoOwner;
      const name = project.repoName;
      const token = decryptSecret(project.repoToken);

      const tasks = await db.all(
        "SELECT id, title, prUrl, prStatus, status FROM tasks WHERE projectId = ? AND prUrl IS NOT NULL AND prUrl != '' AND prStatus != 'merged' AND prStatus != 'closed'",
        [project.id]
      );

      if (!tasks || tasks.length === 0) continue;

      for (const task of tasks) {
        try {
          let prNumber: string | null = null;
          if (provider === 'github') {
            const match = task.prUrl.match(/\/pull\/(\d+)/);
            if (match) prNumber = match[1];
          } else if (provider === 'gitlab') {
            const match = task.prUrl.match(/\/merge_requests\/(\d+)/);
            if (match) prNumber = match[1];
          }

          if (!prNumber) continue;

          let remotePrStatus = task.prStatus || 'open';
          let remoteMerged = false;

          if (provider === 'github') {
            const headers: Record<string, string> = {
              'User-Agent': 'devteam-taskmanager',
              'Accept': 'application/vnd.github.v3+json',
              'Authorization': `Bearer ${token}`
            };
            const ghRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${prNumber}`, { 
              headers,
              signal: AbortSignal.timeout(8000)
            });
            if (ghRes.ok) {
              const ghData = await ghRes.json();
              remoteMerged = ghData.merged || false;
              remotePrStatus = ghData.state; // 'open' or 'closed'
              if (remoteMerged) {
                remotePrStatus = 'merged';
              }
            }
          } else if (provider === 'gitlab') {
            const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
            const encodedProjectPath = encodeURIComponent(`${owner}/${name}`);
            const headers = { 'PRIVATE-TOKEN': token };
            const glRes = await fetch(`${gitlabUrl}/api/v4/projects/${encodedProjectPath}/merge_requests/${prNumber}`, { 
              headers,
              signal: AbortSignal.timeout(8000)
            });
            if (glRes.ok) {
              const glData = await glRes.json();
              const glState = glData.state; // 'opened', 'closed', 'merged', 'locked'
              if (glState === 'opened') {
                remotePrStatus = 'open';
              } else if (glState === 'merged') {
                remotePrStatus = 'merged';
                remoteMerged = true;
              } else if (glState === 'closed') {
                remotePrStatus = 'closed';
              }
            }
          }

          if (remotePrStatus !== task.prStatus) {
            let nextTaskStatus = task.status;
            if (remotePrStatus === 'merged' && task.status !== 'done') {
              nextTaskStatus = 'done';
            } else if (remotePrStatus === 'open' && (task.status === 'todo' || task.status === 'backlog')) {
              nextTaskStatus = 'review';
            }

            await db.run(
              "UPDATE tasks SET prStatus = ?, status = ? WHERE id = ?",
              [remotePrStatus, nextTaskStatus, task.id]
            );

            // Add activity under system action
            const activityId = uuidv4();
            await db.run(
              "INSERT INTO task_activities (id, taskId, userId, action, createdAt) VALUES (?, ?, ?, ?, ?)",
              [activityId, task.id, "system", `automatically synchronized PR status: updated PR to '${remotePrStatus}' and Board Status to '${nextTaskStatus}'`, new Date().toISOString()]
            );

            console.log(`[Background Sync] Updated task "${task.title}" to ${nextTaskStatus} (PR ${remotePrStatus})`);
          }
        } catch (taskErr: any) {
          console.error(`[Background Sync] Error syncing task ${task.id}:`, taskErr.message);
        }
      }
    }
  } catch (err: any) {
    console.error("[Background Sync] Error running background PR sync:", err.message);
  }
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  const server = app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });

  // Start automatic PR background sync on server startup (runs every 5 minutes)
  const syncInterval = setInterval(runBackgroundPrSync, 5 * 60 * 1000);
  // Also run once on startup
  setTimeout(runBackgroundPrSync, 5000);

  // Periodic hourly cleanup of unverified local registrations
  const purgeInterval = setInterval(async () => {
    try {
      const db = await dbPromise;
      await purgeStaleUnverifiedUsers(db);
    } catch (e) {}
  }, 60 * 60 * 1000);

  // Periodic cleanup of expired OAuth nonces (every 10 mins)
  const noncePurgeInterval = setInterval(async () => {
    try {
      const db = await dbPromise;
      await db.run("DELETE FROM oauth_nonces WHERE timestamp < ?", Date.now() - 20 * 60 * 1000);
    } catch (e) {}
  }, 10 * 60 * 1000);

  // Graceful shutdown
  const shutdown = () => {
    console.log("Shutting down gracefully...");
    clearInterval(syncInterval);
    clearInterval(purgeInterval);
    clearInterval(noncePurgeInterval);
    server.close(() => {
      console.log("Closed out remaining connections.");
      process.exit(0);
    });
    
    setTimeout(() => {
      console.error("Could not close connections in time, forcefully shutting down");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer();
