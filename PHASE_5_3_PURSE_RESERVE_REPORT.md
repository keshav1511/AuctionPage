# PHASE 5.3 — DYNAMIC MINIMUM PURSE RESERVE & MAXIMUM BID VALIDATION REPORT

**Author:** DeepMind Agentic Assistant  
**Date:** November 2026  
**Status:** COMPLETED & VERIFIED  
**Architecture:** 100% Google Sheets-Backed (Strictly Zero Databases)

---

## 1. Executive Summary

In Phase 5.3, the **Dynamic Minimum Purse Reserve & Maximum Bid Validation** engine was implemented and fully integrated into the NTL Cricket Auction Platform.

Under this rule, a team must always maintain sufficient purse reserves to purchase all remaining players required to satisfy its minimum squad size at the league or category floor base price. The calculation dynamically determines the maximum allowable bid for the current player on auction, prohibiting bids that would bankrupt the franchise below its minimum squad obligations.

All work preserves the Google Sheets-only persistence model. No new spreadsheet tabs or database tables were created; all configuration fields persist within `League_Config` via `auctionRulesJson`.

---

## 2. Core Mathematical Formula & Specification

Let:
- $\text{remainingPurse}$ = Team's current remaining purse balance.
- $\text{minimumSquadSize}$ = Minimum number of players the team is obligated to purchase (team `minPlayers` or rules `minimumSquadSize`).
- $\text{playersPurchased}$ = Number of players already purchased by the team (valid `SOLD` players). Unsold players do not count; undone purchases restore purse and count.
- $\text{minimumBasePrice}$ = Minimum permissible base price for each remaining player (league-wide floor or category-specific floor).

### Calculations:
$$\text{remainingPlayersAfterCurrentBid} = \max(0, \text{minimumSquadSize} - \text{playersPurchased} - 1)$$
$$\text{requiredReserve} = \text{remainingPlayersAfterCurrentBid} \times \text{minimumBasePrice}$$
$$\text{maximumBidAllowed} = \max(0, \text{remainingPurse} - \text{requiredReserve})$$

### Ineligibility Criteria:
1. **Reserve Affordability**: If $\text{remainingPurse} < \text{requiredReserve}$, the team cannot afford its remaining squad quota. Bidding is strictly prohibited ($\text{maximumBidAllowed} = 0$).
2. **Bid Floor**: If $\text{maximumBidAllowed} < \text{nextBidAmount}$, the team cannot place the next valid increment.
3. **Squad Limit**: If $\text{playersPurchased} \ge \text{maxSquadSize}$, the team's squad is full.
4. **Current Leader**: If the team already holds the highest bid, redundant bids are blocked.

---

## 3. Mandatory Specification Examples Verification

All four required examples were rigorously tested against the pure calculation engine:

| Scenario | Purse ($\text{₹}$) | Min Squad | Purchased | Min Base ($\text{₹}$) | Slots After Current | Required Reserve ($\text{₹}$) | Max Allowed Bid ($\text{₹}$) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Example A** | 40,000 | 6 | 0 | 1,000 | $\max(0, 6 - 0 - 1) = 5$ | $5 \times 1,000 = 5,000$ | $40,000 - 5,000 = \mathbf{35,000}$ | **Eligible** up to ₹35k |
| **Example B** | 3,000 | 6 | 4 | 1,000 | $\max(0, 6 - 4 - 1) = 1$ | $1 \times 1,000 = 1,000$ | $3,000 - 1,000 = \mathbf{2,000}$ | **Eligible** up to ₹2k |
| **Example C** | 5,000 | 6 | 5 | 1,000 | $\max(0, 6 - 5 - 1) = 0$ | $0 \times 1,000 = 0$ | $5,000 - 0 = \mathbf{5,000}$ | **Eligible** up to ₹5k |
| **Example D** | 900 | 6 | 4 | 1,000 | $\max(0, 6 - 4 - 1) = 1$ | $1 \times 1,000 = 1,000$ | $\max(0, 900 - 1000) = \mathbf{0}$ | **Ineligible** (Purse < Reserve) |

---

## 4. Architectural Implementation Details

### 4.1 Type Definitions (`src/types/index.ts`)
Extended `AuctionRules` to include dynamic reserve parameters:
- `minimumSquadSize?: number`
- `minimumBasePrice?: number`
- `categoryMinimumBasePrices?: Partial<Record<PlayerCategory, number>>`

### 4.2 Authoritative Calculation Engine (`src/lib/auction/purse-validator.ts`)
Created pure calculation module:
- `calculatePurseReserve(params)`: Executes the core mathematical formula with support for category quota floor weighting (e.g. reserving emerging category quotas before generic floor slots).
- `analyzeTeamBiddingEligibility(team, options)`: Returns detailed analysis including `requiredReserve`, `maximumBidAllowed`, `isEligibleToBid`, and `ineligibilityReason`.
- `validateBidEligibility(team, proposedBidAmount, options)`: Authoritative validator returning boolean status and explanatory failure reasons.

### 4.3 Authoritative Server-Side Enforcement (`src/lib/server/auction-store.ts`)
- In `executeAuctionAction` under `PLACE_BID`:
  - Computes exact purchased player count from active state (`p.status === "SOLD"`).
  - Evaluates `validateBidEligibility` against the proposed bid amount.
  - Returns descriptive `HTTP 400` errors if a bid exceeds `maximumBidAllowed` or violates reserve requirements.
- In `HAMMER_SOLD`:
  - Accurately increments `newSquadCount`.
  - Calculates and updates `reservedForSquad = remainingNeeded * minBasePrice`.

### 4.4 Admin Settings Configuration (`src/app/admin/settings/page.tsx`)
- Added inputs for **Minimum Squad Size (Quota)** and **Minimum Base Price (Floor ₹)**.
- Persisted automatically to `League_Config` via `auctionRulesJson`.
- Added contextual formula explainer cards for tournament administrators.

### 4.5 1-Click Interactive Team Logo Bidding Pad (`src/app/admin/auction-control/page.tsx`)
Enhanced the franchise bidding grid:
- **Real-Time Indicators**: Shows remaining purse, squad count vs minimum quota, required reserve, and maximum permitted bid for every team.
- **Dynamic Badges**: Displays `LEADER` (green), `ELIGIBLE` (emerald), or `INELIGIBLE` (rose).
- **Proactive Bidding Lock**: Disables the bid button when ineligible, displaying strike-through pricing and an explicit ineligibility reason (e.g., "Cannot afford minimum squad reserve", "Exceeds max bid ₹X").

---

## 5. Verification & Test Results

### 5.1 Automated Test Suite (`scratch/test-phase5-3.mjs`)
Ran automated test suite executing 28 test assertions:
- **Test 1**: Examples A, B, C, D formula and rejection assertions $\to$ **All Passed**
- **Test 2**: Bid boundary checks (exact bid accepted, ₹1 over rejected) $\to$ **All Passed**
- **Test 3**: Category-specific minimum reserve calculation $\to$ **All Passed**
- **Test 4**: State transitions (Unsold does not decrement, Sold updates reserve, Undo restores state) $\to$ **All Passed**

### 5.2 Build & Static Type Verification
- `npm run type-check`: Exited with code 0 (clean).
- `npm run lint`: Exited with code 0 (clean).
- `npm run build`: Exited with code 0 (all 25 routes compiled successfully).
