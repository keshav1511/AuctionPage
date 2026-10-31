# NTL Auction Platform – UI & UX Design Guidelines

## 1. Visual Identity & Color Palette

The visual identity is designed specifically for high-stakes cricket tournament auctions, blending broadcast TV aesthetics with sleek executive dark mode.

### 1.1 Color Palette
- **Deep Charcoal Canvas**:
  - `bg-background`: `#090D10` (Ultra-dark pitch black-tinted slate)
  - `bg-card`: `#11161B` (Slightly elevated surface for cards and panels)
  - `bg-muted`: `#182026` (Subtle container backgrounds, dividers)
  - `border-border`: `#232E38` (Refined metallic border lines)
- **Turf Emerald Green (Primary Brand)**:
  - `primary-500`: `#059669` (Vibrant cricket outfield green)
  - `primary-400`: `#10B981` (Hover state & active highlights)
  - `primary-900/30`: `rgba(5, 150, 105, 0.25)` (Glows & subtle badge fills)
- **Metallic Trophy Gold (Auction Highlights & Bids)**:
  - `gold-500`: `#F59E0B` (Amber gold for live high bids and leaderboards)
  - `gold-400`: `#FBBF24` (Shimmering highlight for "SOLD" crowns)
  - `gold-600`: `#D97706` (Deeper metallic brass for card borders)
- **Signal Colors**:
  - `danger`: `#EF4444` (Timer countdown under 10s, purse overdraft alert)
  - `success`: `#10B981` (Confirmed sold, player acquired)
  - `warning`: `#F59E0B` (Approaching minimum squad reserve limits)

---

## 2. Typography

- **Display & Headings**: `Inter`, `Cabinet Grotesk` or `Geist Sans` with uppercase tracking (`tracking-wider`, `tracking-widest`).
- **Numbers & Bids**: Tabular numbers (`font-mono tabular-nums`) so that rapidly changing values do not jitter layout.
- **Sizes & Scale**:
  - Broadcast Bid Amount: `text-6xl` to `text-8xl` bold, with gold gradient text (`bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-yellow-200`).
  - Timer: `text-5xl` mono font with pulsing danger rings when under 10 seconds.
  - Player Name: `text-3xl` to `text-5xl` bold uppercase.
  - Team Shortcode: `text-xl` heavy badge.

---

## 3. Responsive Dual Interface Design

### 3.1 Public Stage & Broadcast Display
Designed specifically for:
- 1080p, 4K TVs, and 16:9 stage projectors.
- Readability from 20+ feet away.
- Clutter-free layout:
  - **Left / Center**: Massive player spotlight card, current high bid, leading franchise logo, countdown clock, category badge.
  - **Right / Bottom**: Live team purse scoreboard, recent bid ticker, upcoming players queue.
- Visual animations:
  - Subtle breathing glow on active leading bidder.
  - Full-screen gold particle burst (`canvas-confetti`) when gavel strikes "SOLD".

### 3.2 Admin Operations Desk
Designed specifically for:
- 13" – 16" laptops used by the live auctioneer and data entry desk.
- High information density with zero scrolling needed during an active lot.
- Instant keyboard shortcuts:
  - `[Space]`: Toggle Pause / Resume
  - `[1]`: +₹10,000
  - `[2]`: +₹25,000
  - `[3]`: +₹50,000
  - `[4]`: +₹1,00,000
  - `[S]`: Mark SOLD (Trigger Hammer)
  - `[U]`: Mark UNSOLD
  - `[Z]`: Undo Last Action

---

## 4. Component Micro-Interactions

1. **Bid Increase Transition**: Number counters smoothly roll up with a subtle green scale pop.
2. **Timer Urgency**:
   - 30s - 11s: Turf green ring, steady pace.
   - 10s - 6s: Amber ring, pulse every second.
   - 5s - 0s: Crimson ring, rapid alert audio ping, intense flashing.
3. **Purse Utilization Bar**:
   - Gradient bar showing `Spent` (Turf green), `Current Bid Commitment` (Gold flashing), and `Reserved Minimum Squad Balance` (Muted gray), clearly exposing remaining free budget.
