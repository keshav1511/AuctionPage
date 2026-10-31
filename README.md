# NTL Auction Platform 🏏

> Professional Multi-League Cricket Auction Management System engineered for **Nalanda Turf League (NTL) Season 1**.

Built with **Next.js 15 App Router**, **TypeScript (Strict Mode)**, **Tailwind CSS**, **shadcn/ui**, **Supabase Realtime**, and **Google Sheets API**.

---

## 🌟 Key Features

### 🖥️ Public Broadcast Stage Display (`/live`)
- **Stage & 4K Projector Ready**: High-contrast, massive typography designed for large TV displays and live streams.
- **Real-Time Bidding Visuals**: Sub-second synchronization of current bid, leading franchise, countdown clock, and bidding ladder.
- **Interactive Player Spotlight**: High-res player photography, category tier (Icon, Platinum, Gold, Silver, Emerging), role badges, and past season stats.
- **Franchise Purse Ticker**: Real-time remaining purse bars and squad count metrics.
- **Cinematic Celebration**: Dynamic gold confetti burst and visual hammer strike when lots are hammered down.

### ⚙️ Admin Operations Console (`/admin`)
- **Executive Dashboard**: Live telemetry on purse utilization, sold vs. unsold lots, and average price per player.
- **Live Auction Control Desk**: Quick-tap bid increment triggers (+₹10k, +₹25k, +₹50k, +₹1L), pause/resume, and 1-click Hammer/Pass.
- **Purse & Reserve Squad Guard**: Automatically enforces minimum squad size balance rules so teams cannot overspend and default.
- **Full Undo Ledger**: Reverse mistaken bids or accidental sales with complete audit tracking.
- **Google Sheets Ingestion**: 1-click import of player rosters with schema validation and Google Drive photo resolution.
- **Team & Squad Management**: Edit franchises, purse limits, and logos.
- **Exportable Reports**: Generate team-wise squad sheets and financial breakdowns.

---

## 🏗️ Technology Stack

- **Framework**: [Next.js 15](https://nextjs.org) (App Router, Server Actions, Route Handlers)
- **Language**: [TypeScript](https://www.typescriptlang.org) (Strict Mode)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) (Sports Palette: Charcoal `#090D10`, Turf Emerald `#059669`, Metallic Gold `#F59E0B`)
- **Icons**: [Lucide React](https://lucide.dev)
- **UI Primitives**: [shadcn/ui](https://ui.shadcn.com) & [Radix UI](https://www.radix-ui.com)
- **Database & Realtime**: [Supabase PostgreSQL](https://supabase.com) with Row Level Security & Realtime Broadcast
- **Integrations**: [Google Sheets API v4](https://developers.google.com/sheets/api) & [Google Drive API v3](https://developers.google.com/drive)
- **Runtime**: Node.js 24 compatible

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js 20.x or 24.x
- npm 10+ or pnpm 9+

### 2. Installation
```bash
# Clone the repository and navigate to project directory
cd "D:\auction webpage"

# Install dependencies
npm install
```

### 3. Environment Setup
```bash
# Create local environment configuration
copy .env.example .env.local
```
Fill in your Supabase project URL, Anon Key, and Google Service Account credentials. (The app will automatically fall back to built-in mock data for local evaluation if credentials are not yet supplied).

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run build
npm run start
```

---

## 📁 Project Structure

```
├── MASTER_PLAN.md               # Product roadmap and phase plans
├── SYSTEM_ARCHITECTURE.md       # High-level architecture and data flows
├── DATABASE_SCHEMA.md           # Normalized PostgreSQL schema specification
├── API_DOCUMENTATION.md         # Route handlers and API endpoint contracts
├── AUCTION_ENGINE.md            # Bidding logic, slabs, and reserve rules
├── GOOGLE_SHEETS_INTEGRATION.md # Sheets format, Drive proxying, and parser
├── SECURITY_STANDARDS.md        # RLS policies, RBAC, and zero-trust standards
├── UI_UX_GUIDELINES.md          # Sports color tokens, typography, and UX
├── CHANGELOG.md                 # Version history and releases
├── supabase/
│   └── migrations/              # PostgreSQL DDL migrations
└── src/
    ├── app/                     # Next.js 15 App Router pages & APIs
    │   ├── admin/               # Admin console routes
    │   │   ├── auction-control/ # Live auction control desk
    │   │   ├── dashboard/       # Metric cards & overview
    │   │   ├── login/           # Admin authentication
    │   │   ├── players/         # Player roster & sheets import
    │   │   ├── reports/         # Financial and squad exports
    │   │   ├── results/         # Auction results manager
    │   │   ├── settings/        # Base price and slab configurations
    │   │   └── teams/           # Franchise and purse management
    │   ├── live/                # Broadcast TV & projector stage view
    │   ├── teams/               # Public franchise rosters & purse view
    │   ├── results/             # Public sold/unsold player directory
    │   ├── api/                 # Next.js route handlers
    │   ├── layout.tsx           # Root layout with sports theme
    │   ├── page.tsx             # Main portal landing page
    │   └── globals.css          # CSS theme variables & styling
    ├── components/
    │   ├── admin/               # Admin sidebar, header, control pads
    │   ├── public/              # Stage player card, timer, bid ticker
    │   └── ui/                  # shadcn/ui components (buttons, badges, etc.)
    ├── lib/
    │   ├── mock-data/           # Realistic NTL Season 1 data fixtures
    │   ├── supabase/            # Supabase SSR and client factories
    │   ├── google/              # Google Sheets & Drive API client
    │   └── utils.ts             # Tailwind class merging & currency formatters
    └── types/                   # TypeScript interfaces & database schemas
```

---

## 📜 License
Private & Proprietary – Nalanda Turf League (NTL). All rights reserved.
