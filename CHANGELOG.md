# Changelog

All notable changes to the **NTL Auction Platform** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-alpha.1] - 2026-10-31

### Added
- **Project Scaffold**: Next.js 15 App Router initialization with TypeScript strict mode and Node 24 support.
- **Visual Design System**: Tailored cricket sports theme featuring dark charcoal background (`#090D10`), turf green (`#059669`), and trophy gold (`#F59E0B`).
- **Dual Interface Layouts**:
  - Broadcast-ready Public Auction Stage (`/live`, `/teams`, `/results`) optimized for large TV and projector screens.
  - Comprehensive Admin Console (`/admin/dashboard`, `/admin/teams`, `/admin/players`, `/admin/settings`, `/admin/auction-control`, `/admin/results`, `/admin/reports`).
- **Database Schema**: Normalized PostgreSQL DDL migration with support for multi-tenancy, franchises, players, bids, purses, and atomic stored procedures.
- **Architectural Documentation**:
  - `MASTER_PLAN.md`
  - `SYSTEM_ARCHITECTURE.md`
  - `DATABASE_SCHEMA.md`
  - `API_DOCUMENTATION.md`
  - `AUCTION_ENGINE.md`
  - `GOOGLE_SHEETS_INTEGRATION.md`
  - `SECURITY_STANDARDS.md`
  - `UI_UX_GUIDELINES.md`
  - `CHANGELOG.md`
- **Google Sheets & Drive Integration Architecture**: Schemas, parsers, Drive URL resolution, and sync endpoint specifications.
- **Mock Data Engine**: Realistic NTL Season 1 franchises, player rosters, and live state for instant local interactivity without live backend requirements.
