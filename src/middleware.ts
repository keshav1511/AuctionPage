import { NextRequest, NextResponse } from "next/server";
import { verifySessionTokenEdge, ADMIN_COOKIE_NAME } from "@/lib/auth/edge-auth";

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/auction/reconcile",
    "/api/datasource/:path*",
    "/api/drive/:path*",
    "/api/sheets/:path*",
  ],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Exclude public admin login page
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  // 2. Validate token from HttpOnly cookie
  const cookieToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  let session = await verifySessionTokenEdge(cookieToken);

  // 3. For API routes: also check Bearer header or system secret if cookie is absent
  if (pathname.startsWith("/api/")) {
    if (!session) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        session = await verifySessionTokenEdge(authHeader.substring(7).trim());
      }
    }

    if (!session) {
      const adminSecret = req.headers.get("x-admin-secret");
      if (
        adminSecret &&
        process.env.ADMIN_API_SECRET &&
        adminSecret === process.env.ADMIN_API_SECRET
      ) {
        return NextResponse.next();
      }

      return NextResponse.json(
        { success: false, error: "Unauthorized: Valid administrator session required" },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // 4. For /admin/* page routes: redirect to login if session missing or expired
  if (!session) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    const redirectRes = NextResponse.redirect(loginUrl);
    // Explicit anti-caching on redirects
    redirectRes.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    redirectRes.headers.set("Pragma", "no-cache");
    redirectRes.headers.set("Expires", "0");
    return redirectRes;
  }

  // 5. Authenticated page request: inject anti-caching headers so browser bfcache cannot leak protected state
  const response = NextResponse.next();
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
