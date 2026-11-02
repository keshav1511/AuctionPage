#!/usr/bin/env node
/**
 * Imports a verified, exported snapshot from the former Apps Script workbook.
 * This script never calls Google. Export JSON must contain league, rules, teams,
 * players, auctionState, bids, purchases, and auditLogs for a single league.
 */
import { readFile } from "node:fs/promises";
import pg from "pg";

const [snapshotPath] = process.argv.slice(2);
if (!snapshotPath || !process.env.DATABASE_URL) {
  console.error("Usage: DATABASE_URL=... node scripts/import-sheets-export.mjs <export.json>"); process.exit(1);
}
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const { league, rules, teams = [], players = [], auctionState, bids = [], purchases = [], auditLogs = [] } = snapshot;
if (!league?.id || !rules || !auctionState) throw new Error("Export must contain league.id, rules, and auctionState.");
for (const [name, values] of [["teams", teams], ["players", players], ["bids", bids], ["purchases", purchases], ["auditLogs", auditLogs]]) {
  if (!Array.isArray(values) || values.some((v) => !v?.id)) throw new Error(`${name} must be an array of records with ids.`);
}
const duplicates = (items) => items.length !== new Set(items.map((x) => x.id)).size;
if ([teams, players, bids, purchases, auditLogs].some(duplicates)) throw new Error("Snapshot contains duplicate record IDs.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }); const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [league.id]);
  await c.query("INSERT INTO auction_leagues(id,data,rules,updated_at) VALUES($1,$2,$3,now()) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,rules=EXCLUDED.rules,updated_at=now()", [league.id, league, rules]);
  for (const table of ["auction_teams", "auction_players", "auction_bids", "auction_purchases", "auction_audit_logs"]) await c.query(`DELETE FROM ${table} WHERE league_id=$1`, [league.id]);
  await c.query("INSERT INTO auction_states(league_id,data,version,updated_at) VALUES($1,$2,$3,now()) ON CONFLICT(league_id) DO UPDATE SET data=EXCLUDED.data,version=EXCLUDED.version,updated_at=now()", [league.id, auctionState, auctionState.version || 1]);
  for (const team of teams) await c.query("INSERT INTO auction_teams(league_id,id,data) VALUES($1,$2,$3)", [league.id, team.id, team]);
  for (const player of players) await c.query("INSERT INTO auction_players(league_id,id,data) VALUES($1,$2,$3)", [league.id, player.id, player]);
  for (const bid of bids) await c.query("INSERT INTO auction_bids(league_id,id,data,undone) VALUES($1,$2,$3,$4)", [league.id, bid.id, bid, Boolean(bid.isUndone)]);
  for (const purchase of purchases) await c.query("INSERT INTO auction_purchases(league_id,id,data) VALUES($1,$2,$3)", [league.id, purchase.id, purchase]);
  for (const log of auditLogs) await c.query("INSERT INTO auction_audit_logs(league_id,id,data) VALUES($1,$2,$3)", [league.id, log.id, log]);
  const check = await c.query("SELECT (SELECT count(*) FROM auction_teams WHERE league_id=$1)::int teams, (SELECT count(*) FROM auction_players WHERE league_id=$1)::int players, (SELECT count(*) FROM auction_bids WHERE league_id=$1)::int bids, (SELECT count(*) FROM auction_purchases WHERE league_id=$1)::int purchases", [league.id]);
  if (check.rows[0].teams !== teams.length || check.rows[0].players !== players.length || check.rows[0].bids !== bids.length || check.rows[0].purchases !== purchases.length) throw new Error("Post-import count validation failed.");
  await c.query("COMMIT"); console.log(JSON.stringify({ leagueId: league.id, ...check.rows[0] }));
} catch (error) { await c.query("ROLLBACK"); throw error; } finally { c.release(); await pool.end(); }
