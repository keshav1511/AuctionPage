-- ==============================================================================
-- NTL AUCTION PLATFORM - PHASE 2 SCHEMA EXTENSIONS
-- Migration Version: 20261031010000_league_branding_and_drive.sql
-- Supports Multi-League Isolation, Dynamic Branding, Drive Asset Pipeline,
-- Authoritative Server Timers, Dynamic Slabs, and Audit Undo Rollbacks
-- ==============================================================================

-- 1. LEAGUE SCHEDULING, VENUE, BRANDING & GOOGLE INTEGRATION SETTINGS
ALTER TABLE leagues
ADD COLUMN IF NOT EXISTS match_date DATE,
ADD COLUMN IF NOT EXISTS match_venue VARCHAR(255) DEFAULT 'Perfect Pass, Falnir',
ADD COLUMN IF NOT EXISTS auction_date DATE,
ADD COLUMN IF NOT EXISTS auction_time VARCHAR(32) DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'Asia/Kolkata',
ADD COLUMN IF NOT EXISTS google_sheets_url TEXT,
ADD COLUMN IF NOT EXISTS google_drive_folder_url TEXT DEFAULT 'https://drive.google.com/drive/folders/1MtjUStUIqnlQic13-sfML_NbPygEkSwpUsgDe7b3hHJ1GGKbP7xvSHx3MI11kTS7CgVaT2hA',
ADD COLUMN IF NOT EXISTS branding_palette JSONB DEFAULT '{
  "primary": "#059669",
  "secondary": "#F59E0B",
  "accent": "#10B981",
  "background": "#090D10",
  "card": "#11161B",
  "border": "#1E293B",
  "text": "#F8FAFC"
}'::jsonb;

-- 2. TEAM MANAGEMENT EXTENSIONS
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS icon_player_photo_url TEXT,
ADD COLUMN IF NOT EXISTS category_limits JSONB DEFAULT '{
  "max_icon": 2,
  "max_platinum": 4,
  "min_emerging": 3
}'::jsonb;

-- 3. PLAYER IMAGE PROCESSING & OVERRIDE EXTENSIONS
ALTER TABLE players
ADD COLUMN IF NOT EXISTS original_photo_url TEXT,
ADD COLUMN IF NOT EXISTS normalized_photo_url TEXT,
ADD COLUMN IF NOT EXISTS photo_aspect_ratio VARCHAR(16) DEFAULT '3:4',
ADD COLUMN IF NOT EXISTS photo_match_status VARCHAR(32) DEFAULT 'UNMATCHED' CHECK (photo_match_status IN ('MATCHED', 'UNMATCHED', 'MANUAL_OVERRIDE')),
ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(128),
ADD COLUMN IF NOT EXISTS base_price_override BIGINT CHECK (base_price_override IS NULL OR base_price_override >= 0);

-- 4. AUCTION RULES - DYNAMIC SLABS & INDEPENDENT TIMERS
ALTER TABLE auction_rules
ADD COLUMN IF NOT EXISTS initial_timer_seconds INT NOT NULL DEFAULT 45,
ADD COLUMN IF NOT EXISTS bid_extension_seconds INT NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS category_base_prices JSONB DEFAULT '{
  "ICON": 200000,
  "PLATINUM": 100000,
  "GOLD": 50000,
  "SILVER": 25000,
  "EMERGING": 15000
}'::jsonb,
ADD COLUMN IF NOT EXISTS enable_individual_overrides BOOLEAN DEFAULT TRUE;

-- 5. AUCTION LIVE STATE - AUTHORITATIVE TIMESTAMPS
ALTER TABLE auctions
ADD COLUMN IF NOT EXISTS timer_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_bid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bid_extension_seconds INT DEFAULT 10;

-- 6. MULTI-LEAGUE DATA INTEGRITY TRIGGER
-- Asserts that any bid placed belongs to the same season/league as the auction
CREATE OR REPLACE FUNCTION fn_verify_bid_league_isolation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_auction_season_id UUID;
    v_team_season_id UUID;
    v_player_season_id UUID;
BEGIN
    SELECT season_id INTO v_auction_season_id FROM auctions WHERE id = NEW.auction_id;
    SELECT season_id INTO v_team_season_id FROM teams WHERE id = NEW.team_id;
    SELECT season_id INTO v_player_season_id FROM players WHERE id = NEW.player_id;

    IF v_auction_season_id IS NULL OR v_team_season_id IS NULL OR v_player_season_id IS NULL THEN
        RAISE EXCEPTION 'Foreign entity reference missing during bid placement';
    END IF;

    IF v_auction_season_id != v_team_season_id OR v_auction_season_id != v_player_season_id THEN
        RAISE EXCEPTION 'Multi-League Isolation Breach: Cross-league bid rejected (Season mismatch % vs % vs %)',
            v_auction_season_id, v_team_season_id, v_player_season_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verify_bid_league_isolation ON bids;
CREATE TRIGGER trg_verify_bid_league_isolation
BEFORE INSERT ON bids
FOR EACH ROW
EXECUTE FUNCTION fn_verify_bid_league_isolation();

-- 7. REVISED ATOMIC BID FUNCTION WITH AUTHORITATIVE EXTENSION TIMERS
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
    v_rules RECORD;
    v_players_count INT;
    v_min_remaining BIGINT;
    v_new_bid_id UUID;
    v_new_timer_expires_at TIMESTAMPTZ;
    v_extension_seconds INT;
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

    -- 2. Fetch Season Rules for Bid Extension
    SELECT * INTO v_rules FROM auction_rules WHERE season_id = v_auction.season_id;
    v_extension_seconds := COALESCE(v_rules.bid_extension_seconds, 10);

    -- 3. Validate Bid Amount is strictly increasing
    IF p_amount <= COALESCE(v_auction.current_highest_bid, 0) THEN
        RAISE EXCEPTION 'Bid amount ₹% must exceed current highest bid ₹%', p_amount, v_auction.current_highest_bid;
    END IF;

    -- 4. Lock & Validate Team Purse & Squad Reserve
    SELECT * INTO v_purse FROM team_purses WHERE team_id = p_team_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team purse not found for team %', p_team_id;
    END IF;

    SELECT COUNT(*) INTO v_players_count FROM purchases WHERE team_id = p_team_id;
    IF v_players_count >= v_purse.max_players THEN
        RAISE EXCEPTION 'Team has already reached max squad size of %', v_purse.max_players;
    END IF;

    -- Minimum required balance reserve for unfilled squad spots
    v_min_remaining := GREATEST(0, (v_purse.min_players - v_players_count - 1)) * 25000;
    IF (v_purse.remaining_amount - p_amount) < v_min_remaining THEN
        RAISE EXCEPTION 'Purse reserve violation: Team needs ₹% reserved for minimum squad slots', v_min_remaining;
    END IF;

    -- 5. Record Bid in Immutable Ledger
    INSERT INTO bids (auction_id, player_id, team_id, amount, bid_type)
    VALUES (p_auction_id, p_player_id, p_team_id, p_amount, 'STANDARD')
    RETURNING id INTO v_new_bid_id;

    -- 6. Authoritative Timer Extension Calculation
    v_new_timer_expires_at := NOW() + (v_extension_seconds || ' seconds')::INTERVAL;

    -- 7. Update Active Auction Record
    UPDATE auctions
    SET current_highest_bid = p_amount,
        current_leading_team_id = p_team_id,
        timer_seconds = v_extension_seconds,
        timer_expires_at = v_new_timer_expires_at,
        last_bid_at = NOW(),
        bid_count = bid_count + 1,
        updated_at = NOW()
    WHERE id = p_auction_id;

    RETURN jsonb_build_object(
        'success', true,
        'bid_id', v_new_bid_id,
        'amount', p_amount,
        'leading_team_id', p_team_id,
        'timer_expires_at', v_new_timer_expires_at,
        'bid_extension_seconds', v_extension_seconds
    );
END;
$$;

-- 8. TRANSACTION-SAFE UNDO FUNCTION WITH AUDIT LOGGING
CREATE OR REPLACE FUNCTION sp_undo_last_bid(
    p_auction_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT 'Auctioneer manual undo'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_auction RECORD;
    v_last_bid RECORD;
    v_prev_bid RECORD;
    v_rules RECORD;
    v_restored_expires_at TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Auction session % not found', p_auction_id;
    END IF;

    -- Get the last standard bid on this active lot
    SELECT * INTO v_last_bid FROM bids
    WHERE auction_id = p_auction_id AND player_id = v_auction.current_player_id AND bid_type != 'UNDONE'
    ORDER BY placed_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No reversible bids found for current lot';
    END IF;

    -- Mark this bid as UNDONE
    UPDATE bids SET bid_type = 'UNDONE' WHERE id = v_last_bid.id;

    -- Look for the previous standing bid on this lot
    SELECT * INTO v_prev_bid FROM bids
    WHERE auction_id = p_auction_id AND player_id = v_auction.current_player_id AND bid_type != 'UNDONE'
    ORDER BY placed_at DESC
    LIMIT 1;

    SELECT * INTO v_rules FROM auction_rules WHERE season_id = v_auction.season_id;
    v_restored_expires_at := NOW() + (COALESCE(v_rules.bid_extension_seconds, 15) || ' seconds')::INTERVAL;

    IF FOUND THEN
        UPDATE auctions
        SET current_highest_bid = v_prev_bid.amount,
            current_leading_team_id = v_prev_bid.team_id,
            timer_expires_at = v_restored_expires_at,
            timer_seconds = COALESCE(v_rules.bid_extension_seconds, 15),
            bid_count = GREATEST(0, bid_count - 1),
            updated_at = NOW()
        WHERE id = p_auction_id;
    ELSE
        -- Revert to base price if no previous bids exist
        DECLARE
            v_player RECORD;
        BEGIN
            SELECT * INTO v_player FROM players WHERE id = v_auction.current_player_id;
            UPDATE auctions
            SET current_highest_bid = COALESCE(v_player.base_price_override, v_player.base_price, 0),
                current_leading_team_id = NULL,
                timer_expires_at = v_restored_expires_at,
                timer_seconds = COALESCE(v_rules.initial_timer_seconds, 45),
                bid_count = 0,
                updated_at = NOW()
            WHERE id = p_auction_id;
        END;
    END IF;

    -- Record in audit logs
    INSERT INTO audit_logs (actor_id, action_type, target_id, metadata)
    VALUES (
        p_admin_id,
        'UNDO_BID',
        v_last_bid.id,
        jsonb_build_object(
            'undone_bid_id', v_last_bid.id,
            'undone_amount', v_last_bid.amount,
            'undone_team_id', v_last_bid.team_id,
            'reason', p_reason,
            'timestamp', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'undone_bid_id', v_last_bid.id,
        'restored_amount', v_auction.current_highest_bid,
        'restored_expires_at', v_restored_expires_at
    );
END;
$$;
