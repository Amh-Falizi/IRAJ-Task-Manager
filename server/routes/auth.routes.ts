import express, { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { dbPromise } from "../db.js";
import {
  SECRET_KEY,
  AUTH_COOKIE_NAME,
  getAppUrl,
  escapeHtml,
  safeJsonForScriptTag,
  setAuthCookie,
  clearAuthCookie
} from "../config.js";
import { authenticateToken } from "../middleware/auth.js";
import { AuthRequest } from "../types.js";

export const authRouter = express.Router();
const router = authRouter;

// Register
router.post("/register", async (req, res) => {
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
router.post("/login", async (req, res) => {
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
    
    const permissions = await getUserPermissions(db, user.role);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
        rolePrefix: user.rolePrefix || ""
      }
    });
  } catch (e: any) {
    console.error("LOGIN ERROR:", e);
    res.status(500).json({ error: "An unexpected error occurred during login." });
  }
});

// Logout
router.post("/logout", async (req: AuthRequest, res: Response) => {
  try {
    const authHeader = req.headers["authorization"];
    const rawBearer = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
    const token = (rawBearer && rawBearer !== "cookie_authenticated" && rawBearer !== "null") ? rawBearer : cookieToken;

    if (token) {
      try {
        const decoded: any = jwt.verify(token, SECRET_KEY, { algorithms: ["HS256"] });
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
router.post("/forgot-password", async (req, res) => {
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
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV ONLY] Password reset link for ${email}: ${resetLink}`);
      }
      return res.json({ message: "If that email is registered, a password reset link has been sent." });
    }
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    return res.status(500).json({ error: "Failed to process password reset request." });
  }
});

// Reset Password
router.post("/reset-password", async (req, res) => {
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

export const getUserPermissions = async (db: any, role: string): Promise<Record<string, boolean>> => {
  if (role === "super_admin") {
    return {
      create_tasks: true,
      edit_all_tasks: true,
      delete_tasks: true,
      manage_projects: true,
      manage_teams: true,
      manage_users: true,
      manage_roles: true,
      reset_database: true
    };
  }
  const roleRow = await db.get("SELECT permissions FROM roles WHERE id = ?", role);
  if (roleRow?.permissions) {
    try {
      return typeof roleRow.permissions === 'string' ? JSON.parse(roleRow.permissions) : roleRow.permissions;
    } catch (e) {}
  }
  return {};
};

export const validateAndGetOAuthRole = async (db: any, email: string): Promise<string> => {
  const userCount = await db.get("SELECT COUNT(*) as count FROM users");
  const count = Number(userCount?.count || 0);
  if (count === 0) {
    return "super_admin";
  }

  const allowedDomains = process.env.OAUTH_ALLOWED_DOMAINS
    ? process.env.OAUTH_ALLOWED_DOMAINS.split(",").map((d: string) => d.trim().toLowerCase()).filter(Boolean)
    : [];
  if (allowedDomains.length > 0) {
    const userDomain = email.split("@")[1];
    if (!userDomain || !allowedDomains.includes(userDomain)) {
      throw new Error(`Email domain @${userDomain} is not authorized for OAuth sign-in.`);
    }
  }

  const isProd = process.env.NODE_ENV === "production";
  const isAutoRegisterExplicitlyEnabled = process.env.OAUTH_AUTO_REGISTER === "true";
  const isAutoRegisterExplicitlyDisabled = process.env.OAUTH_AUTO_REGISTER === "false";

  // In production, default OAuth registration to disabled unless explicitly enabled.
  // In development, allow auto-registration unless explicitly disabled.
  const isAutoRegisterAllowed = isProd 
    ? isAutoRegisterExplicitlyEnabled 
    : !isAutoRegisterExplicitlyDisabled;

  if (!isAutoRegisterAllowed) {
    throw new Error("Self-registration via OAuth is disabled in production. An invitation or administrator setup is required.");
  }

  return "developer";
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

router.get("/gitlab/url", (req, res) => {
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

router.get("/gitlab/callback", async (req: any, res: any) => {
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
      const role = await validateAndGetOAuthRole(db, email);
      const id = uuidv4();
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
    const permissions = await getUserPermissions(db, user.role);
    const userPayload = safeJsonForScriptTag({ id: user.id, name: user.name, email: user.email, role: user.role, permissions });

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
router.get("/google/url", (req, res) => {
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

router.get(["/google/callback", "/google/callback/"], async (req: any, res: any) => {
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
      const role = await validateAndGetOAuthRole(db, email);
      const id = uuidv4();
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
    const permissions = await getUserPermissions(db, user.role);
    const userPayload = safeJsonForScriptTag({ id: user.id, name: user.name, email: user.email, role: user.role, permissions });

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
router.get("/github/url", (req, res) => {
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

router.get(["/github/callback", "/github/callback/"], async (req: any, res: any) => {
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
      const role = await validateAndGetOAuthRole(db, email);
      const id = uuidv4();
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
    const permissions = await getUserPermissions(db, user.role);
    const userPayload = safeJsonForScriptTag({ id: user.id, name: user.name, email: user.email, role: user.role, permissions });

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
router.get("/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  const db = await dbPromise;
  const user = await db.get("SELECT id, name, email, role, skills, rolePrefix, status FROM users WHERE id = ?", req.user!.id);
  if (!user) return res.sendStatus(404);

  const permissions = await getUserPermissions(db, user.role);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions,
    skills: user.skills ? (typeof user.skills === 'string' ? JSON.parse(user.skills) : user.skills) : [],
    rolePrefix: user.rolePrefix || "",
    status: user.status || "Available"
  });
});
