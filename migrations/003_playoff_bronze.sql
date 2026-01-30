ALTER TABLE tournament_settings ADD COLUMN playoff_best_of_three_bronze INTEGER DEFAULT 0;
ALTER TABLE playoff_state ADD COLUMN bronze_best_of_three INTEGER DEFAULT 0;
