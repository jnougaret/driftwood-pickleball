-- DUPR match submission audit

CREATE TABLE IF NOT EXISTS dupr_match_submissions (
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

CREATE INDEX IF NOT EXISTS idx_dupr_match_submissions_tournament ON dupr_match_submissions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_dupr_match_submissions_created_at ON dupr_match_submissions(created_at);

