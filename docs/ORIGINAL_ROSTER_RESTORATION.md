# Original roster restoration

Source: `1752c37ded54c2fc42db897d2e336f5aa8b0924d:src/config/ntl-season-1.ts`.
The reviewed historical module supplies the original 24 players, 4 teams,
owners, icons, configuration, and rules. Entity IDs and registration numbers are
preserved, with season references mapped to `league-main`.

Preview with `npm run restore:original-roster`. Apply with
`npm run restore:original-roster -- --apply`. Credentials load from ignored
`.env.local`; the script makes no new UploadThing uploads.

The entire database update runs in a transaction and locks the destination
league and auction state. Auction activity, non-placeholder configuration,
conflicting roster rows, or subsequent edits to restored data abort restoration.
An unchanged second run preserves row counts and the auction version.

Images match normalized filenames, with explicit player aliases in the script.
Category subfolders take precedence over root-level originals, matching the old
Apps Script upload folders. Equivalent duplicate files must share a content
hash; differing candidates are reported for review. Asset ownership is stored
in `media_assets.entity_type` and `entity_id`; exact field assignments and aliases
are saved in `auction_leagues.data.importMetadata`.

The applied restoration has 34 image assignments: 22 player photos, 4 team logos,
3 owner photos, 3 icon photos, and 2 league/organization logos. Missing original
photos remain blank for Somprasad, Shukha Bhat, D Varun Kamath, and Akshay Pai.
All 94 imported asset entries are retained.

This restores initial season data, not subsequent edits or auction history from
Google Sheets. No bids, purchases, or historical audit records are invented.
