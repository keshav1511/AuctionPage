# NTL Auction Platform – API Specification

## 1. Overview
The platform exposes RESTful endpoints and Server Actions built on Next.js 15 App Router Route Handlers. All mutations mutate the Supabase PostgreSQL database under transactional isolation.

Base URL: `/api/v1`

---

## 2. Authentication & Authorization

All `/api/admin/*` endpoints require a valid Supabase JWT Bearer token possessing `authenticated` role with admin privileges verified via `admin_profiles` table.

```http
Authorization: Bearer <supabase_session_jwt>
```

---

## 3. Endpoints

### 3.1 Live Auction Controls

#### `POST /api/auction/bid`
Submits a new bid for the current player in the active auction session.
- **Access**: Admin / Authenticated Auctioneer Desk
- **Request Body**:
```json
{
  "auction_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "player_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "team_id": "c1d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
  "amount": 250000
}
```
- **Response `200 OK`**:
```json
{
  "status": "success",
  "data": {
    "bid_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "auction_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "player_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "team_id": "c1d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
    "amount": 250000,
    "placed_at": "2026-10-31T11:30:00.000Z",
    "next_min_bid": 275000
  }
}
```
- **Error Codes**:
  - `400 Bad Request`: Bid below minimum increment.
  - `403 Forbidden`: Team purse exhausted or reserve squad check failed.
  - `409 Conflict`: Concurrency conflict (bid placed after round closed).

#### `POST /api/auction/hammer`
Concludes bidding on the current player, marking them SOLD to the high bidder or UNSOLD.
- **Request Body**:
```json
{
  "auction_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "outcome": "SOLD" // or "UNSOLD"
}
```
- **Response `200 OK`**:
```json
{
  "status": "success",
  "data": {
    "player_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "status": "SOLD",
    "winning_team_id": "c1d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
    "winning_bid": 250000,
    "team_remaining_purse": 4750000
  }
}
```

#### `POST /api/auction/undo`
Reverts the last action (undo erroneous bid or hammer down).
- **Request Body**:
```json
{
  "auction_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "reason": "Accidental double-click bid"
}
```

---

### 3.2 Google Sheets Integration

#### `POST /api/sheets/sync`
Synchronizes player rosters from a linked Google Sheet.
- **Request Body**:
```json
{
  "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "range": "Players!A2:H",
  "season_id": "8e31a15a-4b96-48fa-8692-74719273c52e"
}
```
- **Response `200 OK`**:
```json
{
  "status": "success",
  "summary": {
    "total_rows": 150,
    "inserted": 42,
    "updated": 108,
    "errors": []
  }
}
```

---

### 3.3 Public Stage & Stats

#### `GET /api/public/live`
Returns the active auction state for broadcasting fallback.
- **Response `200 OK`**:
```json
{
  "auction": {
    "status": "IN_PROGRESS",
    "current_player": {
      "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "full_name": "Rohan Sharma",
      "category": "PLATINUM",
      "primary_role": "ALL_ROUNDER",
      "base_price": 100000,
      "photo_url": "/mock/players/player-1.webp"
    },
    "current_bid": 350000,
    "leading_team": {
      "id": "c1d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
      "name": "Nalanda Strikers",
      "short_code": "NST",
      "logo_url": "/mock/teams/strikers.webp"
    },
    "timer_seconds": 24
  },
  "teams": [
    {
      "id": "c1d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
      "name": "Nalanda Strikers",
      "spent": 2150000,
      "remaining": 2850000,
      "squad_count": 8
    }
  ]
}
```
