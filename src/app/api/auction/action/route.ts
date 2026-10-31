import { NextRequest, NextResponse } from "next/server";
import { processAuctionAction, AuctionActionPayload } from "@/lib/server/auction-store";
import { authenticateAdminActionRequest } from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as AuctionActionPayload;

    if (!payload.leagueId || !payload.type) {
      return NextResponse.json(
        { success: false, error: "leagueId and type are required" },
        { status: 400 }
      );
    }

    // 1. Authenticate mutating administrative request
    const auth = authenticateAdminActionRequest(req, payload.leagueId);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || "Unauthorized administrative action" },
        { status: 401 }
      );
    }

    const result = await processAuctionAction(payload);

    if (!result.success) {
      const isNotFound = Boolean(result.error && result.error.includes("not found"));
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Action validation failed",
          session: result.state?.session || null,
        },
        { status: isNotFound ? 404 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      session: result.state?.session,
      teams: result.state?.teams,
      players: result.state?.players,
      rules: result.state?.rules,
      league: result.state?.league,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error executing auction action:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to execute action" },
      { status: 500 }
    );
  }
}
