# PHASE 5.4 — AUTOMATIC ROUND 2 UNSOLD PLAYERS RE-AUCTION REPORT

**Author:** DeepMind Agentic Assistant  
**Date:** November 2026  
**Status:** COMPLETED & VERIFIED  
**Architecture:** 100% Google Sheets-Backed (Strictly Zero Databases)

---

## 1. Executive Summary

In Phase 5.4, the **Automatic Round 2 Unsold Players Re-Auction** stage was implemented and integrated across the NTL Cricket Auction Platform.

When all players in the primary auction (Round 1) complete their auction sequence, the engine detects Round 1 completion. If players remain unsold at the conclusion of Round 1, they are gathered into a dedicated Round 2 queue, shuffled **exactly once** using the Fisher-Yates algorithm, and persisted directly into Google Sheets (`Auction_State`).

The public spectator display (`/live`) automatically transitions into a broadcast-grade introduction screen titled **`ROUND 2 – UNSOLD PLAYERS`**, featuring returning player counts, gallery grids, player cards, roles, and original base prices. The Admin Control Desk (`/admin/auction-control`) gains an authoritative round indicator, live round progress statistics, an idempotent Round 2 confirmation banner, and an interactive Round 2 queue drawer.

All bidding in Round 2 reuses the core auction engine, retaining configurable increment slabs, +10s timer extensions, pause/resume, undo functionality, and Phase 5.3 dynamic minimum purse reserve enforcement. Players sold in Round 2 update team purses and rosters; players unsold in Round 2 remain marked `UNSOLD`, and no subsequent Round 3 is initiated.

---

## 2. Key Architecture & Features

### 2.1 First-Round Completion Detection & Pure Orchestration (`src/lib/auction/round-manager.ts`)
- **`detectRound1Completion(players)`**: Returns `true` if and only if all players in the pool have a terminal status (`SOLD`, `UNSOLD`, or `WITHDRAWN`), with zero players in `AVAILABLE` or `ON_AUCTION`.
- **`getEligibleRound2Players(players)`**: Gathers all players where `status === "UNSOLD"`. Explicitly excludes `SOLD`, `WITHDRAWN`, or unapproved players.
- **`createRound2Queue(unsoldPlayers)`**: Executes an in-memory Fisher-Yates shuffle, assigning an initial state of `status: "PENDING"`.
- **`calculateRoundStatistics(params)`**: Calculates authoritative round metrics: `roundLabel`, `totalInRound`, `soldCount`, `unsoldCount`, `pendingCount`, `completedCount`, and `progressPercent`.
- **Zero-Unsold Boundary Handling**: If all players in Round 1 were sold, `round2Queue` remains empty and the session status terminates directly to `"FINISHED"`. An empty Round 2 is never started.

### 2.2 Google Sheets Schema Extension (`src/lib/sheets/tab-definitions.ts` & `src/lib/sheets/google-sheets-repository.ts`)
No new spreadsheet tabs or databases were created. Four new columns were added to the `Auction_State` sheet:
- **Column Q**: `roundStage` (`"MAIN"` | `"ROUND_2_TRANSITION"` | `"ROUND_2"`)
- **Column R**: `round2QueueJson` (JSON array of `Round2QueueItem`: `[{ id, status }]`)
- **Column S**: `round2InitializedAt` (ISO timestamp string)
- **Column T**: `round1Completed` (boolean `"TRUE"` / `"FALSE"`)

Range reads/writes in `getAuctionStateFromSheets` and `saveAuctionStateToSheets` were extended from `A2:P2` to `A2:T2`. In-memory mirrors and serialization/deserialization ensure seamless backward compatibility.

### 2.3 Server-Side Auction Engine Actions (`src/lib/server/auction-store.ts`)
- **`INIT_ROUND_2`**:
  - Idempotent action. Checks if Round 2 is already initialized; if so, retains the existing randomized queue without re-shuffling.
  - Generates the queue, sets `round = 2`, `roundStage = "ROUND_2_TRANSITION"`, `round1Completed = true`, and sets `currentPlayerId = null`.
  - Persists the new state to Google Sheets immediately.
- **`START_ROUND_2`**:
  - Transitions `roundStage` from `"ROUND_2_TRANSITION"` to `"ROUND_2"`.
  - Picks the first `PENDING` player from `round2Queue`, spotlights them on the auction block, sets `currentBid = basePrice`, and starts the live lot timer.
- **`HAMMER_SOLD` & `HAMMER_UNSOLD`**:
  - In Round 1, upon hammering the last pending player, automatically detects completion. If unsold players exist, triggers Round 2 transition; if none exist, transitions to `"FINISHED"`.
  - In Round 2, updates the player's status in `round2Queue` (`SOLD` or `UNSOLD`), marks the player in the global roster, and seamlessly spotlights the next `PENDING` player from `round2Queue`.
  - When the last player in the Round 2 queue is hammered, the auction terminates with `status = "FINISHED"`. No Round 3 is initiated.

### 2.4 Dedicated Spectator Transition Screen (`src/app/live/page.tsx`)
When `session.roundStage === "ROUND_2_TRANSITION"`, the live spectator screen displays a broadcast-grade staging view:
- **Headline**: Exact string **`ROUND 2 – UNSOLD PLAYERS`**.
- **Header Stats**: Total returning players count, second chance explanation pill.
- **Player Gallery**: High-performance grid displaying player photos (with fallback avatar), jersey badge, full name, role/specialization pill, and original base price formatted in INR currency.
- **League Branding**: Dynamically styled with the tournament's primary and secondary theme colors.
- **Active Lot Indicator**: When Round 2 is actively live (`round === 2`), the active lot banner displays the **`ROUND 2 – UNSOLD PLAYERS`** badge alongside category, lot number, and timer.

### 2.5 Admin Control Desk Enhancements (`src/app/admin/auction-control/page.tsx`)
- **Authoritative Round Indicator & Stats Pill**: Displays `ROUND 1 — MAIN AUCTION` vs `ROUND 2 — UNSOLD PLAYERS`, along with lot counters: `Total in Round`, `Sold`, `Unsold`, and `Pending`.
- **Round 2 Confirmation Banner**: Appears when Round 1 completes, allowing the auctioneer to review the returning player pool and click **`START ROUND 2 AUCTION (ENTER LOT 1)`**.
- **Interactive Round 2 Queue Drawer**: Displays all unsold players in their fixed randomized order, with real-time status chips (`PENDING`, `SOLD`, `UNSOLD`, `ON AUCTION`) and direct lot spotlighting controls.

---

## 3. Verification & Test Results

### 3.1 Automated Test Suite (`scratch/test-phase5-4.mjs`)
A 10-section automated test script was executed against the calculation engine and state transition logic:

| Test Case | Description | Result |
| :--- | :--- | :--- |
| **Test 1** | Detects incomplete Round 1 when `AVAILABLE` or `ON_AUCTION` players remain | **PASS** |
| **Test 2** | Detects complete Round 1 when all players are either `SOLD` or `UNSOLD` | **PASS** |
| **Test 3** | Zero-unsold boundary: Terminates directly to `FINISHED` without Round 2 | **PASS** |
| **Test 4** | Filters only eligible `UNSOLD` players; excludes `SOLD`, `WITHDRAWN`, and unapproved | **PASS** |
| **Test 5** | Shuffles order once using Fisher-Yates and assigns initial `PENDING` state | **PASS** |
| **Test 6** | Idempotency: Reloading/re-initializing preserves the exact randomized order | **PASS** |
| **Test 7** | Tab serialization: Encodes and decodes columns Q-T in Google Sheets correctly | **PASS** |
| **Test 8** | Round statistics computation: Accurate total, sold, unsold, pending, and progress % | **PASS** |
| **Test 9** | Round 2 queue advancement: Updates items to `SOLD`/`UNSOLD`, advances cleanly | **PASS** |
| **Test 10**| Round 2 completion: Final player marked; auction status becomes `FINISHED` (No Round 3) | **PASS** |

**Summary: 37 / 37 Assertions Passed.**

### 3.2 Static Type Checking & Linting
- **`npm run type-check` (`tsc --noEmit`)**: Clean exit code 0.
- **`npm run lint` (`next lint`)**: Clean exit code 0.

### 3.3 Production Build Verification
- **`npm run build` (`next build`)**: Clean exit code 0.
- All 25 static pages and dynamic serverless API routes compiled successfully.

---

## 4. Modified & Added Files

1. `src/types/index.ts` — Added `Round2QueueItem` interface and extended `AuctionSession` with Round 2 state fields.
2. `src/lib/sheets/tab-definitions.ts` — Extended `AuctionStateRow` and headers with columns Q-T (`roundStage`, `round2QueueJson`, `round2InitializedAt`, `round1Completed`).
3. `src/lib/sheets/google-sheets-repository.ts` — Extended `A2:T2` range for auction state reads and writes.
4. `src/lib/auction/round-manager.ts` — **[NEW]** Pure calculation and queue orchestration engine.
5. `src/lib/server/auction-store.ts` — Implemented `INIT_ROUND_2`, `START_ROUND_2`, and Round 2 queue transitions in `HAMMER_SOLD` & `HAMMER_UNSOLD`.
6. `src/lib/hooks/use-realtime-auction.ts` — Exposed `initRound2` and `startRound2` action dispatchers.
7. `src/app/live/page.tsx` — Added dedicated `ROUND 2 – UNSOLD PLAYERS` broadcast transition screen and Round 2 lot badge.
8. `src/app/admin/auction-control/page.tsx` — Added Round 2 indicator, statistics bar, confirmation card, and interactive player queue drawer.
9. `scratch/test-phase5-4.mjs` — Comprehensive 37-assertion automated test suite.
