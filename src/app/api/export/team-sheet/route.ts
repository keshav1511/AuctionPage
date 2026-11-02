import { NextRequest, NextResponse } from "next/server";
import { getTeamsFromSheets, getPlayersFromSheets } from "@/lib/database/postgres-repository";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");
  const leagueId = searchParams.get("leagueId") || "league-main";

  const teams = await getTeamsFromSheets(leagueId);
  const players = await getPlayersFromSheets(leagueId);

  const team = teams.find((t) => t.id === teamId) || teams[0];
  if (!team) {
    return new NextResponse("Team not found", { status: 404 });
  }

  const squad = players.filter((p) => p.soldToTeamId === team.id);

  let csvContent = "Registration No,Player Name,Category,Role,Batting Style,Bowling Style,Winning Bid (INR)\n";
  squad.forEach((player) => {
    csvContent += `${player.registrationNo},"${player.fullName}",${player.category},${player.primaryRole},"${player.battingStyle}","${player.bowlingStyle}",${player.soldPrice || player.basePrice}\n`;
  });

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${team.name.replace(/\s+/g, "_")}_Squad_Sheet.csv"`,
    },
  });
}
