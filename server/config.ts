import crypto from "crypto";

export const escapeHtml = (unsafe: string = "") => {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const safeJsonForScriptTag = (obj: any) => {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
};

export const getAppUrl = (req: any) => {
  if (process.env.APP_URL && /^https?:\/\/[a-zA-Z0-9.-]+/i.test(process.env.APP_URL)) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    const host = process.env.HOST_NAME || "app.internal";
    return `https://${host}`;
  }
  const protocol = (((req.headers["x-forwarded-proto"] || req.protocol || "http") as string).split(",")[0].trim());
  const rawHost = ((req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000") as string).split(",")[0].trim();
  const cleanHost = rawHost.replace(/[^a-zA-Z0-9.:-]/g, "");
  return `${protocol}://${cleanHost}`;
};

export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
export const HOST = process.env.HOST || "0.0.0.0";

const FALLBACK_SECRET = crypto.randomBytes(64).toString("hex");
export const SECRET_KEY = process.env.SECRET_KEY || FALLBACK_SECRET;

if (process.env.NODE_ENV === "production") {
  if (!process.env.SECRET_KEY || process.env.SECRET_KEY === "your-super-secret-key-change-this") {
    console.error("FATAL ERROR: SECRET_KEY environment variable MUST be explicitly set to a secure secret in production mode.");
    process.exit(1);
  }
  const appUrl = process.env.APP_URL ? process.env.APP_URL.trim() : "";
  if (!appUrl || appUrl === "MY_APP_URL" || !/^https?:\/\/[a-zA-Z0-9.-]+/i.test(appUrl)) {
    console.error("FATAL ERROR: APP_URL environment variable MUST be explicitly set to a valid URL starting with http:// or https:// (e.g. https://your-domain.com) in production mode.");
    process.exit(1);
  }
} else if (!process.env.SECRET_KEY) {
  console.warn("WARNING: SECRET_KEY is not set in the environment. Using a dynamically generated secret. Existing sessions will be invalidated if the server restarts.");
}

const RAW_ENCRYPTION_SECRET = process.env.TOKEN_ENCRYPTION_KEY || SECRET_KEY;
const ENCRYPTION_KEY = crypto.createHash("sha256").update(RAW_ENCRYPTION_SECRET).digest();

export function encryptSecret(text: string): string {
  if (!text) return text;
  if (text.startsWith("enc:")) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `enc:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptSecret(text: string): string {
  if (!text || !text.startsWith("enc:")) return text;
  try {
    const parts = text.split(":");
    if (parts.length !== 4) return text;
    const iv = Buffer.from(parts[1], "hex");
    const authTag = Buffer.from(parts[2], "hex");
    const encryptedText = parts[3];
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (e) {
    console.error("Failed to decrypt secret:", e);
    return "";
  }
}

export const AUTH_COOKIE_NAME = "auth_token";

export const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
};

export const setAuthCookie = (res: any, token: string) => {
  res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions());
};

export const clearAuthCookie = (res: any) => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/"
  });
};
