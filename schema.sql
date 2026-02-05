-- Driftwood Pickleball Database Schema
-- Created: 2026-01-28

-- Users table: stores user profiles and authentication data
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- Clerk user ID (clerk_xxx)
  email TEXT NOT NULL UNIQUE,       -- From OAuth provider
  display_name TEXT NOT NULL,       -- Player name from DUPR
  dupr_id TEXT,                     -- DUPR account ID (from DUPR API)
  doubles_rating REAL,              -- DUPR doubles rating (from DUPR API)
  singles_rating REAL,              -- DUPR singles rating (from DUPR API)
  is_admin BOOLEAN DEFAULT 0,       -- Admin flag
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_admin ON users(is_admin);

-- Tournaments table: stores tournament information
CREATE TABLE tournaments (
  id TEXT PRIMARY KEY,              -- From tournaments-config.js (e.g., 'feb28-tournament')
  title TEXT NOT NULL,              -- Tournament name
  start_time TEXT,                  -- Start time display text
  start_date TEXT,                  -- YYYY-MM-DD (ET)
  start_time_et TEXT,               -- HH:MM 24-hour (ET)
  timezone TEXT DEFAULT 'America/New_York',
  location TEXT,                    -- Venue name
  format TEXT,                      -- Tournament format (e.g., "Coed Doubles")
  format_type TEXT,                 -- coed_doubles | mixed_doubles
  skill_level TEXT,                 -- Skill restrictions (e.g., "DUPR 9.25 or below")
  skill_level_cap REAL,             -- numeric cap used to render skill_level
  entry_fee TEXT,                   -- Entry fee text (e.g., "$15 per player")
  entry_fee_amount REAL,            -- numeric fee per player
  prize_split TEXT,                 -- Prize distribution (e.g., "50% - 30% - 20%")
  theme TEXT,                       -- Card theme: 'blue' or 'gold'
  max_registrations INTEGER,        -- Registration cap (NULL = unlimited)
  registration_opens DATETIME,      -- When registration opens
  registration_closes DATETIME,     -- When registration closes
  live_start DATETIME,              -- When tournament starts (for live streaming)
  live_end DATETIME,                -- When tournament ends
  status TEXT DEFAULT 'upcoming',   -- Status: 'upcoming', 'live', 'completed', 'cancelled'
  swish_url TEXT,                   -- Backup Swish registration URL
  csv_url TEXT,                     -- Published bracket CSV (results cards)
  photo_url TEXT,                   -- Winners photo path (results cards)
  display_order INTEGER DEFAULT 0,  -- Sort order within a section
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_start ON tournaments(live_start);

-- Registrations table: stores tournament registrations
CREATE TABLE registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id TEXT NOT NULL,      -- References tournaments(id)
  user_id TEXT NOT NULL,            -- References users(id) - Clerk ID
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  partner_name TEXT,                -- Optional: partner name for doubles
  notes TEXT,                       -- Optional: player notes/preferences
  status TEXT DEFAULT 'registered', -- Status: 'registered', 'waitlist', 'cancelled'
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(tournament_id, user_id)    -- One registration per user per tournament
);

CREATE INDEX idx_registrations_tournament ON registrations(tournament_id);
CREATE INDEX idx_registrations_user ON registrations(user_id);
CREATE INDEX idx_registrations_status ON registrations(status);

-- Teams table: groups players for a tournament
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_teams_tournament ON teams(tournament_id);

-- Team members table: players on a team
CREATE TABLE team_members (
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- Rate limits table: basic request limiting per user+endpoint
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at DATETIME NOT NULL
);

-- Tournament settings table: admin-managed tournament config
CREATE TABLE tournament_settings (
  tournament_id TEXT PRIMARY KEY,
  max_teams INTEGER NOT NULL,
  rounds INTEGER NOT NULL,
  playoff_teams INTEGER,
  playoff_best_of_three INTEGER DEFAULT 0,
  playoff_best_of_three_bronze INTEGER DEFAULT 0,
  dupr_required INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

CREATE TABLE playoff_state (
  tournament_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  playoff_teams INTEGER,
  best_of_three INTEGER DEFAULT 0,
  bronze_best_of_three INTEGER DEFAULT 0,
  bracket_size INTEGER,
  seed_order TEXT,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

CREATE TABLE playoff_scores (
  tournament_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  game1_score1 INTEGER,
  game1_score2 INTEGER,
  game2_score1 INTEGER,
  game2_score2 INTEGER,
  game3_score1 INTEGER,
  game3_score2 INTEGER,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tournament_id, round_number, match_number),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

CREATE INDEX idx_playoff_scores_tournament ON playoff_scores(tournament_id);

CREATE TRIGGER IF NOT EXISTS trg_playoff_scores_type_guard_insert
BEFORE INSERT ON playoff_scores
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NEW.game1_score1 IS NOT NULL AND typeof(NEW.game1_score1) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game1_score1 must be integer or null') END;
  SELECT CASE WHEN NEW.game1_score2 IS NOT NULL AND typeof(NEW.game1_score2) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game1_score2 must be integer or null') END;
  SELECT CASE WHEN NEW.game2_score1 IS NOT NULL AND typeof(NEW.game2_score1) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game2_score1 must be integer or null') END;
  SELECT CASE WHEN NEW.game2_score2 IS NOT NULL AND typeof(NEW.game2_score2) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game2_score2 must be integer or null') END;
  SELECT CASE WHEN NEW.game3_score1 IS NOT NULL AND typeof(NEW.game3_score1) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game3_score1 must be integer or null') END;
  SELECT CASE WHEN NEW.game3_score2 IS NOT NULL AND typeof(NEW.game3_score2) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game3_score2 must be integer or null') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_playoff_scores_type_guard_update
BEFORE UPDATE ON playoff_scores
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NEW.game1_score1 IS NOT NULL AND typeof(NEW.game1_score1) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game1_score1 must be integer or null') END;
  SELECT CASE WHEN NEW.game1_score2 IS NOT NULL AND typeof(NEW.game1_score2) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game1_score2 must be integer or null') END;
  SELECT CASE WHEN NEW.game2_score1 IS NOT NULL AND typeof(NEW.game2_score1) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game2_score1 must be integer or null') END;
  SELECT CASE WHEN NEW.game2_score2 IS NOT NULL AND typeof(NEW.game2_score2) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game2_score2 must be integer or null') END;
  SELECT CASE WHEN NEW.game3_score1 IS NOT NULL AND typeof(NEW.game3_score1) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game3_score1 must be integer or null') END;
  SELECT CASE WHEN NEW.game3_score2 IS NOT NULL AND typeof(NEW.game3_score2) != 'integer' THEN RAISE(ABORT, 'playoff_scores.game3_score2 must be integer or null') END;
END;

-- Tournament state table: registration vs tournament mode
CREATE TABLE tournament_state (
  tournament_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  started_at DATETIME,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- Round robin matches and scores
CREATE TABLE round_robin_matches (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  team1_id TEXT NOT NULL,
  team2_id TEXT NOT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (team1_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (team2_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX idx_round_robin_matches_tournament ON round_robin_matches(tournament_id);
CREATE INDEX idx_round_robin_matches_round ON round_robin_matches(tournament_id, round_number);

CREATE TABLE round_robin_scores (
  match_id TEXT PRIMARY KEY,
  score1 INTEGER,
  score2 INTEGER,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES round_robin_matches(id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS trg_round_robin_scores_type_guard_insert
BEFORE INSERT ON round_robin_scores
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NEW.score1 IS NOT NULL AND typeof(NEW.score1) != 'integer' THEN RAISE(ABORT, 'round_robin_scores.score1 must be integer or null') END;
  SELECT CASE WHEN NEW.score2 IS NOT NULL AND typeof(NEW.score2) != 'integer' THEN RAISE(ABORT, 'round_robin_scores.score2 must be integer or null') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_round_robin_scores_type_guard_update
BEFORE UPDATE ON round_robin_scores
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NEW.score1 IS NOT NULL AND typeof(NEW.score1) != 'integer' THEN RAISE(ABORT, 'round_robin_scores.score1 must be integer or null') END;
  SELECT CASE WHEN NEW.score2 IS NOT NULL AND typeof(NEW.score2) != 'integer' THEN RAISE(ABORT, 'round_robin_scores.score2 must be integer or null') END;
END;

-- Admin actions table: audit log for admin activities
CREATE TABLE admin_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id TEXT NOT NULL,           -- Admin user ID who performed the action
  action TEXT NOT NULL,             -- Action type: 'remove_registration', 'grant_admin', etc.
  target_user_id TEXT,              -- User affected by the action (if applicable)
  tournament_id TEXT,               -- Tournament related to action (if applicable)
  reason TEXT,                      -- Optional: reason for the action
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id)
);

CREATE INDEX idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX idx_admin_actions_created ON admin_actions(created_at);
CREATE INDEX idx_admin_actions_tournament ON admin_actions(tournament_id);

-- Admin allowlist: emails granted admin before first sign-in/profile creation
CREATE TABLE admin_allowlist (
  email TEXT PRIMARY KEY,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_admin_allowlist_created_at ON admin_allowlist(created_at);
