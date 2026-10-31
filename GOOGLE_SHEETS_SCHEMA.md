# GOOGLE SHEETS DATABASE SCHEMA SPECIFICATION

## Overview
This document specifies the exact structure, column headers, data types, and formatting conventions for the **7 required tabs** in the NTL Auction Platform's Google Sheets database.

Each tournament/league is backed by a single Google Spreadsheet workbook ID (`GOOGLE_SHEETS_DATABASE_ID`).

---

## Tab 1: `League_Config`
Stores core tournament metadata, match scheduling, visual branding tokens, and default auction rules.
* **Row 1**: Column Headers
* **Row 2**: Active League Data (Single Row)

| Column # | Column Name | Type | Example | Description |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `id` | String | `league-ntl` | Unique league identifier. |
| **B** | `slug` | String | `nalanda-turf-league` | URL-safe slug for public routing. |
| **C** | `name` | String | `Nalanda Turf League` | Full tournament display title. |
| **D** | `description` | String | `Premier night turf cricket championship` | Tournament overview. |
| **E** | `logoUrl` | URL | `https://.../logo.png` | Primary tournament badge image URL. |
| **F** | `matchDate` | Date (YYYY-MM-DD) | `2026-11-20` | Scheduled match fixture date. |
| **G** | `matchVenue` | String | `Perfect Pass, Falnir, Mangalore` | Match stadium / venue name. |
| **H** | `auctionDate` | Date (YYYY-MM-DD) | `2026-11-05` | Date of the live player auction. |
| **I** | `auctionTime` | Time (HH:MM) | `18:00` | Start time of the auction. |
| **J** | `timezone` | String | `Asia/Kolkata` | Standard IANA timezone code. |
| **K** | `googleSheetsUrl` | URL | `https://docs.google.com/spreadsheets/d/...` | Source registration sheet URL. |
| **L** | `googleDriveFolderUrl` | URL | `https://drive.google.com/drive/folders/...` | Player photos folder URL. |
| **M** | `primaryColor` | Hex String | `#059669` | Primary theme color. |
| **N** | `secondaryColor` | Hex String | `#F59E0B` | Secondary accent color. |
| **O** | `brandingPaletteJson` | JSON String | `{"primary":"#059669","card":"#11161B"...}` | Serialized 7-color sports branding palette. |
| **P** | `auctionRulesJson` | JSON String | `{"initialTimerSeconds":45,"bidSlabRules":...}` | Serialized default bid slabs and timer rules. |
| **Q** | `updatedAt` | ISO 8601 | `2026-10-31T18:00:00.000Z` | Timestamp of last modification. |

---

## Tab 2: `Teams`
Stores participating franchises, ownership, and authoritative purse balances.
* **Row 1**: Column Headers
* **Rows 2..N**: One row per franchise

| Column # | Column Name | Type | Example | Description |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `id` | String | `team-1` | Unique franchise identifier. |
| **B** | `seasonId` | String | `league-ntl` | Associated league ID. |
| **C** | `name` | String | `Nalanda Strikers` | Franchise name. |
| **D** | `shortCode` | String | `NST` | 2-4 letter abbreviation. |
| **E** | `logoUrl` | URL | `https://.../strikers.png` | Team emblem image URL. |
| **F** | `ownerName` | String | `Dr. Rajesh Kamath` | Franchise owner / governor. |
| **G** | `ownerPhotoUrl` | URL | `https://.../owner.jpg` | Owner portrait image URL. |
| **H** | `iconPlayerName` | String | `Rohit Shetty` | Pre-retained icon player (if any). |
| **I** | `iconPlayerPhotoUrl` | URL | `https://.../icon.jpg` | Icon player photo URL. |
| **J** | `primaryColor` | Hex String | `#059669` | Team primary jersey color. |
| **K** | `secondaryColor` | Hex String | `#F59E0B` | Team secondary color. |
| **L** | `totalBudget` | Integer | `5000000` | Total purse allocation in ₹. |
| **M** | `spentAmount` | Integer | `1250000` | Authoritative total spent in auction. |
| **N** | `remainingAmount` | Integer | `3750000` | Authoritative available purse balance. |
| **O** | `minPlayers` | Integer | `15` | Minimum required squad spots. |
| **P** | `maxPlayers` | Integer | `18` | Maximum squad limit. |
| **Q** | `reservedForSquad` | Integer | `325000` | Minimum reserved purse for unfilled spots. |
| **R** | `squadCount` | Integer | `3` | Total players currently drafted. |
| **S** | `categoryLimitsJson` | JSON String | `{"max_icon":1,"min_emerging":2}` | Category constraints per team. |
| **T** | `updatedAt` | ISO 8601 | `2026-10-31T18:00:00.000Z` | Timestamp of last balance calculation. |

---

## Tab 3: `Players`
Authoritative register of all tournament players, base prices, categories, and auction results.
* **Row 1**: Column Headers
* **Rows 2..N**: One row per player

| Column # | Column Name | Type | Example | Description |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `id` | String | `player-1` | Unique player identifier. |
| **B** | `seasonId` | String | `league-ntl` | Associated league ID. |
| **C** | `registrationNo` | String | `NTL-001` | Official registration number. |
| **D** | `fullName` | String | `Rohan Sharma` | Full player name. |
| **E** | `category` | Enum | `ICON` / `PLATINUM` / `GOLD` / `SILVER` / `EMERGING` | Tier classification. |
| **F** | `primaryRole` | Enum | `BATSMAN` / `BOWLER` / `ALL_ROUNDER` / `WICKET_KEEPER` | Playing role. |
| **G** | `battingStyle` | String | `Right Hand Bat` | Batting orientation. |
| **H** | `bowlingStyle` | String | `Right Arm Medium Fast` | Bowling skill. |
| **I** | `photoUrl` | URL | `https://.../player.jpg` | Verified WebP portrait URL. |
| **J** | `originalPhotoUrl` | URL | `https://drive.google.com/...` | Raw unprocessed image URL. |
| **K** | `normalizedPhotoUrl` | URL | `https://.../player_norm.webp` | Standardized 3:4 derivative. |
| **L** | `photoAspectRatio` | String | `3:4` | Aspect ratio format. |
| **M** | `photoMatchStatus` | Enum | `MATCHED` / `UNMATCHED` / `MANUAL_OVERRIDE` | Drive fuzzy match status. |
| **N** | `driveFileId` | String | `1MtjUStUIq...` | Google Drive file ID. |
| **O** | `basePrice` | Integer | `200000` | Initial starting price in ₹. |
| **P** | `basePriceOverride` | Integer | `250000` | Optional administrator override. |
| **Q** | `status` | Enum | `AVAILABLE` / `ON_AUCTION` / `SOLD` / `UNSOLD` / `WITHDRAWN` | Current auction lifecycle state. |
| **R** | `sortOrder` | Integer | `1` | Order of appearance in bidding queue. |
| **S** | `soldToTeamId` | String | `team-1` | Team ID that purchased the player. |
| **T** | `soldPrice` | Integer | `450000` | Final winning bid amount in ₹. |
| **U** | `statsSummaryJson` | JSON String | `{"matches":42,"runs":1180,"strikeRate":145.2}` | Key career statistics. |
| **V** | `updatedAt` | ISO 8601 | `2026-10-31T18:00:00.000Z` | Timestamp of last status change. |

---

## Tab 4: `Auction_State`
Single-row authoritative runtime state and distributed write-lock coordinator.
* **Row 1**: Column Headers
* **Row 2**: Current State (Single Row)

| Column # | Column Name | Type | Example | Description |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `id` | String | `auction-league-ntl` | Unique session ID. |
| **B** | `seasonId` | String | `league-ntl` | Associated league ID. |
| **C** | `status` | Enum | `IDLE` / `IN_PROGRESS` / `PAUSED` / `FINISHED` | Live auction status. |
| **D** | `currentPlayerId` | String | `player-1` | Player currently in the bidding ring. |
| **E** | `currentHighestBid` | Integer | `350000` | Current highest active bid in ₹. |
| **F** | `currentLeadingTeamId` | String | `team-2` | Franchise holding the leading bid. |
| **G** | `timerSeconds` | Integer | `10` | Authoritative remaining countdown duration. |
| **H** | `timerExpiresAt` | ISO 8601 | `2026-10-31T18:05:42.000Z` | Absolute wall-clock expiry timestamp. |
| **I** | `pausedRemainingSeconds` | Integer | `18` | Preserved time when auction is PAUSED. |
| **J** | `round` | Integer | `1` | Active auction round. |
| **K** | `bidCount` | Integer | `4` | Number of bids placed on current lot. |
| **L** | `bidExtensionSeconds` | Integer | `10` | Extension added on late bids. |
| **M** | `version` | Integer | `42` | Monotonically incrementing concurrency version. |
| **N** | `lockToken` | String | `lock-1730419200-a1b2` | Active lease lock token UUID. |
| **O** | `lockExpiresAt` | ISO 8601 | `2026-10-31T18:05:46.000Z` | Lock lease expiration timestamp. |
| **P** | `updatedAt` | ISO 8601 | `2026-10-31T18:05:32.000Z` | Timestamp of last state mutation. |

---

## Tab 5: `Bid_History`
Append-only historical audit trail of all bids placed during the tournament.
* **Row 1**: Column Headers
* **Rows 2..N**: One row per bid attempt

| Column # | Column Name | Type | Example | Description |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `id` | String | `bid-1730419200000-xyz` | Unique bid transaction ID. |
| **B** | `auctionId` | String | `auction-league-ntl` | Session ID. |
| **C** | `seasonId` | String | `league-ntl` | League ID. |
| **D** | `playerId` | String | `player-1` | Spotlighted player ID. |
| **E** | `teamId` | String | `team-1` | Bidding franchise ID. |
| **F** | `teamName` | String | `Nalanda Strikers` | Bidding franchise display name. |
| **G** | `teamShortCode` | String | `NST` | Franchise short code. |
| **H** | `amount` | Integer | `225000` | Bid value in ₹. |
| **I** | `bidType` | Enum | `BASE` / `STANDARD` / `OVERRIDE` / `UNDONE` | Classification of bid. |
| **J** | `placedAt` | ISO 8601 | `2026-10-31T18:04:12.123Z` | Exact timestamp of bid registration. |
| **K** | `isUndone` | Boolean | `FALSE` / `TRUE` | Marked `TRUE` if bid was rolled back via Undo. |

---

## Tab 6: `Purchases`
Final ledger of all player transfers and sales.
* **Row 1**: Column Headers
* **Rows 2..N**: One row per completed sale

| Column # | Column Name | Type | Example | Description |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `id` | String | `purchase-player-1` | Unique sale record ID. |
| **B** | `seasonId` | String | `league-ntl` | League ID. |
| **C** | `playerId` | String | `player-1` | Sold player ID. |
| **D** | `playerName` | String | `Rohan Sharma` | Sold player name. |
| **E** | `playerCategory` | Enum | `ICON` | Tier classification. |
| **F** | `playerRole` | Enum | `BATSMAN` | Playing discipline. |
| **G** | `teamId` | String | `team-1` | Winning franchise ID. |
| **H** | `teamName` | String | `Nalanda Strikers` | Winning franchise name. |
| **I** | `soldPrice` | Integer | `450000` | Final purchase price in ₹. |
| **J** | `round` | Integer | `1` | Auction round in which player was sold. |
| **K** | `soldAt` | ISO 8601 | `2026-10-31T18:05:42.000Z` | Hammer strike timestamp. |

---

## Tab 7: `Audit_Log`
Comprehensive admin action ledger tracking every operational event.
* **Row 1**: Column Headers
* **Rows 2..N**: One row per administrative action

| Column # | Column Name | Type | Example | Description |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `id` | String | `audit-1730419200000` | Unique audit record ID. |
| **B** | `seasonId` | String | `league-ntl` | League ID. |
| **C** | `actionType` | String | `HAMMER_SOLD` / `UNDO` / `PAUSE` | Action performed. |
| **D** | `actor` | String | `AUCTIONEER` | Identity or role of the initiator. |
| **E** | `detailsJson` | JSON String | `{"player":"Rohan Sharma","price":450000}` | Structured event details. |
| **F** | `timestamp` | ISO 8601 | `2026-10-31T18:05:42.000Z` | Precise execution timestamp. |
