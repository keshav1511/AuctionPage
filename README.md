# NTL Auction Platform 🏏

> Enterprise Multi-League Cricket Auction Management System engineered for **Nalanda Turf League (NTL)** and custom tournament championships.

Built with **Next.js 15 App Router**, **TypeScript (Strict Mode)**, **Tailwind CSS**, **shadcn/ui & Radix UI Primitives**, **SheetJS (xlsx)**, **Sharp**, **Supabase Realtime**, and **Google Sheets & Drive APIs**.

---

## 🌟 Architecture & Features Overview

### 1. 🖥️ Public Broadcast Stage Display (`/live`)
- **Stage & 4K Projector Ready**: High-contrast, massive typography engineered for stadium displays, LED walls, and live broadcasts.
- **Authoritative Real-Time Bidding**: Synchronized current bid, leading franchise, authoritative countdown clock, and bidding ladder.
- **Dynamic Player Spotlight**: High-res player portrait (EXIF auto-rotated 3:4 aspect ratio), lot number, category tier (Icon, Platinum, Gold, Silver, Emerging), role badges, and player bio.
- **Franchise Purse Ticker**: Real-time remaining purse bars, player count metrics, and minimum purse reserve guards.
- **Celebration Engine**: Dynamic particle confetti bursts (`canvas-confetti`) and visual hammer strike when lots are hammered down.

### 2. ⚙️ Administrative Control Suite (`/admin`)
Designed with a clean, human-made white & soft-neutral palette (`bg-slate-50`, cards `bg-white`, `border-slate-200`, `text-slate-900`) across 8 dedicated desks:

1. **Overview (`/admin/dashboard`)**:
   - 4-step progressive tournament setup guide.
   - Pre-auction 6-point readiness checklist (teams, players, photos, purse balance, authoritative timers).
2. **Tournament Setup (`/admin/setup`)**:
   - Tournament name, slug, description, and primary brand color picker.
   - Direct computer logo upload and preview.
   - Match date, match venue, auction date, time, and timezone.
   - Linked Google Sheets URL and Google Drive photos folder URL.
   - Multi-tournament registry switcher.
3. **Teams (`/admin/teams`)**:
   - Add, edit, and manage tournament franchises.
   - Direct computer file upload for team logo, owner photograph, and icon player photograph.
   - Real-time squad limit editors (Min & Max squad sizes) and total purse balance configuration.
4. **Players & Photo Matching Studio (`/admin/players`)**:
   - Searchable, category-filtered player registry.
   - Universal **Data Import Modal** supporting both Google Sheets URLs and local Excel (`.xlsx`, `.xls`, `.csv`) uploads with automatic header detection and role separation (Players, Franchise Owners, Icon Players).
   - Multi-Role **Photo Matching Studio** with 3 dedicated sub-tabs (Players, Owners, Icons) and intelligent token matching for IDs and filenames (e.g. `1000147764 - Ashwin Pai.jpeg` -> `Ashwin Pai`).
   - Quick-pick photo selector from Drive or direct computer file upload.
5. **Auction Settings (`/admin/settings`)**:
   - Dynamic bid slab ladder with strict non-overlapping boundary validation.
   - Category base prices (Icon, Platinum, Gold, Silver, Emerging).
   - Per-player base price override table.
   - Authoritative timer durations (initial countdown & bid extension).
   - Minimum squad size and purse reserve rules.
6. **Live Auction Control Desk (`/admin/auction-control`)**:
   - 1-click franchise bidding pad displaying team logos, remaining purse, and next valid increment preview.
   - Authoritative countdown clock derived from server timestamps (`timer_expires_at`).
   - Auto-unsold handling on zero-bid timeout.
   - Keyboard shortcuts: `[Up Arrow]` (Place Bid), `[Enter]` (Hammer / Sold), `[Space]` (Pause / Resume), `[Ctrl + Z]` (Safe Undo).
7. **Results (`/admin/results`)**:
   - Real-time sold and unsold player ledger with franchise attribution and final hammer prices.
8. **Reports (`/admin/reports`)**:
   - Financial breakdown, squad fulfillment matrix, and 1-click CSV export for franchise roster sheets.

---

## 🏗️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | [Next.js 15](https://nextjs.org) (App Router, Server Actions, Route Handlers) |
| **Language** | [TypeScript](https://www.typescriptlang.org) (Strict Mode, zero implicit `any`) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com), CSS Variables, Sports Palette & Clean White Admin UI |
| **Icons & UI** | [Lucide React](https://lucide.dev), [Radix UI](https://www.radix-ui.com), [shadcn/ui](https://ui.shadcn.com) |
| **Spreadsheet Engine** | [SheetJS (xlsx)](https://docs.sheetjs.com) for native `.xlsx`, `.xls`, `.csv` parsing |
| **Image Pipeline** | [Sharp](https://sharp.pixelplumbing.com) (EXIF normalization, padded containment, 3:4 WebP conversion) |
| **Database & Realtime** | [Supabase PostgreSQL](https://supabase.com) with Row Level Security (RLS) & Realtime Broadcast |
| **External APIs** | [Google Drive API v3](https://developers.google.com/drive) & [Google Sheets API v4](https://developers.google.com/sheets/api) |
| **Visual FX** | [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti) |
| **Runtime** | Node.js 20.x / 24.x |

---

## 🧭 Application Routes

### Public Stage & Spectator Routes
| Route | Description |
| :--- | :--- |
| `/` | Tournament landing page, active edition banner, and navigation portal |
| `/live` | Stadium TV & 4K projector broadcast stage with live synchronized bidding |
| `/teams` | Public franchise directory, owner/icon profiles, and purse allocation |
| `/results` | Public auction ledger of sold and unsold players with category filtering |

### Administrator Desks
| Route | Description |
| :--- | :--- |
| `/admin/dashboard` | Setup guide, key metrics, and pre-auction readiness checklist |
| `/admin/setup` | Tournament identity, computer logo upload, venue, schedule, linked URLs |
| `/admin/leagues` | Tournament redirect to Setup desk |
| `/admin/teams` | Franchise management, computer logo & owner/icon uploads, squad limits, purse |
| `/admin/players` | Player registry, Universal Excel/Sheets Import, and Photo Matching Studio |
| `/admin/settings` | Bid slabs table, category base prices, overrides, timers, and purse rules |
| `/admin/auction-control`| 1-click bidding pad, countdown timer, auto-unsold, and keyboard shortcuts |
| `/admin/results` | Auction ledger with franchise acquisition breakdown |
| `/admin/reports` | Squad allocation table and franchise roster CSV export |
| `/admin/login` | Secure administrator access portal |

### API Route Handlers
| Route | Method | Description |
| :--- | :--- | :--- |
| `/api/excel/parse` | `POST` | Parses uploaded `.xlsx`, `.xls`, and `.csv` files into normalized JSON |
| `/api/sheets/parse` | `POST` | Fetches and parses Google Sheets via public CSV export or Sheets API |
| `/api/sheets/sync` | `POST` | Server-to-server sync with Google Sheets |
| `/api/drive/sync` | `POST` | Authenticated Google Drive folder fetch with file metadata |
| `/api/media/normalize`| `POST` | Auto-rotates and transforms photos into 3:4 WebP portraits via Sharp |
| `/api/branding/extract-palette` | `POST` | Extracts dominant colors and derives sports palettes |
| `/api/export/team-sheet` | `GET` | Exports franchise squads as downloadable CSV spreadsheets |
| `/api/health` | `GET` | System health check and uptime probe |

---

## 🗄️ Database Migrations

The project includes declarative PostgreSQL migrations located in `supabase/migrations/`:

1. `20261031000000_initial_schema.sql`:
   - Normalized tables: `leagues`, `teams`, `players`, `auction_sessions`, `bids`, `bid_slabs`, `audit_logs`.
   - Foreign key constraints, enums (`player_category`, `player_role`, `player_status`, `auction_status`), and indexes.
   - Row Level Security (RLS) policies allowing public read on active leagues and authenticated writes for admins.
2. `20261031010000_league_branding_and_drive.sql`:
   - Extended `leagues` table with `google_sheets_url`, `google_drive_folder_id`, `primary_color`, and `secondary_color`.
   - Realtime replica identities enabled for instant broadcast synchronization.

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env.local` for local execution:

```bash
cp .env.example .env.local
```

### Environment Variables Template
```env
# NEXT.JS APPLICATION
NEXT_PUBLIC_APP_NAME="NTL Auction Platform"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_DEFAULT_LEAGUE_SLUG="ntl"

# SUPABASE PUBLIC CREDENTIALS (CLIENT & SERVER)
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key-here"

# SUPABASE SERVICE ROLE (SERVER-SIDE ONLY - NEVER EXPOSE TO CLIENT)
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key-here"

# GOOGLE WORKSPACE API INTEGRATION (SERVER-SIDE ONLY)
GOOGLE_SERVICE_ACCOUNT_EMAIL="ntl-importer@your-project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID="your_google_sheet_spreadsheet_id_here"
GOOGLE_DRIVE_FOLDER_ID="1MtjUStUIqnlQic13-sfML_NbPygEkSwpUsgDe7b3hHJ1GGKbP7xvSHx3MI11kTS7CgVaT2hA"

# ADMIN AUTHENTICATION
DEMO_ADMIN_EMAIL="admin@ntlcricket.com"
DEMO_ADMIN_PASSWORD="CHANGE_ME_IN_PRODUCTION"
```

> **Note**: If Supabase or Google Drive credentials are not yet configured, the application automatically operates in local evaluation mode using realistic built-in mock fixtures and local browser persistence.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js `20.x` or `24.x`
- npm `10+` or `11+`

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/keshav1511/AuctionPage.git
cd AuctionPage

# Install dependencies
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Code Quality & Build Verification
```bash
# Type check TypeScript codebase
npm run type-check

# Run linter
npm run lint

# Production build
npm run build

# Start production server
npm run start
```

---

## 📜 License
Private & Proprietary – Nalanda Turf League (NTL). All rights reserved.
