import { NextRequest, NextResponse } from "next/server";
import { authenticateAdminActionRequest } from "@/lib/auth/admin-auth";
import { deleteEmptyTournament } from "@/lib/database/postgres-repository";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  const auth = authenticateAdminActionRequest(req, tournamentId);
  if (!auth.authorized) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  const result = await deleteEmptyTournament(tournamentId);
  if (!result.deleted) return NextResponse.json({ success: false, error: result.error || "Tournament not found." }, { status: result.error ? 409 : 404 });
  return NextResponse.json({ success: true, message: "Empty tournament deleted." });
}
