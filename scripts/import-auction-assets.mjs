#!/usr/bin/env node
/**
 * One-time, resumable import of the supplied Auction_Images ZIP.
 * Usage: DATABASE_URL=... UPLOADTHING_TOKEN=... node scripts/import-auction-assets.mjs /path/to/Auction_Images.zip [league-id]
 */
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pg from "pg";
import { UTApi } from "uploadthing/server";

const exec = promisify(execFile);
const [zipPath, leagueId = "league-main"] = process.argv.slice(2);
if (!zipPath || !process.env.DATABASE_URL || !process.env.UPLOADTHING_TOKEN) {
  console.error("Usage: DATABASE_URL=... UPLOADTHING_TOKEN=... node scripts/import-auction-assets.mjs <zip> [league-id]");
  process.exit(1);
}

const contentTypes = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const normalized = (name) => name.toLowerCase().replace(/\([^)]*\)/g, "").replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "").replace(/^_|_$/g, "");
const categoryFor = (archivePath) => /\/players\//i.test(archivePath) ? "players" : /\/teams\//i.test(archivePath) ? "teams" : "league";
const isPlaceholder = (name) => /^none(?:\(\d+\))?\./i.test(basename(name));

const temp = await mkdtemp(join(tmpdir(), "auction-assets-"));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const utapi = new UTApi({ token: process.env.UPLOADTHING_TOKEN });
const manifest = { zip: resolve(zipPath), leagueId, startedAt: new Date().toISOString(), uploaded: [], linked: [], ambiguous: [], skipped: [], failed: [] };

try {
  // Assets reference a tournament. Create the empty destination safely when a
  // data export has not yet populated it; a later Sheets snapshot import will
  // replace this placeholder configuration without touching its assets.
  await pool.query(
    "INSERT INTO auction_leagues(id,data,rules) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
    [leagueId, { id: leagueId, slug: leagueId, name: "Imported Auction", primaryColor: "#059669", secondaryColor: "#38bdf8", status: "IDLE" }, {}]
  );
  await pool.query(
    "INSERT INTO auction_states(league_id,data,version) VALUES($1,$2,1) ON CONFLICT(league_id) DO NOTHING",
    [leagueId, { id: `auction-${leagueId}`, seasonId: leagueId, status: "IDLE", currentPlayerId: null, currentHighestBid: 0, currentLeadingTeamId: null, bidCount: 0, timerSeconds: 30, timerExpiresAt: "", round: 1, bidExtensionSeconds: 15, version: 1, updatedAt: new Date().toISOString() }]
  );
  await exec("unzip", ["-qq", resolve(zipPath), "-d", temp]);
  const { stdout } = await exec("find", [temp, "-type", "f"]);
  const files = stdout.trim().split("\n").filter(Boolean);
  const dbPlayers = (await pool.query("SELECT id, data FROM auction_players WHERE league_id=$1", [leagueId])).rows;
  const dbTeams = (await pool.query("SELECT id, data FROM auction_teams WHERE league_id=$1", [leagueId])).rows;
  const candidates = {
    players: dbPlayers.map((r) => ({ id: r.id, name: normalized(r.data.fullName || r.data.name || "") })),
    teams: dbTeams.map((r) => ({ id: r.id, name: normalized(r.data.name || "") })),
  };

  for (const filePath of files) {
    const archivePath = relative(temp, filePath);
    const ext = extname(filePath).toLowerCase();
    const mime = contentTypes[ext];
    if (!mime) { manifest.skipped.push({ archivePath, reason: "unsupported file type" }); continue; }
    const bytes = await readFile(filePath);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const existing = await pool.query("SELECT id, url, file_key FROM media_assets WHERE content_hash=$1 AND archive_path=$2", [hash, archivePath]);
    if (existing.rowCount) { manifest.skipped.push({ archivePath, reason: "already imported", assetId: existing.rows[0].id }); continue; }
    const category = categoryFor(archivePath);
    const matches = category === "league" || isPlaceholder(archivePath) ? [] : candidates[category].filter((c) => c.name === normalized(archivePath));
    let uploaded;
    try {
      uploaded = await utapi.uploadFiles(new File([bytes], basename(filePath), { type: mime }));
      if (uploaded.error || !uploaded.data) throw new Error(uploaded.error?.message || "UploadThing returned no file data");
    } catch (error) { manifest.failed.push({ archivePath, error: error instanceof Error ? error.message : String(error) }); continue; }
    const data = uploaded.data;
    const entity = matches.length === 1 ? matches[0] : null;
    const asset = await pool.query(
      "INSERT INTO media_assets(league_id,category,file_key,url,file_name,mime_type,content_hash,archive_path,entity_type,entity_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
      [leagueId, category, data.key, data.ufsUrl || data.url, basename(filePath), mime, hash, archivePath, entity ? category.slice(0, -1) : null, entity?.id || null]
    );
    manifest.uploaded.push({ archivePath, assetId: asset.rows[0].id, url: data.ufsUrl || data.url, key: data.key });
    if (entity) manifest.linked.push({ archivePath, entityId: entity.id, entityType: category.slice(0, -1) });
    else if (category !== "league" && !isPlaceholder(archivePath)) manifest.ambiguous.push({ archivePath, category, matches: matches.map((m) => m.id) });
  }
} finally {
  manifest.finishedAt = new Date().toISOString();
  await writeFile(join(process.cwd(), "auction-asset-import-manifest.json"), JSON.stringify(manifest, null, 2));
  await pool.end();
  await rm(temp, { recursive: true, force: true });
}

console.log(JSON.stringify({ uploaded: manifest.uploaded.length, linked: manifest.linked.length, ambiguous: manifest.ambiguous.length, failed: manifest.failed.length, manifest: "auction-asset-import-manifest.json" }, null, 2));
