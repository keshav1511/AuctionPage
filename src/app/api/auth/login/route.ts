import { NextRequest, NextResponse } from "next/server";
import {
  validateAdminCredentials,
  createSessionToken,
  setAdminSessionCookie,
} from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, leagueId = "all" } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const isValid = validateAdminCredentials(email, password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid administrator credentials" },
        { status: 401 }
      );
    }

    const sessionToken = createSessionToken({
      email: email.trim().toLowerCase(),
      role: "SUPER_ADMIN",
      leagueId: leagueId || "all",
    });

    const response = NextResponse.json({
      success: true,
      message: "Administrator session authenticated",
      user: {
        email: email.trim().toLowerCase(),
        role: "SUPER_ADMIN",
        leagueId: leagueId || "all",
      },
      token: sessionToken,
    });

    // Set secure HttpOnly cookie
    setAdminSessionCookie(response, sessionToken);

    return response;
  } catch (error) {
    console.error("[Auth API] Login failure:", error);
    return NextResponse.json(
      { success: false, error: "Authentication system error" },
      { status: 500 }
    );
  }
}
