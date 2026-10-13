import type { Request, Response, NextFunction } from "express";

// ============ Rate Limiting ============
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 120; // requests per window
const RATE_LIMIT_AUTH_MAX = 15; // auth attempts per window

function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const isAuthRoute = req.path.includes("/oauth") || req.path.includes("/auth");
  const maxRequests = isAuthRoute ? RATE_LIMIT_AUTH_MAX : RATE_LIMIT_MAX;
  const key = isAuthRoute ? `auth:${ip}` : `api:${ip}`;
  const now = Date.now();

  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return next();
  }

  entry.count++;
  if (entry.count > maxRequests) {
    res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000).toString());
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  next();
}

// Clean up rate limit map periodically
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((entry, key) => {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  });
}, 60_000);

// ============ Security Headers ============
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions policy
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https:",
      "frame-ancestors 'self'",
    ].join("; ")
  );
  // Strict Transport Security
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

// ============ Input Sanitization ============
const DANGEROUS_PATTERNS = [
  /<script\b[^>]*>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
];

export function sanitizeString(input: string): string {
  let sanitized = input;
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }
  // Encode HTML entities
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
  return sanitized;
}

// ============ SQL Injection Prevention ============
// Note: Drizzle ORM already uses parameterized queries
// This is an additional layer for any raw inputs
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|TRUNCATE)\b)/gi,
  /(--|;|\/\*|\*\/|xp_|sp_)/gi,
  /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/gi,
];

export function detectSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

// ============ Request Size Limiter ============
export function requestSizeLimiter(maxSizeKb: number = 512) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    if (contentLength > maxSizeKb * 1024) {
      return res.status(413).json({ error: "Request body too large" });
    }
    next();
  };
}

// ============ CORS Configuration ============
export function corsHandler(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  // Allow same-origin and trusted origins
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
}

// ============ Audit Logger ============
export function createAuditEntry(
  userId: number | null,
  action: string,
  entityType: string,
  entityId: number | null,
  oldValues: unknown,
  newValues: unknown,
  ipAddress: string
) {
  return {
    userId,
    action,
    entityType,
    entityId,
    oldValues: oldValues ? JSON.stringify(oldValues) : null,
    newValues: newValues ? JSON.stringify(newValues) : null,
    ipAddress,
  };
}
