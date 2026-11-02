#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import vm from "node:vm";
import ts from "typescript";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
const apply = process.argv.includes("--apply");
const leagueId = "league-main";
const sourceCommit = execFileSync("git", ["rev-parse", "1752c37^{commit}"], { encoding: "utf8" }).trim();
const source = execFileSync("git", ["show", `${sourceCommit}:src/config/ntl-season-1.ts`], { encoding: "utf8" });
// Evaluate only this reviewed, pinned repository module, with no filesystem or
// network globals. Type-only imports disappear during transpilation.
const moduleExports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: moduleExports }, { timeout: 1000 });
const original = JSON.parse(JSON.stringify(moduleExports));
if (original.NTL_PLAYERS.length !== 24 || original.NTL_TEAMS.length !== 4) throw new Error("Unexpected historical roster size");
const normalize = value => value.replace(/\.[^.]+$/, "").replace(/\(\d+\)$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = {
  "ntl-p-01": "SUDESH_BHAT", "ntl-p-03": "GANESH_KAMATH",
  "ntl-p-09": "VINAY_RAO", "ntl-p-10": "SATWHIK_KAMATH",
  "ntl-p-12": "TRIVIKRAM_SHENOY", "ntl-p-13": "VIKRAM_KAMATH",
  "ntl-p-15": "ABHI", "ntl-p-16": "KUTTA",
  "ntl-p-19": "ANIRUDH_BHAT", "ntl-p-20": "Srinath", "ntl-p-22": "Advaith",
};
const logos = {
  "team-park-friends": "Park_Friends_Cricketers_Crest",
  "team-bhadra-challengers": "Bhadra_Challengers_Crest_Logo",
  "team-royal-strikers": "Royal_Strikers_Eagle_Emblem",
  "team-tactical-turf-dragons": "Tactical_Turf_Dragons_Cricket_Crest",
};
const report = { sourceCommit, leagueId, mode: apply ? "apply" : "dry-run", linked: [], missing: [], conflicts: [] };
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  // Same row lock used by auction writes. All validation and assignments occur
  // before commit, so no viewer can observe a partly restored roster.
  const leagueRow = (await client.query("SELECT data,rules FROM auction_leagues WHERE id=$1 FOR UPDATE", [leagueId])).rows[0];
  const stateRow = (await client.query("SELECT data,version FROM auction_states WHERE league_id=$1 FOR UPDATE", [leagueId])).rows[0];
  if (!leagueRow || !stateRow) throw new Error("Destination league/state is missing");
  const activity = (await client.query(`SELECT
    (SELECT count(*) FROM auction_bids WHERE league_id=$1) +
    (SELECT count(*) FROM auction_purchases WHERE league_id=$1) +
    (SELECT count(*) FROM auction_action_dedup WHERE league_id=$1) +
    (SELECT count(*) FROM auction_audit_logs WHERE league_id=$1) AS count`, [leagueId])).rows[0];
  const state = stateRow.data;
  if (Number(activity.count) || state.status !== "IDLE" || state.currentPlayerId || state.currentLeadingTeamId || Number(state.bidCount) || Number(state.currentHighestBid) || Number(state.round) > 1 || state.round1Completed || state.lockToken) throw new Error("Auction activity detected; restoration aborted");
  const assets = (await client.query("SELECT * FROM media_assets WHERE league_id=$1 ORDER BY archive_path,id", [leagueId])).rows;
  const assignments = [];
  function link(category, filename, entityType, entityId, field) {
    const target = { entityType, entityId, field, filename };
    if (!filename || normalize(filename) === "none") { report.missing.push({ ...target, reason: "No original photograph" }); return ""; }
    const matching = assets.filter(a => a.category === category && normalize(a.file_name) === normalize(filename));
    // Root-level originals and later category-specific versions coexist in the
    // archive. Prefer the category subfolder used by the old upload endpoint.
    const inCategoryFolder = matching.filter(a => a.archive_path?.includes(`/${category}/`));
    const candidates = inCategoryFolder.length ? inCategoryFolder : matching;
    if (!candidates.length) { report.missing.push({ ...target, reason: "Asset not found" }); return ""; }
    if (candidates.some(a => !a.content_hash) || new Set(candidates.map(a => a.content_hash)).size !== 1) { report.conflicts.push({ ...target, reason: "Different images share this filename" }); return ""; }
    // Prefer the unsuffixed original; all remaining candidates have identical bytes.
    candidates.sort((a,b) => a.file_name.length - b.file_name.length || a.archive_path.localeCompare(b.archive_path));
    const asset = candidates[0];
    const url = new URL(asset.url);
    if (url.protocol !== "https:" || !["ufs.sh", "utfs.io", "uploadthing.com"].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new Error("Unexpected media host");
    if (asset.entity_id && (asset.entity_id !== entityId || asset.entity_type !== entityType)) throw new Error(`Asset already assigned to another entity: ${asset.id}`);
    assignments.push({ assetId: asset.id, entityType, entityId, field });
    report.linked.push({ ...target, assetId: asset.id, fileKey: asset.file_key });
    return asset.url;
  }
  const players = original.NTL_PLAYERS.map(p => ({ ...p, seasonId: leagueId, photoUrl: link("players", p.photoUrl ? aliases[p.id] || p.fullName : "", "player", p.id, "photoUrl") }));
  const teams = original.NTL_TEAMS.map(t => {
    const owner = original.NTL_OWNERS.find(p => p.teamAffiliation === t.name);
    const icon = original.NTL_ICONS.find(p => p.teamAffiliation === t.name);
    return { ...t, seasonId: leagueId,
      logoUrl: link("teams", logos[t.id], "team", t.id, "logoUrl"),
      ownerPhotoUrl: link("teams", owner?.photoFilename, "team", t.id, "ownerPhotoUrl"),
      iconPlayerPhotoUrl: link("teams", icon?.photoFilename, "team", t.id, "iconPlayerPhotoUrl"),
    };
  });
  const league = { ...original.NTL_DEFAULT_LEAGUE, id: leagueId, edition: "Season 1", status: "IDLE",
    orgName: original.NTL_ORGANIZATIONS.YOUNG_BOYS_NALANDA.name,
    logoUrl: link("league", "ChatGPT_Image_Nov_1__2026__05_52_10_PM", "league", leagueId, "logoUrl"),
    orgLogoUrl: link("league", "Young_Boys_Nalanda_Cricket_Emblem", "league", leagueId, "orgLogoUrl"),
  };
  delete league.googleSheetsUrl;
  delete league.googleDriveFolderUrl;
  // Field assignments live with the import provenance in JSONB; the existing
  // media columns retain the owning entity without requiring a schema change.
  league.importMetadata = { sourceCommit, restoration: "original-ntl-roster-v1", assetAssignments: assignments, photoAliases: aliases };
  const rules = { ...original.NTL_DEFAULT_RULES, seasonId: leagueId, totalPurse: original.NTL_DEFAULT_RULES.purseAmount, basePrice: original.NTL_DEFAULT_RULES.minimumBasePrice };
  const alreadyRestored = leagueRow.data.importMetadata?.restoration === "original-ntl-roster-v1";
  if (alreadyRestored && (!isDeepStrictEqual(leagueRow.data, league) || !isDeepStrictEqual(leagueRow.rules, rules))) throw new Error("Restored configuration was edited; refusing to overwrite");
  if (!alreadyRestored && leagueRow.data.name !== "Imported Auction") throw new Error("Destination configuration is not the empty import placeholder");
  for (const [table, expected] of [["auction_players", players], ["auction_teams", teams]]) {
    const current = (await client.query(`SELECT id,data FROM ${table} WHERE league_id=$1`, [leagueId])).rows;
    for (const row of current) {
      const match = expected.find(x => x.id === row.id);
      if (!alreadyRestored || !match || !isDeepStrictEqual(row.data, match)) throw new Error(`Conflicting existing record: ${table}/${row.id}`);
    }
    for (const record of expected) await client.query(`INSERT INTO ${table}(league_id,id,data) VALUES($1,$2,$3) ON CONFLICT(league_id,id) DO NOTHING`, [leagueId, record.id, record]);
    const saved = (await client.query(`SELECT id,data FROM ${table} WHERE league_id=$1 ORDER BY id`, [leagueId])).rows;
    if (saved.length !== expected.length || saved.some(row => !isDeepStrictEqual(row.data, expected.find(x => x.id === row.id)))) throw new Error(`${table} verification failed`);
  }
  if (!alreadyRestored) {
    await client.query("UPDATE auction_leagues SET data=$2,rules=$3,updated_at=now() WHERE id=$1", [leagueId, league, rules]);
    const nextState = { ...state, timerSeconds: rules.initialTimerSeconds, bidExtensionSeconds: rules.bidExtensionSeconds, updatedAt: new Date().toISOString(), version: stateRow.version + 1 };
    await client.query("UPDATE auction_states SET data=$2,version=$3,updated_at=now() WHERE league_id=$1", [leagueId, nextState, nextState.version]);
  }
  for (const assignment of assignments) await client.query("UPDATE media_assets SET entity_type=$2,entity_id=$3 WHERE id=$1", [assignment.assetId, assignment.entityType, assignment.entityId]);
  const imageUrls = [...players.map(p => p.photoUrl), ...teams.flatMap(t => [t.logoUrl,t.ownerPhotoUrl,t.iconPlayerPhotoUrl]), league.logoUrl, league.orgLogoUrl].filter(Boolean);
  if (imageUrls.some(url => !assets.some(a => a.url === url))) throw new Error("Image references do not resolve to the asset library");
  report.players = players.length;
  report.teams = teams.length;
  report.assetCount = assets.length;
  report.alreadyRestored = alreadyRestored;
  report.registrationNumbersVerified = new Set(players.map(p => p.registrationNo)).size === 24;
  await client.query(apply ? "COMMIT" : "ROLLBACK");
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally { client.release(); await pool.end(); }
