import { NextRequest, NextResponse } from "next/server";
import { authenticateAdminActionRequest, clearAdminSessionCookie } from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = authenticateAdminActionRequest(req);
  if (!auth.authorized) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  const response = NextResponse.json({
    success: true,
    message: "Administrator session terminated",
  });

  clearAdminSessionCookie(response);
  return response;
}
