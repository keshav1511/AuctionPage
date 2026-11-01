import { NextRequest, NextResponse } from "next/server";
import { reconcileLeaguePurchasesAndPurses } from "@/lib/sheets/google-sheets-repository";
import { authenticateAdminActionRequest } from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const leagueId = body.leagueId || "league-main";

    // 1. Authenticate administrative privileges
    const auth = authenticateAdminActionRequest(req, leagueId);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || "Administrator authentication required for data reconciliation" },
        { status: 401 }
      );
    }

    // 2. Execute reconciliation audit and recovery
    const report = await reconcileLeaguePurchasesAndPurses(leagueId);

    return NextResponse.json({
      success: true,
      message: `Reconciliation complete. ${report.discrepanciesFound} discrepancies repaired.`,
      report,
    });
  } catch (error) {
    console.error("[ReconciliationAPI] Error executing reconciliation:", error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || "Data reconciliation failed",
      },
      { status: 500 }
    );
  }
}
