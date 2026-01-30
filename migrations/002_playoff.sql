ALTER TABLE tournament_settings ADD COLUMN playoff_teams INTEGER;
ALTER TABLE tournament_settings ADD COLUMN playoff_best_of_three INTEGER DEFAULT 0;

CREATE TABLE playoff_state (
  tournament_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  playoff_teams INTEGER,
  best_of_three INTEGER DEFAULT 0,
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
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tournament_id, round_number, match_number),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

CREATE INDEX idx_playoff_scores_tournament ON playoff_scores(tournament_id);
