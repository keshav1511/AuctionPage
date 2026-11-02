import type { AuctionSession, Team, Player, AuctionRules, Bid, League, Round2QueueItem, AuctionAnnouncement } from "@/types";
import type { AuctionStateRow } from "@/lib/sheets/tab-definitions";

export function buildAuctionSession(
  state: AuctionStateRow,
  players: Player[],
  teams: Team[],
  recentBids: Bid[],
  rules: AuctionRules
): AuctionSession {
  const currentPlayer = state.currentPlayerId
    ? players.find(
        (p) =>
          p.id === state.currentPlayerId ||
          p.registrationNo === state.currentPlayerId ||
          (p.fullName && p.fullName === state.currentPlayerId)
      ) || null
    : null;

  const currentLeadingTeam = state.currentLeadingTeamId
    ? teams.find(
        (t) =>
          t.id === state.currentLeadingTeamId ||
          t.shortCode === state.currentLeadingTeamId
      ) || null
    : null;

  let round2Queue: Round2QueueItem[] | undefined;
  try {
    if (state.round2QueueJson) {
      const parsed = JSON.parse(state.round2QueueJson);
      if (Array.isArray(parsed)) {
        round2Queue = parsed.map((item) =>
          typeof item === "string" ? { id: item, status: "PENDING" as const } : item
        );
      }
    }
  } catch {}

  let announcement: AuctionAnnouncement | null = null;
  try {
    if (state.announcementJson) {
      const parsed = JSON.parse(state.announcementJson);
      if (parsed && parsed.type && parsed.type !== "NONE") {
        const nowMs = Date.now();
        const endsAtMs = parsed.endsAt ? new Date(parsed.endsAt).getTime() : 0;
        if (nowMs < endsAtMs) {
          const annPlayer = parsed.playerId
            ? players.find((p) => p.id === parsed.playerId) || null
            : null;
          const annTeam = parsed.winningTeamId
            ? teams.find((t) => t.id === parsed.winningTeamId) || null
            : null;
          announcement = {
            ...parsed,
            player: annPlayer,
            winningTeam: annTeam,
          };
        }
      }
    }
  } catch {}

  const stateVersion = Number(state.version) || 1;

  return {
    id: state.id,
    seasonId: state.seasonId,
    currentPlayerId: state.currentPlayerId,
    currentPlayer,
    currentHighestBid: state.currentHighestBid || 0,
    currentLeadingTeamId: state.currentLeadingTeamId,
    currentLeadingTeam,
    status: state.status,
    timerSeconds: state.timerSeconds || rules.initialTimerSeconds || 45,
    timerExpiresAt: state.timerExpiresAt,
    bidExtensionSeconds: state.bidExtensionSeconds || rules.bidExtensionSeconds || 10,
    round: state.round || 1,
    roundStage: state.roundStage || (state.round === 2 ? "ROUND_2" : "MAIN"),
    round2Queue,
    round2InitializedAt: state.round2InitializedAt,
    round1Completed: state.round1Completed,
    announcement,
    bidCount: state.bidCount || 0,
    recentBids,
    version: stateVersion,
    revision: stateVersion,
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
}

export interface AuctionSnapshot {
  league: League;
  session: AuctionSession;
  teams: Team[];
  players: Player[];
  rules: AuctionRules;
  revision: number;
  pausedRemainingSeconds?: number;
}

// One SQL statement gives every entity and cursor the same MVCC snapshot.
export const SNAPSHOT_SQL = `SELECT l.data AS league, l.rules, s.data AS state,
  s.version, COALESCE(r.revision,0)::text AS revision,
  COALESCE((SELECT jsonb_agg(t.data ORDER BY t.id) FROM auction_teams t WHERE t.league_id=l.id),'[]'::jsonb) AS teams,
  COALESCE((SELECT jsonb_agg(p.data ORDER BY p.id) FROM auction_players p WHERE p.league_id=l.id),'[]'::jsonb) AS players,
  COALESCE((SELECT jsonb_agg(b.data ORDER BY b.created_at DESC) FROM
    (SELECT data,created_at FROM auction_bids WHERE league_id=l.id AND NOT undone ORDER BY created_at DESC LIMIT 20) b),'[]'::jsonb) AS bids
  FROM auction_leagues l JOIN auction_states s ON s.league_id=l.id
  JOIN auction_revisions r ON r.league_id=l.id WHERE l.id=$1`;

export interface SnapshotRow {
  league: League; rules: AuctionRules; state: AuctionStateRow; version: number;
  revision: string; teams: Team[]; players: Player[]; bids: Bid[];
}

export function mapSnapshot(row: SnapshotRow): AuctionSnapshot {
  const session = buildAuctionSession({ ...row.state, version: row.version }, row.players, row.teams, row.bids, row.rules);
  session.revision = Number(row.revision);
  return { league: row.league, rules: row.rules, teams: row.teams, players: row.players,
    session, revision: Number(row.revision), pausedRemainingSeconds: row.state.pausedRemainingSeconds };
}

// Explicit public field lists prevent imported metadata or future private fields leaking.
function pick<T extends object>(value: T, keys: readonly (keyof T)[]): T {
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key,value[key]])) as T;
}
export function publicSnapshot(snapshot: AuctionSnapshot): AuctionSnapshot {
  const league = pick(snapshot.league, ['id','slug','name','description','logoUrl','orgName','orgLogoUrl','defaultBasePrice','defaultPurse','matchDate','matchVenue','auctionDate','auctionTime','timezone','primaryColor','secondaryColor','brandingPalette','backgroundConfig','edition','status','tournamentId']);
  const teams = snapshot.teams.map(t => pick(t, ['id','seasonId','name','shortCode','logoUrl','ownerName','ownerPhotoUrl','iconPlayerName','iconPlayerPhotoUrl','primaryColor','secondaryColor','purse','squadCount','categoryLimits','isCompleted','completionStatus']));
  const players = snapshot.players.map(p => pick(p, ['id','seasonId','registrationNo','fullName','name','category','primaryRole','battingStyle','bowlingStyle','photoUrl','normalizedPhotoUrl','photoAspectRatio','basePrice','basePriceOverride','status','sortOrder','statsSummary','soldToTeamId','soldPrice']));
  const session = buildAuctionSession({ ...snapshot.session, version: snapshot.session.version || 1, timerExpiresAt: snapshot.session.timerExpiresAt || "", bidExtensionSeconds: snapshot.session.bidExtensionSeconds || snapshot.rules.bidExtensionSeconds || 10,
    round2QueueJson: JSON.stringify(snapshot.session.round2Queue || []),
    announcementJson: JSON.stringify(snapshot.session.announcement) }, players, teams,
    snapshot.session.recentBids.map(b => pick(b, ['id','auctionId','playerId','teamId','teamName','teamShortCode','teamLogoUrl','amount','bidType','placedAt'])), snapshot.rules);
  session.revision = snapshot.revision;
  return { ...snapshot, league, teams, players, session };
}
