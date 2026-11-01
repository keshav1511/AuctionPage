// ==============================================================================
// NALANDA TURF LEAGUE - TEAM PARTICIPANT SIZE CALCULATOR & VALIDATION
// Authoritative formula: Total Team Size = Registered Players + Team Owner (1) + Team Icon (1)
// ==============================================================================

import { Team } from "@/types";

export interface TeamParticipantCounts {
  registeredPlayersCount: number;
  hasOwner: boolean;
  hasIcon: boolean;
  ownerCount: number; // 0 or 1
  iconCount: number; // 0 or 1
  totalParticipants: number; // registeredPlayers + ownerCount + iconCount
}

/**
 * Calculates total participants for a team:
 * Total = Registered Players + Team Owner (1 if assigned) + Team Icon (1 if assigned)
 */
export function getTeamParticipantCounts(
  team: Pick<Team, "ownerName" | "iconPlayerName"> | null | undefined,
  registeredPlayersCount: number = 0
): TeamParticipantCounts {
  const safeRegistered = Math.max(0, registeredPlayersCount);
  const hasOwner = Boolean(team?.ownerName && team.ownerName.trim().length > 0);
  const hasIcon = Boolean(team?.iconPlayerName && team.iconPlayerName.trim().length > 0);
  const ownerCount = hasOwner ? 1 : 0;
  const iconCount = hasIcon ? 1 : 0;
  const totalParticipants = safeRegistered + ownerCount + iconCount;

  return {
    registeredPlayersCount: safeRegistered,
    hasOwner,
    hasIcon,
    ownerCount,
    iconCount,
    totalParticipants,
  };
}

/**
 * Generates clear, human-readable breakdown string
 * Example: "8 players + 1 owner + 1 icon = 10"
 */
export function formatTeamParticipantBreakdown(counts: TeamParticipantCounts): string {
  const parts: string[] = [`${counts.registeredPlayersCount} players`];
  if (counts.hasOwner) parts.push("1 owner");
  if (counts.hasIcon) parts.push("1 icon");
  return `${parts.join(" + ")} = ${counts.totalParticipants}`;
}

/**
 * Validates minimum squad constraint using total participants
 */
export function isTeamMinimumSquadReached(
  team: Pick<Team, "ownerName" | "iconPlayerName"> | null | undefined,
  registeredPlayersCount: number,
  minSquadSize: number
): { reached: boolean; counts: TeamParticipantCounts; remainingSlotsNeeded: number } {
  const counts = getTeamParticipantCounts(team, registeredPlayersCount);
  const remainingSlotsNeeded = Math.max(0, minSquadSize - counts.totalParticipants);
  return {
    reached: counts.totalParticipants >= minSquadSize,
    counts,
    remainingSlotsNeeded,
  };
}

/**
 * Validates maximum squad limit constraint using total participants
 */
export function isTeamMaximumSquadReached(
  team: Pick<Team, "ownerName" | "iconPlayerName"> | null | undefined,
  registeredPlayersCount: number,
  maxSquadSize: number
): { reached: boolean; counts: TeamParticipantCounts } {
  const counts = getTeamParticipantCounts(team, registeredPlayersCount);
  return {
    reached: counts.totalParticipants >= maxSquadSize,
    counts,
  };
}
