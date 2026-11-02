-- Independent from optimistic action versions: configuration edits also advance this cursor.
CREATE TABLE auction_revisions (
  league_id text PRIMARY KEY REFERENCES auction_leagues(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0
);
INSERT INTO auction_revisions(league_id) SELECT id FROM auction_leagues;

CREATE FUNCTION auction_publish_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target text;
  cursor_value bigint;
BEGIN
  IF TG_TABLE_NAME = 'auction_leagues' THEN
    target := NEW.id;
  ELSE
    IF TG_OP = 'DELETE' THEN target := OLD.league_id; ELSE target := NEW.league_id; END IF;
  END IF;
  -- Cascading deletion does not recreate a revision row for a removed league.
  IF NOT EXISTS (SELECT 1 FROM auction_leagues WHERE id = target) THEN RETURN NULL; END IF;
  INSERT INTO auction_revisions(league_id,revision) VALUES(target,1)
    ON CONFLICT(league_id) DO UPDATE SET revision = auction_revisions.revision + 1
    RETURNING revision INTO cursor_value;
  -- PostgreSQL delivers NOTIFY only after COMMIT; never publish entity data here.
  PERFORM pg_notify('auction_changes', json_build_object('leagueId',target,'revision',cursor_value)::text);
  RETURN NULL;
END;
$$;
CREATE TRIGGER auction_leagues_realtime AFTER INSERT OR UPDATE ON auction_leagues FOR EACH ROW EXECUTE FUNCTION auction_publish_change();
CREATE TRIGGER auction_states_realtime AFTER INSERT OR UPDATE OR DELETE ON auction_states FOR EACH ROW EXECUTE FUNCTION auction_publish_change();
CREATE TRIGGER auction_teams_realtime AFTER INSERT OR UPDATE OR DELETE ON auction_teams FOR EACH ROW EXECUTE FUNCTION auction_publish_change();
CREATE TRIGGER auction_players_realtime AFTER INSERT OR UPDATE OR DELETE ON auction_players FOR EACH ROW EXECUTE FUNCTION auction_publish_change();
CREATE TRIGGER auction_bids_realtime AFTER INSERT OR UPDATE OR DELETE ON auction_bids FOR EACH ROW EXECUTE FUNCTION auction_publish_change();
CREATE TRIGGER auction_purchases_realtime AFTER INSERT OR UPDATE OR DELETE ON auction_purchases FOR EACH ROW EXECUTE FUNCTION auction_publish_change();
