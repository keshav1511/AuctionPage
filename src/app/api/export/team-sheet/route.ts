import { NextRequest, NextResponse } from "next/server";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");

  const team = MOCK_TEAMS.find((t) => t.id === teamId) || MOCK_TEAMS[0];
  const squad = MOCK_PLAYERS.filter((p) => p.soldToTeamId === team.id);

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
