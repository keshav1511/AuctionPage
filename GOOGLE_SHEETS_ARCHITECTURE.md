# GOOGLE SHEETS-ONLY DATA ARCHITECTURE

## 1. Architectural Philosophy
The NTL Cricket Auction Platform operates with **Google Sheets as the exclusive persistent data store**. No relational database (PostgreSQL, MySQL, SQLite) or document database (MongoDB, Supabase, Redis) is employed.

```mermaid
graph TD
    subgraph Client Tier
        AdminUI["Admin Control Desk (/admin/auction-control)"]
        PublicLive["Public Spectator Screen (/live)"]
        PublicTeams["Public Teams & Rosters (/teams)"]
    end

    subgraph Server Tier (Next.js Serverless / Node.js)
        APIAction["/api/auction/action (Serialized Mutex)"]
        APIState["/api/auction/state (Snapshot Read)"]
        APISSE["/api/realtime/stream (SSE Broadcast Bus)"]
        Repo["Google Sheets Repository (src/lib/sheets)"]
    end

    subgraph Storage Tier (Google Cloud)
        GSheets["Google Sheets API v4 (Authoritative Database)"]
        GDrive["Google Drive API v3 (Player Photographs)"]
    end

    AdminUI -->|POST Action| APIAction
    APIAction -->|Acquire Lock & Commit| Repo
    Repo <-->|values.get / batchUpdate| GSheets
    Repo -->|Broadcast Event| APISSE
    APISSE -->|Server-Sent Events| PublicLive
    APISSE -->|Server-Sent Events| AdminUI
    PublicTeams -->|GET Snapshot| APIState
    APIState -->|Read State| Repo
    PublicLive -->|SWR Revalidation Fallback| APIState
```

---

## 2. Distributed Concurrency & Locking Strategy

Google Sheets API does not provide database-style ACID row-level locking or multi-statement transactions. To prevent race conditions when multiple bids occur concurrently, the platform implements a **three-tier serialized write pipeline**:

### Level 1: In-Process Local Mutex
Within a single Node.js / Next.js server instance, in-flight action requests for the same `leagueId` are serialized using a JavaScript Promise chain queue:
```typescript
function runSerialized<T>(leagueId: string, task: () => Promise<T>): Promise<T> {
  const currentChain = leagueMutexChains.get(leagueId) || Promise.resolve();
  const next = currentChain.then(task, task);
  leagueMutexChains.set(leagueId, next);
  return next;
}
```

### Level 2: Google Sheets Lease Locking
Across distinct Vercel serverless function instances, mutual exclusion is coordinated via lease-lock cells in the `Auction_State` sheet tab:
1. `lockToken`: Unique UUID assigned to the acquiring worker.
2. `lockExpiresAt`: Absolute ISO timestamp (`now + 4000ms`).

**Acquisition Protocol**:
1. Worker reads `Auction_State!A2:P2`.
2. If `lockExpiresAt > now` and `lockToken !== currentWorkerToken`, the lock is actively held by another process. The worker waits 350ms and retries (up to 2 times).
3. If free or expired, the worker writes its `[lockToken, now + 4000ms]` to Google Sheets.
4. Validation and state mutations are performed against the latest read state.
5. In the finalizing batch update, the worker clears `lockToken = null`, updates `version = version + 1`, and saves the new state.

### Level 3: Optimistic Concurrency & Version Numbers
Every successful auction state mutation increments the `version` column in `Auction_State`.
If a stale read is detected or a race condition occurs, the action is rejected:
```json
{
  "success": false,
  "error": "Auction is currently processing another transaction. Please retry in a moment."
}
```
The client UI displays an alert and prompts immediate re-submission against the refreshed ladder.

---

## 3. Real-Time Synchronization in Serverless

### The Serverless SSE Challenge
On serverless platforms like Vercel:
* Client A connects to `/api/realtime/stream` on Lambda Instance 1.
* Admin executes a bid via `/api/auction/action` hitting Lambda Instance 2.
* An in-memory event emitter on Instance 2 cannot directly notify Instance 1's memory.

### Solution: Dual-Channel Real-Time Delivery
1. **In-Process SSE Channel**: For local development or warm-instance affinity, events are immediately pushed via EventEmitter (<15ms latency).
2. **Cross-Instance Polling Stream**: In `/api/realtime/stream`, a background interval (2.5s) queries the latest state summary (`status-currentPlayerId-currentHighestBid-bidCount`). When a version increment is detected, it automatically broadcasts an `AUCTION_UPDATED` event down the SSE pipe.
3. **Client-Side SWR Revalidation**: Public spectator screens (`/live`, `/teams`, `/results`) trigger an authoritative `/api/auction/state` check every 3.5 seconds during live bidding as a fallback against network disconnects.

---

## 4. Wall-Clock Timers & Auto-Unsold Resolution
Browser timers are purely visual countdown displays. Authoritative timing is maintained on the server:
* `timerExpiresAt` is saved as an absolute ISO timestamp in Google Sheets.
* If an administrator pauses the auction, `pausedRemainingSeconds` is written to `Auction_State`.
* Upon restart or refresh, the remaining duration is computed from `timerExpiresAt - now`.
* **Server-Authoritative Auto-UNSOLD**: When any request inspects `Auction_State`, if `status === 'IN_PROGRESS'` and `now >= timerExpiresAt` with 0 bids registered, the server automatically executes `HAMMER_UNSOLD`, marks the player `UNSOLD` in Google Sheets, resets the timer, and broadcasts `LOT_UNSOLD`.

---

## 5. Architectural Limitations & Mitigations

| Limitation | Impact | Mitigation Implemented |
| :--- | :--- | :--- |
| **Google API Latency** | Direct sheets writes take 250ms–700ms. | Local in-memory mirrors provide instant optimistic updates to the bidder while the authoritative batch write commits to Google Sheets. |
| **API Quota Limits** | Google Sheets allows 300 read requests and 300 write requests per minute per project. | Read operations use intelligent in-memory caching (1.5s TTL) during rapid polling; writes are batched into single `values.batchUpdate` calls. |
| **No True Rollback** | Google Sheets does not support SQL `ROLLBACK`. | Write operations are validated in memory before any Google API calls are dispatched. If a write fails, the action is rejected and not broadcast. |
| **Workbook Sharing** | Human editors could accidentally alter sheet formatting. | Headers in Row 1 are frozen (`frozenRowCount: 1`). The workbook manager automatically validates and repairs missing tabs on boot. |
