# PostgreSQL and UploadThing cutover

1. Set server-only `DATABASE_URL` and `UPLOADTHING_TOKEN` in the deployment environment. Do not add either value to Git.
2. Start the application once against the empty database to create the auction tables, then pause auction writes.
3. Export the old Apps Script workbook into a JSON snapshot with `league`, `rules`, `teams`, `players`, `auctionState`, `bids`, `purchases`, and `auditLogs`. Preserve all existing IDs.
4. Import and validate it with `npm run import:sheets-export -- /absolute/path/export.json`.
5. Import the supplied ZIP using `npm run import:assets -- /absolute/path/Auction_Images-20261102T150408Z-1-001.zip league-main`. The generated manifest is resumable because successful `archive_path` and SHA-256 pairs are skipped.
6. Review `auction-asset-import-manifest.json`, especially `ambiguous` and placeholder images. Assign assets through the admin picker before reopening bidding.

The import scripts do not contact Google and leave the source workbook unchanged. Importing a snapshot replaces all records for its one league inside one PostgreSQL transaction, so take a database backup before a repeat run.
