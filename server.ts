// AI Studio Editor Sync
// Modular Architecture - Express Backend
import "dotenv/config";
import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { PORT, HOST } from "./server/config.js";
import { dbPromise } from "./server/db.js";
import { authRouter } from "./server/routes/auth.routes.js";
import { usersRouter } from "./server/routes/users.routes.js";
import { tasksRouter } from "./server/routes/tasks.routes.js";
import { projectsRouter } from "./server/routes/projects.routes.js";
import { documentsRouter } from "./server/routes/documents.routes.js";
import { backupRouter } from "./server/routes/backup.routes.js";
import { eventsRouter } from "./server/routes/events.routes.js";
import { webhooksRouter } from "./server/routes/webhooks.routes.js";
import { startBackgroundJobs } from "./server/services/sync.service.js";

const app = express();
// Safely trust reverse proxy hops from private subnets/loopbacks
app.set("trust proxy", "loopback, linklocal, uniquelocal");

// Request logging
app.use(morgan("dev"));

// Attach CSP nonce to res.locals for HTML script tags
app.use((req: any, res: any, next: any) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});

// Basic security headers
const gitlabOrigin =
  process.env.GITLAB_URL && /^https?:\/\//i.test(process.env.GITLAB_URL)
    ? new URL(process.env.GITLAB_URL).origin
    : null;

const cspImgSrc = [
  "'self'",
  "data:",
  "blob:",
  "https://*.githubusercontent.com",
  "https://*.googleusercontent.com",
  "https://gitlab.com",
  "https://*.gitlab.com",
  "https://secure.gravatar.com"
];
if (gitlabOrigin && !cspImgSrc.includes(gitlabOrigin)) {
  cspImgSrc.push(gitlabOrigin);
}

const cspConnectSrc = [
  "'self'",
  "https://github.com",
  "https://api.github.com",
  "https://gitlab.com",
  "https://*.gitlab.com",
  "https://www.googleapis.com",
  "https://*.googleapis.com"
];
if (gitlabOrigin && !cspConnectSrc.includes(gitlabOrigin)) {
  cspConnectSrc.push(gitlabOrigin);
}

app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production"
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", (req: any, res: any) => `'nonce-${res.locals.cspNonce}'`],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
              imgSrc: cspImgSrc,
              connectSrc: cspConnectSrc,
              frameSrc: ["'self'"]
            }
          }
        : false,
    crossOriginEmbedderPolicy: false
  })
);

// Compress responses
app.use(compression());

const getSafeClientIp = (req: any): string => {
  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
};

// General API Rate Limiter (runs before body parsers to reject floods without buffering large payloads)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => getSafeClientIp(req),
  validate: { xForwardedForHeader: false },
  message: { error: "Too many requests, please try again after 15 minutes" }
});

// Apply rate limiting to API routes
app.use("/api/", apiLimiter);

// Inbound webhook body parser with rawBody buffer capture (MUST run before global JSON parser)
app.use(
  ["/api/webhooks", "/api/webhooks/*"],
  express.json({
    limit: "5mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  })
);

// Standard lightweight body parser (1MB payload limit, no wasteful rawBody buffer retention on general API calls)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// Two-tier Auth Rate Limiting for credential endpoints:
// Tier 1: Strict per-IP rate limiter (with skipSuccessfulRequests so office/NAT valid logins don't exhaust shared budget)
const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 failed credential attempts per 15 minutes per IP
  skipSuccessfulRequests: true, // Successful logins do not consume quota
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => getSafeClientIp(req),
  validate: { xForwardedForHeader: false },
  message: { error: "Too many authentication attempts from this IP address. Please try again after 15 minutes." }
});

// Tier 2: Strict per-Account rate limiter with skipSuccessfulRequests to prevent targeted account DoS
const authAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 failed attempts per 15 minutes per account
  skipSuccessfulRequests: true, // Successful logins do not consume quota
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    const identifier =
      typeof req.body?.email === "string"
        ? req.body.email.toLowerCase().trim().slice(0, 100)
        : typeof req.body?.username === "string"
        ? req.body.username.toLowerCase().trim().slice(0, 100)
        : "";
    return identifier || getSafeClientIp(req);
  },
  validate: { xForwardedForHeader: false },
  message: { error: "Too many failed authentication attempts for this account. Please try again after 15 minutes." }
});

// Apply specifically to credential submitting endpoints, NOT to /me, /logout, or OAuth redirect handlers
app.use(
  [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/auth/reset-password"
  ],
  authIpLimiter,
  authAccountLimiter
);

/* --- MODULAR API ROUTERS --- */
app.use("/api/auth", authRouter);
app.use("/api", usersRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api", projectsRouter);
app.use("/api", documentsRouter);
app.use("/api/backup", backupRouter);
app.use("/api", eventsRouter);
app.use("/api", webhooksRouter);

async function startServer() {
  // Ensure database initialization begins
  await dbPromise;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
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

  // Start background sync and cleanup jobs
  const stopBackgroundJobs = startBackgroundJobs();

  // Graceful shutdown
  const shutdown = () => {
    console.log("Shutting down gracefully...");
    stopBackgroundJobs();
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
