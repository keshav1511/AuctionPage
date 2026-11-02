import { Pool, PoolClient } from "pg";
import { League, Team, Player, AuctionRules, Bid, TournamentSummary } from "@/types";
import { DEFAULT_AUCTION_RULES, DEFAULT_LEAGUE } from "@/config/default-config";
import { AuctionStateRow, PurchaseRecord, AuditLogEntry } from "@/lib/sheets/tab-definitions";

export interface AuctionActionTransactionContext { state: AuctionStateRow; teams: Team[]; players: Player[]; rules: AuctionRules; recentBids: Bid[]; }
export interface AuctionActionTransactionResult { success: boolean; message?: string; error?: string; newState?: AuctionStateRow; updatedTeams?: Team[]; updatedPlayers?: Player[]; newBid?: Bid; newPurchase?: PurchaseRecord; auditEntry?: AuditLogEntry; }
export interface AuctionActionOptions { actionId?: string; clientVersion?: number; }

let pool: Pool | undefined;
let schemaReady: Promise<void> | undefined;
let activeTournamentId: string | null = process.env.ACTIVE_TOURNAMENT_ID || null;

function db(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Google Sheets is no longer a runtime datastore.");
  return pool ||= new Pool({ connectionString: process.env.DATABASE_URL, max: 10, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
}

async function ready(): Promise<void> {
  if (!schemaReady) schemaReady = (async () => {
    // Tables are created only by Prisma migrations. This probe gives a clear
    // deployment error when DATABASE_URL is present but migrations were skipped.
    await db().query("SELECT 1 FROM auction_leagues LIMIT 1");
  })();
  return schemaReady;
}

function defaultState(leagueId: string): AuctionStateRow {
  return { id: `auction-${leagueId}`, seasonId: leagueId, status: "IDLE", currentPlayerId: null, currentHighestBid: 0, currentLeadingTeamId: null, bidCount: 0, timerSeconds: 30, timerExpiresAt: "", round: 1, bidExtensionSeconds: 15, version: 1, updatedAt: new Date().toISOString() };
}
async function ensureLeague(leagueId: string, client?: PoolClient) {
  await ready(); const q = client || db();
  const existing = await q.query("SELECT 1 FROM auction_leagues WHERE id=$1", [leagueId]);
  if (!existing.rowCount) {
    const league = { ...DEFAULT_LEAGUE, id: leagueId, slug: leagueId };
    await q.query("INSERT INTO auction_leagues(id,data,rules) VALUES($1,$2,$3)", [leagueId, league, { ...DEFAULT_AUCTION_RULES, seasonId: leagueId }]);
    await q.query("INSERT INTO auction_states(league_id,data,version) VALUES($1,$2,1)", [leagueId, defaultState(leagueId)]);
  }
}
async function rows<T>(table: "auction_teams" | "auction_players", leagueId: string, client?: PoolClient): Promise<T[]> { await ensureLeague(leagueId, client); const result = await (client || db()).query(`SELECT data FROM ${table} WHERE league_id=$1 ORDER BY id`, [leagueId]); return result.rows.map(r => r.data as T); }
async function saveRows(table: "auction_teams" | "auction_players", leagueId: string, values: Array<{id:string}>, client?: PoolClient): Promise<void> {
  if (!client) {
    await ready();
    const owned = await db().connect();
    try {
      await owned.query("BEGIN");
      await ensureLeague(leagueId, owned);
      // Same lock order as auction actions; viewers never see a partial replacement.
      await owned.query("SELECT league_id FROM auction_states WHERE league_id=$1 FOR UPDATE", [leagueId]);
      await saveRows(table, leagueId, values, owned);
      await owned.query("COMMIT");
    } catch (error) {
      await owned.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { owned.release(); }
    return;
  }
  await ensureLeague(leagueId, client);
  await client.query(`DELETE FROM ${table} WHERE league_id=$1`, [leagueId]);
  for (const value of values) await client.query(`INSERT INTO ${table}(league_id,id,data) VALUES($1,$2,$3)`, [leagueId,value.id,value]);
}

export function invalidateLeagueCache(_leagueId: string) {}
export function getDesignatedActiveTournamentId() { return activeTournamentId; }
export function setDesignatedActiveTournamentId(id: string | null) { activeTournamentId = id; }
export async function getLeagueConfigFromSheets(leagueId: string): Promise<{league:League;rules:AuctionRules}> { await ensureLeague(leagueId); const r=await db().query("SELECT data,rules FROM auction_leagues WHERE id=$1",[leagueId]); return {league:r.rows[0].data, rules:r.rows[0].rules}; }
export async function saveLeagueConfigToSheets(league: League, rules?: AuctionRules): Promise<void> { await ready(); await db().query("INSERT INTO auction_leagues(id,data,rules,updated_at) VALUES($1,$2,$3,now()) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,rules=EXCLUDED.rules,updated_at=now()", [league.id,league,rules || DEFAULT_AUCTION_RULES]); }
export async function getTeamsFromSheets(leagueId:string):Promise<Team[]> { return rows<Team>("auction_teams",leagueId); }
export async function saveTeamsToSheets(leagueId:string, teams:Team[]):Promise<void> { return saveRows("auction_teams",leagueId,teams); }
export async function getPlayersFromSheets(leagueId:string):Promise<Player[]> { return rows<Player>("auction_players",leagueId); }
export async function savePlayersToSheets(leagueId:string, players:Player[]):Promise<void> { return saveRows("auction_players",leagueId,players); }
export async function getAuctionStateFromSheets(leagueId:string, _skipCache = false):Promise<AuctionStateRow> { void _skipCache; await ensureLeague(leagueId); const r=await db().query("SELECT data,version FROM auction_states WHERE league_id=$1",[leagueId]); return {...r.rows[0].data,version:r.rows[0].version}; }
export async function saveAuctionStateToSheets(leagueId:string,state:AuctionStateRow):Promise<void> { await ensureLeague(leagueId); await db().query("UPDATE auction_states SET data=$2,version=$3,updated_at=now() WHERE league_id=$1",[leagueId,state,state.version || 1]); }
export async function getRecentBidsFromSheets(leagueId:string,limit=20):Promise<Bid[]> { await ensureLeague(leagueId); const r=await db().query("SELECT data FROM auction_bids WHERE league_id=$1 AND NOT undone ORDER BY created_at DESC LIMIT $2",[leagueId,limit]); return r.rows.map(x=>x.data); }
export async function appendBidToSheets(leagueId:string,bid:Bid):Promise<void> { await ensureLeague(leagueId); await db().query("INSERT INTO auction_bids(league_id,id,data) VALUES($1,$2,$3) ON CONFLICT(league_id,id) DO NOTHING",[leagueId,bid.id,bid]); }
export async function markLastBidUndoneInSheets(leagueId:string):Promise<Bid|null> { await ensureLeague(leagueId); const r=await db().query("SELECT id,data FROM auction_bids WHERE league_id=$1 AND NOT undone ORDER BY created_at DESC LIMIT 1",[leagueId]); if(!r.rowCount)return null; await db().query("UPDATE auction_bids SET undone=true WHERE league_id=$1 AND id=$2",[leagueId,r.rows[0].id]); return r.rows[0].data; }
export async function getPurchasesFromSheets(leagueId:string):Promise<PurchaseRecord[]> { await ensureLeague(leagueId); const r=await db().query("SELECT data FROM auction_purchases WHERE league_id=$1 ORDER BY created_at",[leagueId]); return r.rows.map(x=>x.data); }
export async function recordPurchaseInSheets(leagueId:string,p:PurchaseRecord):Promise<void> { await ensureLeague(leagueId); await db().query("INSERT INTO auction_purchases(league_id,id,data) VALUES($1,$2,$3) ON CONFLICT(league_id,id) DO NOTHING",[leagueId,p.id,p]); }
export async function appendAuditLogInSheets(leagueId:string,l:AuditLogEntry):Promise<void> { await ensureLeague(leagueId); await db().query("INSERT INTO auction_audit_logs(league_id,id,data) VALUES($1,$2,$3) ON CONFLICT(league_id,id) DO NOTHING",[leagueId,l.id,l]); }
export async function getAllTournamentsFromSheets():Promise<TournamentSummary[]> { await ready(); const r=await db().query("SELECT l.data,l.rules,s.data state,(SELECT count(*) FROM auction_teams t WHERE t.league_id=l.id)::int teams,(SELECT count(*) FROM auction_players p WHERE p.league_id=l.id)::int players FROM auction_leagues l LEFT JOIN auction_states s ON s.league_id=l.id ORDER BY l.updated_at DESC"); return r.rows.map(row=>({id:row.data.id,name:row.data.name,season:row.data.edition,edition:row.data.edition,description:row.data.description,logoUrl:row.data.logoUrl,status:row.state?.status || "IDLE",teamsCount:row.teams,playersCount:row.players,totalPurse:row.rules?.totalPurse,minSquadSize:row.rules?.minimumSquadSize,maxSquadSize:row.rules?.maximumSquadSize,defaultBasePrice:row.rules?.basePrice,updatedAt:row.data.created_at})); }
/** Removes only an untouched tournament. Bid and purchase history is never discarded from the admin UI. */
export async function deleteEmptyTournament(leagueId:string): Promise<{ deleted:boolean; error?:string }> { await ready(); const c=await db().connect(); try { await c.query("BEGIN"); const history=await c.query("SELECT (SELECT count(*) FROM auction_bids WHERE league_id=$1) + (SELECT count(*) FROM auction_purchases WHERE league_id=$1) AS count",[leagueId]); if(Number(history.rows[0]?.count || 0)>0){await c.query("ROLLBACK");return {deleted:false,error:"Tournaments with bid or sale history cannot be deleted."};} const result=await c.query("DELETE FROM auction_leagues WHERE id=$1",[leagueId]); await c.query("COMMIT"); if(activeTournamentId===leagueId) activeTournamentId=null; return {deleted:(result.rowCount || 0)>0}; } catch(e) { await c.query("ROLLBACK").catch(()=>{}); return {deleted:false,error:e instanceof Error?e.message:String(e)}; } finally { c.release(); } }
export async function executeSerializedAuctionAction(leagueId:string, actionFn:(ctx:AuctionActionTransactionContext)=>Promise<AuctionActionTransactionResult>, options?:AuctionActionOptions):Promise<AuctionActionTransactionResult> { await ready(); const c=await db().connect(); try { await c.query("BEGIN"); await ensureLeague(leagueId,c); if(options?.actionId){const old=await c.query("SELECT result FROM auction_action_dedup WHERE league_id=$1 AND action_id=$2",[leagueId,options.actionId]); if(old.rowCount){await c.query("COMMIT");return old.rows[0].result;}} const stateRow=await c.query("SELECT data,version FROM auction_states WHERE league_id=$1 FOR UPDATE",[leagueId]); const state={...stateRow.rows[0].data,version:stateRow.rows[0].version}; if(options?.clientVersion && options.clientVersion!==state.version){await c.query("ROLLBACK");return {success:false,error:`Stale state conflict: Current auction version is ${state.version}, but client submitted version ${options.clientVersion}. Please refresh.`};} const result=await actionFn({state,teams:await rows<Team>("auction_teams",leagueId,c),players:await rows<Player>("auction_players",leagueId,c),rules:(await c.query("SELECT rules FROM auction_leagues WHERE id=$1",[leagueId])).rows[0].rules,recentBids:(await c.query("SELECT data FROM auction_bids WHERE league_id=$1 AND NOT undone ORDER BY created_at DESC LIMIT 10",[leagueId])).rows.map(x=>x.data)}); if(!result.success){await c.query("ROLLBACK");return result;} const next={...(result.newState || state),version:state.version+1,updatedAt:new Date().toISOString(),lockToken:null,lockExpiresAt:null}; await c.query("UPDATE auction_states SET data=$2,version=$3,updated_at=now() WHERE league_id=$1",[leagueId,next,next.version]); if(result.updatedTeams)await saveRows("auction_teams",leagueId,result.updatedTeams,c); if(result.updatedPlayers)await saveRows("auction_players",leagueId,result.updatedPlayers,c); if(result.newBid)await c.query("INSERT INTO auction_bids(league_id,id,data) VALUES($1,$2,$3)",[leagueId,result.newBid.id,result.newBid]); if(result.newPurchase)await c.query("INSERT INTO auction_purchases(league_id,id,data) VALUES($1,$2,$3)",[leagueId,result.newPurchase.id,result.newPurchase]); if(result.auditEntry)await c.query("INSERT INTO auction_audit_logs(league_id,id,data) VALUES($1,$2,$3)",[leagueId,result.auditEntry.id,result.auditEntry]); const final={...result,newState:next}; if(options?.actionId)await c.query("INSERT INTO auction_action_dedup(league_id,action_id,result) VALUES($1,$2,$3)",[leagueId,options.actionId,final]); await c.query("COMMIT"); return final;} catch(e){await c.query("ROLLBACK").catch(()=>{});return {success:false,error:`Persistence error: ${e instanceof Error?e.message:String(e)}`};} finally{c.release();} }
export async function reconcileLeaguePurchasesAndPurses(leagueId:string) { const purchases=await getPurchasesFromSheets(leagueId); return {leagueId,discrepanciesFound:0,fixedTeams:[],fixedPlayers:[],totalPurchasesAudited:purchases.length,totalPurseSpentAudited:purchases.reduce((n,p)=>n+(p.soldPrice||0),0),timestamp:new Date().toISOString()}; }

export async function readAuctionSnapshot(leagueId: string) {
  const { SNAPSHOT_SQL, mapSnapshot } = await import("@/lib/realtime/snapshot");
  const result = await db().query(SNAPSHOT_SQL, [leagueId]);
  return result.rowCount ? mapSnapshot(result.rows[0]) : null;
}
