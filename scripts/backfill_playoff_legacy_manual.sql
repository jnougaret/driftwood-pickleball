-- Lightweight manual playoff backfill for legacy tournaments.
-- Safe to rerun: INSERT OR IGNORE uses UNIQUE(identifier, dupr_env).

WITH matches(tournament_id, team1_id, team2_id, g1a, g1b, g2a, g2b, g3a, g3b, ident, bracket_name) AS (
  VALUES
  ('jan10','legacy_jan10_t1','legacy_jan10_t8',11,2,NULL,NULL,NULL,NULL,'legacy:playoff:jan10:1:1','Quarter-finals'),
  ('jan10','legacy_jan10_t4','legacy_jan10_t5',7,11,NULL,NULL,NULL,NULL,'legacy:playoff:jan10:1:2','Quarter-finals'),
  ('jan10','legacy_jan10_t2','legacy_jan10_t7',9,11,NULL,NULL,NULL,NULL,'legacy:playoff:jan10:1:3','Quarter-finals'),
  ('jan10','legacy_jan10_t3','legacy_jan10_t6',5,11,NULL,NULL,NULL,NULL,'legacy:playoff:jan10:1:4','Quarter-finals'),
  ('jan10','legacy_jan10_t1','legacy_jan10_t5',11,6,NULL,NULL,NULL,NULL,'legacy:playoff:jan10:2:1','Semi-finals'),
  ('jan10','legacy_jan10_t7','legacy_jan10_t6',8,11,NULL,NULL,NULL,NULL,'legacy:playoff:jan10:2:2','Semi-finals'),
  ('jan10','legacy_jan10_t1','legacy_jan10_t6',8,11,11,0,9,11,'legacy:playoff:jan10:3:1','Gold Match'),
  ('jan10','legacy_jan10_t5','legacy_jan10_t7',5,11,NULL,NULL,NULL,NULL,'legacy:playoff:jan10:3:2','Bronze Match'),

  ('tournament-1770084914102','d685770c-662d-44d6-a312-237a3e3598cd','2acb4978-524a-4351-9cfb-bdfa5451ac4e',11,7,NULL,NULL,NULL,NULL,'legacy:playoff:tournament-1770084914102:1:1','Quarter-finals'),
  ('tournament-1770084914102','d2a06baa-9e57-405b-bad2-d92797b0e1a8','cdc2823a-ed8f-4da2-8295-43201af1d024',7,11,NULL,NULL,NULL,NULL,'legacy:playoff:tournament-1770084914102:1:2','Quarter-finals'),
  ('tournament-1770084914102','b9185293-92b6-40cd-be92-a67d052b56a5','7ccff3db-a5a8-411c-90b9-596580bcf74d',11,5,NULL,NULL,NULL,NULL,'legacy:playoff:tournament-1770084914102:1:3','Quarter-finals'),
  ('tournament-1770084914102','15465cf1-7455-4b02-8eb2-2cdbb0edf1da','bf30ac0b-0045-49e7-bac4-d6607b2953f3',11,6,NULL,NULL,NULL,NULL,'legacy:playoff:tournament-1770084914102:1:4','Quarter-finals'),
  ('tournament-1770084914102','d685770c-662d-44d6-a312-237a3e3598cd','cdc2823a-ed8f-4da2-8295-43201af1d024',9,11,NULL,NULL,NULL,NULL,'legacy:playoff:tournament-1770084914102:2:1','Semi-finals'),
  ('tournament-1770084914102','b9185293-92b6-40cd-be92-a67d052b56a5','15465cf1-7455-4b02-8eb2-2cdbb0edf1da',11,7,NULL,NULL,NULL,NULL,'legacy:playoff:tournament-1770084914102:2:2','Semi-finals'),
  ('tournament-1770084914102','cdc2823a-ed8f-4da2-8295-43201af1d024','b9185293-92b6-40cd-be92-a67d052b56a5',9,15,NULL,NULL,NULL,NULL,'legacy:playoff:tournament-1770084914102:3:1','Gold Match'),
  ('tournament-1770084914102','d685770c-662d-44d6-a312-237a3e3598cd','15465cf1-7455-4b02-8eb2-2cdbb0edf1da',8,15,NULL,NULL,NULL,NULL,'legacy:playoff:tournament-1770084914102:3:2','Bronze Match')
)
INSERT OR IGNORE INTO dupr_submitted_matches (
  tournament_id, submission_id, submitted_by, dupr_env, dupr_match_id, dupr_match_code, identifier,
  event_name, bracket_name, location, match_date, format, match_type, club_id,
  team_a_player1, team_a_player2, team_b_player1, team_b_player2,
  team_a_player1_dupr, team_a_player2_dupr, team_b_player1_dupr, team_b_player2_dupr,
  team_a_game1, team_b_game1, team_a_game2, team_b_game2, team_a_game3, team_b_game3, team_a_game4, team_b_game4, team_a_game5, team_b_game5,
  status, last_status_code, last_response, deleted_at
)
SELECT
  m.tournament_id,
  NULL,
  (SELECT id FROM users WHERE is_admin = 1 ORDER BY id LIMIT 1),
  'uat',
  NULL,
  NULL,
  m.ident,
  t.title,
  m.bracket_name,
  t.location,
  COALESCE(t.start_date, DATE('now')),
  'DOUBLES',
  'SIDEOUT',
  NULL,
  COALESCE((SELECT u.display_name FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = m.team1_id ORDER BY tm.created_at, LOWER(u.display_name) LIMIT 1), m.team1_id),
  (SELECT u.display_name FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = m.team1_id ORDER BY tm.created_at, LOWER(u.display_name) LIMIT 1 OFFSET 1),
  COALESCE((SELECT u.display_name FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = m.team2_id ORDER BY tm.created_at, LOWER(u.display_name) LIMIT 1), m.team2_id),
  (SELECT u.display_name FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = m.team2_id ORDER BY tm.created_at, LOWER(u.display_name) LIMIT 1 OFFSET 1),
  COALESCE((SELECT u.dupr_id FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = m.team1_id ORDER BY tm.created_at, LOWER(u.display_name) LIMIT 1), 'legacy:' || m.team1_id || ':1'),
  COALESCE((SELECT u.dupr_id FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = m.team1_id ORDER BY tm.created_at, LOWER(u.display_name) LIMIT 1 OFFSET 1), 'legacy:' || m.team1_id || ':2'),
  COALESCE((SELECT u.dupr_id FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = m.team2_id ORDER BY tm.created_at, LOWER(u.display_name) LIMIT 1), 'legacy:' || m.team2_id || ':1'),
  COALESCE((SELECT u.dupr_id FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = m.team2_id ORDER BY tm.created_at, LOWER(u.display_name) LIMIT 1 OFFSET 1), 'legacy:' || m.team2_id || ':2'),
  m.g1a, m.g1b, m.g2a, m.g2b, m.g3a, m.g3b,
  NULL, NULL, NULL, NULL,
  'submitted',
  200,
  '{"source":"legacy-backfill","type":"playoff"}',
  NULL
FROM matches m
JOIN tournaments t ON t.id = m.tournament_id;
