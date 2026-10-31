# PHASE 4 RUNTIME BUGFIX: INITIAL_LEAGUES RESOLUTION & SERVER ARCHITECTURE

## Executive Summary

During testing of the Phase 4 real-time auction synchronization, endpoints relying on `src/lib/server/auction-store.ts` crashed at runtime with:
```
TypeError: INITIAL_LEAGUES.find is not a function
```
**Affected endpoints**:
- `GET /api/auction/state?leagueId=league-ntl` — HTTP 500
- `POST /api/auction/action` — HTTP 500
- `GET /api/realtime/stream?leagueId=league-ntl` — initial synchronization failure

---

## 1. Root Cause Analysis

### The Client Reference Proxy Issue in Next.js App Router
1. `src/lib/context/league-context.tsx` is marked with `"use client";` at line 1 because it manages React client-side state (`useState`, `useEffect`, `localStorage`).
2. `INITIAL_LEAGUES` was originally declared and exported directly from this `"use client"` module.
3. `src/lib/server/auction-store.ts` runs strictly on the server (within Next.js Route Handlers and Node.js server context).
4. In Next.js, when a Server Component or server Route Handler imports an export from a `"use client"` module, the React Server Components compiler does **not** evaluate and import the raw JavaScript value or array. Instead, it generates a React Client Reference Proxy object (`{ $$typeof: Symbol(react.client.reference), ... }`).
5. At runtime, calling `.find()` on this Client Reference proxy threw `TypeError: INITIAL_LEAGUES.find is not a function` because the proxy is not an Array instance.

---

## 2. Architectural Solution

### Separation of Concerns: Pure Data Fixtures vs. Client State Context
To eliminate the server/client boundary pollution:
1. **Created `src/lib/mock-data/leagues.ts`**:
   - A pure TypeScript data module without `"use client"` directives or React hooks.
   - Contains:
     - `INITIAL_LEAGUES: League[]` — Typed array with default league fixtures (`league-ntl` and `league-mpl`).
     - `DEFAULT_LEAGUE_ID = "league-ntl"` — Authoritative default constant.
     - `getInitialLeagueById(leagueId: string): League | undefined` — Safe lookup utility.
     - `getAllInitialLeagues(): League[]` — Safe clone utility.
   - Safe to import by both server-side Route Handlers / services and client-side React components.

2. **Updated `src/lib/context/league-context.tsx`**:
   - Imports `INITIAL_LEAGUES` and `DEFAULT_LEAGUE_ID` from `@/lib/mock-data/leagues`.
   - Re-exports them for backward compatibility with any client components.

3. **Updated `src/lib/server/auction-store.ts`**:
   - Removed import from `@/lib/context/league-context`.
   - Imports pure data helper `getInitialLeagueById` directly from `@/lib/mock-data/leagues`.
   - Implemented `registerLeagueState(league: League): LeagueState` to register and initialize state for leagues.
   - Rewrote `getAuthoritativeLeagueState(leagueId: string): LeagueState | null`:
     - Checks memory cache `globalState.leagues`.
     - Validates against configured leagues via `getInitialLeagueById(leagueId)`.
     - Returns `null` for unknown league IDs instead of silently creating invalid fallback dummy data.

4. **Updated API Route Handlers**:
   - `GET /api/auction/state`: Returns HTTP 404 `{ success: false, error: 'League with ID "..." not found' }` for invalid league IDs.
   - `GET /api/realtime/stream`: Returns HTTP 404 response before opening the SSE stream if league ID is invalid.
   - `POST /api/auction/action`: Returns HTTP 404 if the target league does not exist, unless the action is an `UPDATE_LEAGUE` action registering the league.

---

## 3. League ID Consistency Matrix

| Route / Module | Primary League ID | Fallback / Default | Validation |
| :--- | :--- | :--- | :--- |
| **Admin Setup** (`/admin/setup`) | User-selected or active | `league-ntl` | Checked against `leagues` state |
| **Admin Control** (`/admin/auction-control`) | Active league from context | `league-ntl` | Syncs via `/api/auction/action` |
| **Public Live** (`/live`) | Active league from context | `league-ntl` | Reads `/api/auction/state` & `/api/realtime/stream` |
| **API State** (`/api/auction/state`) | `searchParams.get("leagueId")` | `league-ntl` | Authoritative check, 404 on invalid |
| **API Action** (`/api/auction/action`) | `payload.leagueId` | Required | Authoritative check, 404 on invalid |
| **API Stream** (`/api/realtime/stream`) | `searchParams.get("leagueId")` | `league-ntl` | Authoritative check, 404 on invalid |

---

## 4. Verification & Build Results

1. **Type Checking**:
   ```bash
   npm run type-check
   # Output: tsc --noEmit -> Exit code 0 (0 errors)
   ```

2. **Linting**:
   ```bash
   npm run lint
   # Output: next lint -> Exit code 0 (0 errors)
   ```

3. **Production Build**:
   ```bash
   npm run build
   # Output: Compiled successfully in 5.7s
   # Generating static pages (25/25) -> Exit code 0
   ```
   All 25 application pages and API route handlers compile and bundle without errors.
