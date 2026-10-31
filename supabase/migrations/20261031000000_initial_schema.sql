-- ==============================================================================
-- NTL AUCTION PLATFORM - INITIAL POSTGRESQL SCHEMA MIGRATION
-- Migration Version: 20261031000000_initial_schema.sql
-- Supports Multi-League, Franchises, Players, Realtime Bids, Purses, and Audits
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. LEAGUES & SEASONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    primary_color VARCHAR(16) DEFAULT '#059669',
    secondary_color VARCHAR(16) DEFAULT '#F59E0B',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    edition INT NOT NULL,
    name VARCHAR(128) NOT NULL,
    year INT NOT NULL,
    status VARCHAR(32) DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ACTIVE', 'COMPLETED')),
    total_purse_per_team BIGINT NOT NULL DEFAULT 5000000,
    min_players_per_team INT NOT NULL DEFAULT 15,
    max_players_per_team INT NOT NULL DEFAULT 18,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (league_id, edition)
);

-- ------------------------------------------------------------------------------
-- 2. TEAMS & TEAM PURSES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    short_code VARCHAR(8) NOT NULL,
    logo_url TEXT,
    owner_name VARCHAR(255),
    owner_photo_url TEXT,
    icon_player_name VARCHAR(255),
    primary_color VARCHAR(16) DEFAULT '#1E293B',
    secondary_color VARCHAR(16) DEFAULT '#F59E0B',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (season_id, short_code)
);

CREATE TABLE IF NOT EXISTS team_purses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID UNIQUE NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    total_budget BIGINT NOT NULL CHECK (total_budget >= 0),
    spent_amount BIGINT NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),
    remaining_amount BIGINT GENERATED ALWAYS AS (total_budget - spent_amount) STORED,
    min_players INT NOT NULL DEFAULT 15,
    max_players INT NOT NULL DEFAULT 18,
    reserved_for_squad BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. PLAYERS & STATS
-- ------------------------------------------------------------------------------
CREATE TYPE player_category AS ENUM ('ICON', 'PLATINUM', 'GOLD', 'SILVER', 'EMERGING');
CREATE TYPE player_role AS ENUM ('BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER');
CREATE TYPE player_status AS ENUM ('AVAILABLE', 'ON_AUCTION', 'SOLD', 'UNSOLD', 'WITHDRAWN');

CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    registration_no VARCHAR(64) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    category player_category NOT NULL DEFAULT 'SILVER',
    primary_role player_role NOT NULL,
    batting_style VARCHAR(64) DEFAULT 'Right Hand Bat',
    bowling_style VARCHAR(64) DEFAULT 'Right Arm Medium',
    photo_url TEXT,
    base_price BIGINT NOT NULL CHECK (base_price >= 0),
    status player_status NOT NULL DEFAULT 'AVAILABLE',
    sort_order INT DEFAULT 0,
    stats_summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (season_id, registration_no)
);

-- ------------------------------------------------------------------------------
-- 4. AUCTIONS, RULES & LIVE STATE
-- ------------------------------------------------------------------------------
CREATE TYPE auction_status AS ENUM ('IDLE', 'IN_PROGRESS', 'PAUSED', 'FINISHED');

CREATE TABLE IF NOT EXISTS auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID UNIQUE NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    current_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    current_highest_bid BIGINT DEFAULT 0,
    current_leading_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    status auction_status NOT NULL DEFAULT 'IDLE',
    timer_seconds INT DEFAULT 30,
    round INT DEFAULT 1,
    bid_count INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auction_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID UNIQUE NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    icon_base_price BIGINT NOT NULL DEFAULT 200000,
    platinum_base_price BIGINT NOT NULL DEFAULT 100000,
    gold_base_price BIGINT NOT NULL DEFAULT 50000,
    silver_base_price BIGINT NOT NULL DEFAULT 25000,
    emerging_base_price BIGINT NOT NULL DEFAULT 15000,
    bid_slab_rules JSONB NOT NULL DEFAULT '[
        {"max": 100000, "step": 10000},
        {"max": 500000, "step": 25000},
        {"max": 1000000, "step": 50000},
        {"max": 999999999, "step": 100000}
    ]'::jsonb,
    timer_duration_seconds INT NOT NULL DEFAULT 30,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. BIDS & PURCHASES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL CHECK (amount > 0),
    bid_type VARCHAR(32) DEFAULT 'STANDARD' CHECK (bid_type IN ('BASE', 'STANDARD', 'OVERRIDE', 'UNDONE')),
    placed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bids_auction_player ON bids (auction_id, player_id, placed_at DESC);

CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    player_id UUID UNIQUE NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    final_price BIGINT NOT NULL CHECK (final_price >= 0),
    round INT DEFAULT 1,
    sold_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_team ON purchases (team_id);

-- ------------------------------------------------------------------------------
-- 6. ADMIN PROFILES & AUDIT LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(32) DEFAULT 'AUCTIONEER' CHECK (role IN ('SUPER_ADMIN', 'COMMISSIONER', 'AUCTIONEER')),
    full_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id),
    action_type VARCHAR(64) NOT NULL,
    target_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. ATOMIC STORED PROCEDURE: sp_place_bid
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_place_bid(
    p_auction_id UUID,
    p_team_id UUID,
    p_player_id UUID,
    p_amount BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_purse RECORD;
    v_auction RECORD;
    v_players_count INT;
    v_min_remaining BIGINT;
    v_new_bid_id UUID;
BEGIN
    -- 1. Check & Lock Auction
    SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Auction session % not found', p_auction_id;
    END IF;
    IF v_auction.status != 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'Auction is currently % (must be IN_PROGRESS)', v_auction.status;
    END IF;
    IF v_auction.current_player_id != p_player_id THEN
        RAISE EXCEPTION 'Lot mismatch: player is no longer active in spotlight';
    END IF;

    -- 2. Validate Amount
    IF p_amount <= COALESCE(v_auction.current_highest_bid, 0) THEN
        RAISE EXCEPTION 'Bid amount ₹% must exceed current highest bid ₹%', p_amount, v_auction.current_highest_bid;
    END IF;

    -- 3. Lock & Validate Team Purse & Squad Reserve
    SELECT * INTO v_purse FROM team_purses WHERE team_id = p_team_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team purse not found for team %', p_team_id;
    END IF;

    SELECT COUNT(*) INTO v_players_count FROM purchases WHERE team_id = p_team_id;
    IF v_players_count >= v_purse.max_players THEN
        RAISE EXCEPTION 'Team has already reached max squad size of %', v_purse.max_players;
    END IF;

    -- Minimum required balance reserve for unfilled squad spots:
    v_min_remaining := GREATEST(0, (v_purse.min_players - v_players_count - 1)) * 25000;
    IF (v_purse.remaining_amount - p_amount) < v_min_remaining THEN
        RAISE EXCEPTION 'Purse reserve violation: Team needs ₹% reserved for minimum squad slots', v_min_remaining;
    END IF;

    -- 4. Record Bid in Ledger
    INSERT INTO bids (auction_id, player_id, team_id, amount)
    VALUES (p_auction_id, p_player_id, p_team_id, p_amount)
    RETURNING id INTO v_new_bid_id;

    -- 5. Update Active Auction Record
    UPDATE auctions
    SET current_highest_bid = p_amount,
        current_leading_team_id = p_team_id,
        timer_seconds = 30,
        bid_count = bid_count + 1,
        updated_at = NOW()
    WHERE id = p_auction_id;

    RETURN jsonb_build_object(
        'success', true,
        'bid_id', v_new_bid_id,
        'amount', p_amount,
        'leading_team_id', p_team_id
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_purses ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for spectators and broadcast displays
CREATE POLICY "Public read leagues" ON leagues FOR SELECT USING (true);
CREATE POLICY "Public read seasons" ON seasons FOR SELECT USING (true);
CREATE POLICY "Public read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read team_purses" ON team_purses FOR SELECT USING (true);
CREATE POLICY "Public read players" ON players FOR SELECT USING (true);
CREATE POLICY "Public read auctions" ON auctions FOR SELECT USING (true);
CREATE POLICY "Public read bids" ON bids FOR SELECT USING (true);
CREATE POLICY "Public read purchases" ON purchases FOR SELECT USING (true);

-- Realtime publication for live socket broadcasts
ALTER PUBLICATION supabase_realtime ADD TABLE auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE bids;
ALTER PUBLICATION supabase_realtime ADD TABLE team_purses;
ALTER PUBLICATION supabase_realtime ADD TABLE purchases;
