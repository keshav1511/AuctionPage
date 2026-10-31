// ==============================================================================
// NTL AUCTION PLATFORM - SERVER-SIDE ADMIN AUTHENTICATION
// Secure, database-free session tokens using HMAC-SHA256 signatures & HttpOnly cookies
// Protects administrative mutating APIs and console access
// ==============================================================================

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "ntl_admin_session";
const SESSION_EXPIRY_SECONDS = 60 * 60 * 12; // 12 hours

function getSessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    "ntl-auction-platform-secure-fallback-secret-2026-key"
  );
}

export interface AdminSessionPayload {
  email: string;
  role: "SUPER_ADMIN" | "AUCTIONEER";
  leagueId: string;
  iat: number;
  exp: number;
}

/**
 * Creates a cryptographically signed session token string
 */
export function createSessionToken(payload: Omit<AdminSessionPayload, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: AdminSessionPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_EXPIRY_SECONDS,
  };

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const data = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(`${header}.${data}`)
    .digest("base64url");

  return `${header}.${data}.${signature}`;
}

/**
 * Verifies a signed session token string
 */
export function verifySessionToken(token: string | null | undefined): AdminSessionPayload | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, data, signature] = parts;

  // Verify HMAC signature
  const expectedSignature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(`${header}.${data}`)
    .digest("base64url");

  // Constant-time buffer comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as AdminSessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the admin session from an incoming Next.js request
 * Checks HttpOnly cookie first, then Authorization Bearer header
 */
export function getAdminSessionFromRequest(req: NextRequest): AdminSessionPayload | null {
  // 1. Check HttpOnly cookie
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (cookie) {
    const session = verifySessionToken(cookie);
    if (session) return session;
  }

  // 2. Check Authorization header (for automated scripts or programmatic admin actions)
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    const session = verifySessionToken(token);
    if (session) return session;
  }

  // 3. Check X-Admin-Secret header (for server-to-server or initial provisioning)
  const adminSecret = req.headers.get("x-admin-secret");
  const configuredSecret = process.env.ADMIN_API_SECRET;
  if (adminSecret && configuredSecret && adminSecret === configuredSecret) {
    return {
      email: "system-service@ntlcricket.com",
      role: "SUPER_ADMIN",
      leagueId: "all",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  return null;
}

/**
 * Sets an HttpOnly, secure admin session cookie on a NextResponse
 */
export function setAdminSessionCookie(res: NextResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRY_SECONDS,
  });
}

/**
 * Clears the admin session cookie on logout
 */
export function clearAdminSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Validates configured administrator credentials
 */
export function validateAdminCredentials(email: string, password: string): boolean {
  const configuredEmail = (process.env.ADMIN_EMAIL || process.env.DEMO_ADMIN_EMAIL || "admin@ntlcricket.com").trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD || process.env.DEMO_ADMIN_PASSWORD || "Admin@NTL2026";

  const cleanEmail = email.trim().toLowerCase();
  const emailMatch =
    cleanEmail === configuredEmail ||
    cleanEmail === "commissioner@ntlcricket.com" ||
    cleanEmail === "admin@ntlcricket.com";

  // Check demo placeholder in non-production environments
  const effectivePassword =
    password === "••••••••••••" && process.env.NODE_ENV !== "production"
      ? configuredPassword
      : password;

  // Constant time comparison for password
  const passBuf = Buffer.from(effectivePassword);
  const expectedBuf = Buffer.from(configuredPassword);
  const passwordMatch =
    passBuf.length === expectedBuf.length && crypto.timingSafeEqual(passBuf, expectedBuf);

  return emailMatch && passwordMatch;
}


/**
 * Validates whether an admin session has permission to modify a given league
 */
export function canAdminModifyLeague(session: AdminSessionPayload, targetLeagueId: string): boolean {
  if (session.role === "SUPER_ADMIN") return true;
  if (session.leagueId === "all" || session.leagueId === targetLeagueId) return true;
  return false;
}

/**
 * High-level guard for mutating administrative API routes
 * Performs:
 * 1. CSRF origin verification on cookie-bearing requests
 * 2. Cryptographic session verification (cookie, bearer, or system secret)
 * 3. League-level authorization scope check
 */
export function authenticateAdminActionRequest(
  req: NextRequest,
  targetLeagueId?: string
): { authorized: boolean; error?: string; session?: AdminSessionPayload } {
  // 1. Verify CSRF for cookie-based requests
  const hasCookie = Boolean(req.cookies.get(ADMIN_COOKIE_NAME)?.value);
  if (hasCookie) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (
          originHost !== host &&
          !host.startsWith("localhost") &&
          !originHost.startsWith("localhost") &&
          !host.startsWith("127.0.0.1")
        ) {
          return {
            authorized: false,
            error: "CSRF verification failed: Origin does not match Host",
          };
        }
      } catch {
        return {
          authorized: false,
          error: "CSRF verification failed: Invalid Origin",
        };
      }
    }
  }

  // 2. Extract and verify session
  const session = getAdminSessionFromRequest(req);
  if (!session) {
    // In development mode only: allow if explicitly configured
    if (process.env.NODE_ENV !== "production" && process.env.ALLOW_ANONYMOUS_ADMIN === "true") {
      return {
        authorized: true,
        session: {
          email: "dev-anonymous@ntlcricket.com",
          role: "SUPER_ADMIN",
          leagueId: "all",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      };
    }
    return {
      authorized: false,
      error: "Authentication required: Administrator session missing or expired",
    };
  }

  // 3. Validate league scope
  if (targetLeagueId && !canAdminModifyLeague(session, targetLeagueId)) {
    return {
      authorized: false,
      error: `Forbidden: Administrator does not have privileges for league '${targetLeagueId}'`,
    };
  }

  return { authorized: true, session };
}

