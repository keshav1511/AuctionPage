import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = getAdminSessionFromRequest(req);

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      email: session.email,
      role: session.role,
      leagueId: session.leagueId,
    },
  });
}
