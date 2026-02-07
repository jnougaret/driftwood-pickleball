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

-- DUPR webhook ingestion events (raw payloads from DUPR callbacks)
CREATE TABLE dupr_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT,
  topic TEXT,
  event TEXT,
  payload TEXT NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dupr_webhook_events_topic ON dupr_webhook_events(topic);
CREATE INDEX idx_dupr_webhook_events_event ON dupr_webhook_events(event);
CREATE INDEX idx_dupr_webhook_events_created_at ON dupr_webhook_events(created_at);

-- DUPR player rating subscription tracking for each linked user
CREATE TABLE dupr_player_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  dupr_id TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'RATING',
  dupr_env TEXT NOT NULL DEFAULT 'uat',
  status TEXT NOT NULL,
  last_http_status INTEGER,
  last_response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, dupr_id, topic, dupr_env)
);

CREATE INDEX idx_dupr_player_subscriptions_user ON dupr_player_subscriptions(user_id);
CREATE INDEX idx_dupr_player_subscriptions_dupr_id ON dupr_player_subscriptions(dupr_id);
CREATE INDEX idx_dupr_player_subscriptions_status ON dupr_player_subscriptions(status);

-- DUPR webhook registration audit history
CREATE TABLE dupr_webhook_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  topics_json TEXT NOT NULL,
  status_code INTEGER,
  response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dupr_webhook_registrations_created_at ON dupr_webhook_registrations(created_at);

-- DUPR match submission audit trail
CREATE TABLE dupr_match_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  dupr_env TEXT NOT NULL DEFAULT 'uat',
  endpoint TEXT NOT NULL,
  match_count INTEGER NOT NULL DEFAULT 0,
  status_code INTEGER,
  success INTEGER NOT NULL DEFAULT 0,
  response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dupr_match_submissions_tournament ON dupr_match_submissions(tournament_id);
CREATE INDEX idx_dupr_match_submissions_created_at ON dupr_match_submissions(created_at);

-- DUPR per-match submission history (supports create/update/delete lifecycle)
CREATE TABLE dupr_submitted_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id TEXT,
  submission_id INTEGER,
  submitted_by TEXT NOT NULL,
  dupr_env TEXT NOT NULL DEFAULT 'uat',
  dupr_match_id INTEGER,
  dupr_match_code TEXT,
  identifier TEXT NOT NULL,
  event_name TEXT NOT NULL,
  bracket_name TEXT,
  location TEXT,
  match_date TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'DOUBLES',
  match_type TEXT NOT NULL DEFAULT 'SIDEOUT',
  club_id INTEGER,
  team_a_player1 TEXT NOT NULL,
  team_a_player2 TEXT,
  team_b_player1 TEXT NOT NULL,
  team_b_player2 TEXT,
  team_a_player1_dupr TEXT NOT NULL,
  team_a_player2_dupr TEXT,
  team_b_player1_dupr TEXT NOT NULL,
  team_b_player2_dupr TEXT,
  team_a_game1 INTEGER NOT NULL,
  team_b_game1 INTEGER NOT NULL,
  team_a_game2 INTEGER,
  team_b_game2 INTEGER,
  team_a_game3 INTEGER,
  team_b_game3 INTEGER,
  team_a_game4 INTEGER,
  team_b_game4 INTEGER,
  team_a_game5 INTEGER,
  team_b_game5 INTEGER,
  status TEXT NOT NULL DEFAULT 'submitted',
  last_status_code INTEGER,
  last_response TEXT,
  deleted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(identifier, dupr_env)
);

CREATE INDEX idx_dupr_submitted_matches_created_at ON dupr_submitted_matches(created_at);
CREATE INDEX idx_dupr_submitted_matches_tournament ON dupr_submitted_matches(tournament_id);
CREATE INDEX idx_dupr_submitted_matches_status ON dupr_submitted_matches(status);
CREATE INDEX idx_dupr_submitted_matches_dupr_match_id ON dupr_submitted_matches(dupr_match_id);
