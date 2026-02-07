-- Per-match DUPR submission history and CRUD tracking

CREATE TABLE IF NOT EXISTS dupr_submitted_matches (
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

CREATE INDEX IF NOT EXISTS idx_dupr_submitted_matches_created_at ON dupr_submitted_matches(created_at);
CREATE INDEX IF NOT EXISTS idx_dupr_submitted_matches_tournament ON dupr_submitted_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_dupr_submitted_matches_status ON dupr_submitted_matches(status);
CREATE INDEX IF NOT EXISTS idx_dupr_submitted_matches_dupr_match_id ON dupr_submitted_matches(dupr_match_id);
