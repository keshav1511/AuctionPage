import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Administrator session terminated",
  });

  clearAdminSessionCookie(response);
  return response;
}
