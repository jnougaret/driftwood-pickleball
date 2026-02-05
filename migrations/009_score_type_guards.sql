-- Enforce integer-only score storage (or NULL) to prevent malformed values like "8-11"

CREATE TRIGGER IF NOT EXISTS trg_round_robin_scores_type_guard_insert
BEFORE INSERT ON round_robin_scores
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NEW.score1 IS NOT NULL AND typeof(NEW.score1) != 'integer' THEN RAISE(ABORT, 'round_robin_scores.score1 must be integer or null')
        WHEN NEW.score2 IS NOT NULL AND typeof(NEW.score2) != 'integer' THEN RAISE(ABORT, 'round_robin_scores.score2 must be integer or null')
    END;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_round_robin_scores_type_guard_update
BEFORE UPDATE ON round_robin_scores
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NEW.score1 IS NOT NULL AND typeof(NEW.score1) != 'integer' THEN RAISE(ABORT, 'round_robin_scores.score1 must be integer or null')
        WHEN NEW.score2 IS NOT NULL AND typeof(NEW.score2) != 'integer' THEN RAISE(ABORT, 'round_robin_scores.score2 must be integer or null')
    END;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_playoff_scores_type_guard_insert
BEFORE INSERT ON playoff_scores
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NEW.game1_score1 IS NOT NULL AND typeof(NEW.game1_score1) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game1_score1 must be integer or null')
        WHEN NEW.game1_score2 IS NOT NULL AND typeof(NEW.game1_score2) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game1_score2 must be integer or null')
        WHEN NEW.game2_score1 IS NOT NULL AND typeof(NEW.game2_score1) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game2_score1 must be integer or null')
        WHEN NEW.game2_score2 IS NOT NULL AND typeof(NEW.game2_score2) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game2_score2 must be integer or null')
        WHEN NEW.game3_score1 IS NOT NULL AND typeof(NEW.game3_score1) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game3_score1 must be integer or null')
        WHEN NEW.game3_score2 IS NOT NULL AND typeof(NEW.game3_score2) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game3_score2 must be integer or null')
    END;
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_playoff_scores_type_guard_update
BEFORE UPDATE ON playoff_scores
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NEW.game1_score1 IS NOT NULL AND typeof(NEW.game1_score1) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game1_score1 must be integer or null')
        WHEN NEW.game1_score2 IS NOT NULL AND typeof(NEW.game1_score2) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game1_score2 must be integer or null')
        WHEN NEW.game2_score1 IS NOT NULL AND typeof(NEW.game2_score1) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game2_score1 must be integer or null')
        WHEN NEW.game2_score2 IS NOT NULL AND typeof(NEW.game2_score2) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game2_score2 must be integer or null')
        WHEN NEW.game3_score1 IS NOT NULL AND typeof(NEW.game3_score1) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game3_score1 must be integer or null')
        WHEN NEW.game3_score2 IS NOT NULL AND typeof(NEW.game3_score2) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game3_score2 must be integer or null')
    END;
END;
