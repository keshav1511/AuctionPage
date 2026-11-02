# Auction realtime delivery

`/api/realtime/stream?leagueId=...` runs on Vercel Edge. It opens a direct Neon WebSocket database session, executes `LISTEN auction_changes`, then reads a consistent public snapshot. PostgreSQL triggers advance `auction_revisions` and deliver identifier-only notifications after commit. Each stream reads and sends the latest snapshot, coalescing notifications while a read is in progress. Intermediate bid frames may coalesce, but the snapshot includes the bid ladder and latest result.

Stream revisions cover all relevant entity edits. They are independent from `session.version`, which remains the optimistic concurrency token for bid commands. Reconnect always sends a complete snapshot; event IDs identify revisions but do not promise historical event replay. Current sold/unsold announcements retain their original start and end timestamps, preventing celebration replay on reconnect.

## Configuration and rollout

1. Keep `DATABASE_URL` as the normal Node application connection, usually Neon's pooled URL.
2. Set server-only `DATABASE_DIRECT_URL` to the same Neon database and branch with connection pooling disabled. Copy it from Neon's Connect dialog. Never use a `NEXT_PUBLIC_` prefix. The Edge route rejects pooled hosts and returns 503 when unconfigured; clients then use recovery polling.
3. Apply the repository's Prisma migrations, including `20261102180000_auction_realtime`, before deploying the application. This migration adds a revision table and triggers; it does not replace auction data. Existing leagues begin at revision zero.
4. Deploy and open `/live?tournamentId=YOUR_ID` on a second device while controlling the auction in another session. Confirm bids, leading team, countdown, sold/unsold results, purses, rounds, rules, and branding update without a page refresh.
5. Verify 25 simultaneous viewers against the actual Neon compute limit, leaving room for admin queries, imports, and reconnect overlap. Each live stream occupies one direct database session. Additional browser tabs each count as a viewer. This design is sized for small audiences, not public high-volume broadcasts.

Streams send heartbeats every 10 seconds and rotate after four minutes. The client reconnects with bounded backoff, checks heartbeat freshness, refreshes after tab visibility changes, and polls every five seconds only when the stream is unhealthy. Each snapshot schedules an authoritative Node state request at lot expiry so automatic sale/unsold transitions continue without permanent polling. A transient failure of that request recovers on reconnect or a fallback state read.

Public snapshots omit spreadsheet/Drive configuration and import metadata. The admin action API remains authenticated and uses Node/PostgreSQL. The stream supports Neon infrastructure on Vercel and self-hosted Next.js; generic PostgreSQL without Neon's WebSocket gateway is not an Edge transport.

## Verification

- `npm run type-check` and `npm run build` check application integration and Edge compilation.
- `node scripts/verify-realtime.mjs` exercises actual route logic with a substituted database transport: initial ordering, snapshot privacy, 25 simultaneous streams, notification delivery, cancellation, abort, and pooled-URL rejection. Simulated latency is not hosted delivery evidence.
- `TEST_DATABASE_URL=postgresql://...@localhost/... node scripts/verify-realtime-database.mjs` uses an isolated temporary schema in a disposable local database to check migration SQL, commit-only notifications, rollback, and revisions for entity/configuration changes. It leaves the database's other schemas untouched.
- Alternatively, install `@electric-sql/pglite` in a temporary directory and set `PGLITE_MODULE` to its `dist/index.js` file to validate SQL using embedded PostgreSQL. This does not verify cross-process or Neon network delivery.

Before accepting production: measure commit-to-visible latency with 25 real viewers (target under one second under normal conditions), disconnect/reconnect network access, wait through stream rotation, switch leagues, check concurrent edits and rejected bids, and confirm direct sessions disappear after closing viewers. Hosted migrations, deployment, and physical multi-device acceptance are separate checks.
