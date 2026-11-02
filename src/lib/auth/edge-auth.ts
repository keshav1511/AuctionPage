// ==============================================================================
// NTL AUCTION PLATFORM - EDGE-COMPATIBLE AUTHENTICATION
// Uses standard Web Crypto API (fully supported on Next.js Edge Middleware & Vercel)
// Zero Node.js built-ins to eliminate runtime edge compatibility issues
// ==============================================================================

export const ADMIN_COOKIE_NAME = "ntl_admin_session";

function getSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.AUTH_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export interface AdminSessionPayload {
  email: string;
  role: "SUPER_ADMIN" | "AUCTIONEER";
  leagueId: string;
  iat: number;
  exp: number;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUtf8(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Edge-compatible session token verification using Web Crypto API
 */
export async function verifySessionTokenEdge(
  token: string | null | undefined
): Promise<AdminSessionPayload | null> {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, data, signature] = parts;
  const secret = getSessionSecret();
  if (!secret) return null;

  try {
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sigBuf = await globalThis.crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(`${header}.${data}`)
    );
    const expectedSignature = uint8ArrayToBase64Url(new Uint8Array(sigBuf));

    if (!constantTimeEqual(signature, expectedSignature)) {
      return null;
    }

    const headerJson = JSON.parse(base64UrlToUtf8(header)) as { alg?: string; typ?: string };
    if (headerJson.alg !== "HS256" || headerJson.typ !== "JWT") return null;
    const payloadJson = base64UrlToUtf8(data);
    const payload = JSON.parse(payloadJson) as AdminSessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (!payload.email || !["SUPER_ADMIN", "AUCTIONEER"].includes(payload.role) || !payload.leagueId || !Number.isFinite(payload.exp) || payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
