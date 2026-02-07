-- Backfill legacy Jan 10 and Jan 24 submitted matches into dupr_submitted_matches.
-- Safe to rerun: INSERT OR IGNORE uses UNIQUE(identifier, dupr_env).

WITH submitter AS (
  SELECT id AS submitted_by
  FROM users
  WHERE is_admin = 1
  ORDER BY id
  LIMIT 1
),
team_slots AS (
  SELECT
    ranked.team_id,
    MAX(CASE WHEN ranked.rn = 1 THEN ranked.display_name END) AS p1_name,
    MAX(CASE WHEN ranked.rn = 2 THEN ranked.display_name END) AS p2_name,
    MAX(CASE WHEN ranked.rn = 1 THEN ranked.dupr_id END) AS p1_dupr,
    MAX(CASE WHEN ranked.rn = 2 THEN ranked.dupr_id END) AS p2_dupr
  FROM (
    SELECT
      tm.team_id,
      u.display_name,
      u.dupr_id,
      ROW_NUMBER() OVER (
        PARTITION BY tm.team_id
        ORDER BY tm.created_at ASC, LOWER(u.display_name) ASC
      ) AS rn
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
  ) ranked
  GROUP BY ranked.team_id
),
rr_rows AS (
  SELECT
    m.id AS identifier,
    m.tournament_id,
    t.title AS event_name,
    t.location,
    COALESCE(t.start_date, DATE('now')) AS match_date,
    m.round_number,
    COALESCE(ts1.p1_name, m.team1_id, 'Team A') AS team_a_player1,
    ts1.p2_name AS team_a_player2,
    COALESCE(ts2.p1_name, m.team2_id, 'Team B') AS team_b_player1,
    ts2.p2_name AS team_b_player2,
    COALESCE(ts1.p1_dupr, 'legacy:' || m.team1_id || ':1') AS team_a_player1_dupr,
    COALESCE(ts1.p2_dupr, 'legacy:' || m.team1_id || ':2') AS team_a_player2_dupr,
    COALESCE(ts2.p1_dupr, 'legacy:' || m.team2_id || ':1') AS team_b_player1_dupr,
    COALESCE(ts2.p2_dupr, 'legacy:' || m.team2_id || ':2') AS team_b_player2_dupr,
    s.score1 AS game1_a,
    s.score2 AS game1_b
  FROM round_robin_matches m
  JOIN round_robin_scores s ON s.match_id = m.id
  JOIN tournaments t ON t.id = m.tournament_id
  LEFT JOIN team_slots ts1 ON ts1.team_id = m.team1_id
  LEFT JOIN team_slots ts2 ON ts2.team_id = m.team2_id
  WHERE m.tournament_id = 'tournament-1770084914102'
    AND s.score1 IS NOT NULL
    AND s.score2 IS NOT NULL
),
playoff_state_target AS (
  SELECT
    ps.tournament_id,
    t.title AS event_name,
    t.location,
    COALESCE(t.start_date, DATE('now')) AS match_date,
    ps.seed_order
  FROM playoff_state ps
  JOIN tournaments t ON t.id = ps.tournament_id
  WHERE ps.tournament_id IN ('jan10', 'tournament-1770084914102')
),
seeded AS (
  SELECT
    pst.tournament_id,
    pst.event_name,
    pst.location,
    pst.match_date,
    CAST(je.key AS INTEGER) + 1 AS seed_pos,
    je.value AS team_id
  FROM playoff_state_target pst,
       json_each(pst.seed_order) je
),
qf AS (
  SELECT
    a.tournament_id,
    a.event_name,
    a.location,
    a.match_date,
    a.match_number,
    a.team1_id,
    a.team2_id,
    ps.game1_score1,
    ps.game1_score2,
    ps.game2_score1,
    ps.game2_score2,
    ps.game3_score1,
    ps.game3_score2,
    CASE
      WHEN ps.game1_score1 > ps.game1_score2 THEN a.team1_id
      WHEN ps.game1_score2 > ps.game1_score1 THEN a.team2_id
      ELSE NULL
    END AS winner_id,
    CASE
      WHEN ps.game1_score1 > ps.game1_score2 THEN a.team2_id
      WHEN ps.game1_score2 > ps.game1_score1 THEN a.team1_id
      ELSE NULL
    END AS loser_id
  FROM (
    SELECT s1.tournament_id, s1.event_name, s1.location, s1.match_date, 1 AS match_number, s1.team_id AS team1_id, s8.team_id AS team2_id
    FROM seeded s1 JOIN seeded s8 ON s8.tournament_id = s1.tournament_id
    WHERE s1.seed_pos = 1 AND s8.seed_pos = 8
    UNION ALL
    SELECT s4.tournament_id, s4.event_name, s4.location, s4.match_date, 2 AS match_number, s4.team_id AS team1_id, s5.team_id AS team2_id
    FROM seeded s4 JOIN seeded s5 ON s5.tournament_id = s4.tournament_id
    WHERE s4.seed_pos = 4 AND s5.seed_pos = 5
    UNION ALL
    SELECT s2.tournament_id, s2.event_name, s2.location, s2.match_date, 3 AS match_number, s2.team_id AS team1_id, s7.team_id AS team2_id
    FROM seeded s2 JOIN seeded s7 ON s7.tournament_id = s2.tournament_id
    WHERE s2.seed_pos = 2 AND s7.seed_pos = 7
    UNION ALL
    SELECT s3.tournament_id, s3.event_name, s3.location, s3.match_date, 4 AS match_number, s3.team_id AS team1_id, s6.team_id AS team2_id
    FROM seeded s3 JOIN seeded s6 ON s6.tournament_id = s3.tournament_id
    WHERE s3.seed_pos = 3 AND s6.seed_pos = 6
  ) a
  JOIN playoff_scores ps
    ON ps.tournament_id = a.tournament_id
   AND ps.round_number = 1
   AND ps.match_number = a.match_number
),
sf AS (
  SELECT
    top.tournament_id,
    top.event_name,
    top.location,
    top.match_date,
    1 AS match_number,
    top.winner_id AS team1_id,
    bot.winner_id AS team2_id,
    ps.game1_score1,
    ps.game1_score2,
    ps.game2_score1,
    ps.game2_score2,
    ps.game3_score1,
    ps.game3_score2,
    CASE
      WHEN ps.game1_score1 > ps.game1_score2 THEN top.winner_id
      WHEN ps.game1_score2 > ps.game1_score1 THEN bot.winner_id
      ELSE NULL
    END AS winner_id,
    CASE
      WHEN ps.game1_score1 > ps.game1_score2 THEN bot.winner_id
      WHEN ps.game1_score2 > ps.game1_score1 THEN top.winner_id
      ELSE NULL
    END AS loser_id
  FROM qf top
  JOIN qf bot ON bot.tournament_id = top.tournament_id
  JOIN playoff_scores ps
    ON ps.tournament_id = top.tournament_id
   AND ps.round_number = 2
   AND ps.match_number = 1
  WHERE top.match_number = 1 AND bot.match_number = 2
  UNION ALL
  SELECT
    top.tournament_id,
    top.event_name,
    top.location,
    top.match_date,
    2 AS match_number,
    top.winner_id AS team1_id,
    bot.winner_id AS team2_id,
    ps.game1_score1,
    ps.game1_score2,
    ps.game2_score1,
    ps.game2_score2,
    ps.game3_score1,
    ps.game3_score2,
    CASE
      WHEN ps.game1_score1 > ps.game1_score2 THEN top.winner_id
      WHEN ps.game1_score2 > ps.game1_score1 THEN bot.winner_id
      ELSE NULL
    END AS winner_id,
    CASE
      WHEN ps.game1_score1 > ps.game1_score2 THEN bot.winner_id
      WHEN ps.game1_score2 > ps.game1_score1 THEN top.winner_id
      ELSE NULL
    END AS loser_id
  FROM qf top
  JOIN qf bot ON bot.tournament_id = top.tournament_id
  JOIN playoff_scores ps
    ON ps.tournament_id = top.tournament_id
   AND ps.round_number = 2
   AND ps.match_number = 2
  WHERE top.match_number = 3 AND bot.match_number = 4
),
finals AS (
  SELECT
    a.tournament_id,
    a.event_name,
    a.location,
    a.match_date,
    1 AS match_number,
    a.winner_id AS team1_id,
    b.winner_id AS team2_id,
    ps.game1_score1,
    ps.game1_score2,
    ps.game2_score1,
    ps.game2_score2,
    ps.game3_score1,
    ps.game3_score2
  FROM sf a
  JOIN sf b ON b.tournament_id = a.tournament_id
  JOIN playoff_scores ps
    ON ps.tournament_id = a.tournament_id
   AND ps.round_number = 3
   AND ps.match_number = 1
  WHERE a.match_number = 1 AND b.match_number = 2
),
bronze AS (
  SELECT
    a.tournament_id,
    a.event_name,
    a.location,
    a.match_date,
    2 AS match_number,
    a.loser_id AS team1_id,
    b.loser_id AS team2_id,
    ps.game1_score1,
    ps.game1_score2,
    ps.game2_score1,
    ps.game2_score2,
    ps.game3_score1,
    ps.game3_score2
  FROM sf a
  JOIN sf b ON b.tournament_id = a.tournament_id
  JOIN playoff_scores ps
    ON ps.tournament_id = a.tournament_id
   AND ps.round_number = 3
   AND ps.match_number = 2
  WHERE a.match_number = 1 AND b.match_number = 2
),
playoff_rows AS (
  SELECT tournament_id, event_name, location, match_date, 1 AS round_number, match_number, team1_id, team2_id, game1_score1, game1_score2, game2_score1, game2_score2, game3_score1, game3_score2 FROM qf
  UNION ALL
  SELECT tournament_id, event_name, location, match_date, 2 AS round_number, match_number, team1_id, team2_id, game1_score1, game1_score2, game2_score1, game2_score2, game3_score1, game3_score2 FROM sf
  UNION ALL
  SELECT tournament_id, event_name, location, match_date, 3 AS round_number, match_number, team1_id, team2_id, game1_score1, game1_score2, game2_score1, game2_score2, game3_score1, game3_score2 FROM finals
  UNION ALL
  SELECT tournament_id, event_name, location, match_date, 3 AS round_number, match_number, team1_id, team2_id, game1_score1, game1_score2, game2_score1, game2_score2, game3_score1, game3_score2 FROM bronze
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
  rr.tournament_id,
  NULL,
  (SELECT submitted_by FROM submitter),
  'uat',
  NULL,
  NULL,
  'legacy:rr:' || rr.identifier,
  rr.event_name,
  'Round Robin',
  rr.location,
  rr.match_date,
  'DOUBLES',
  'SIDEOUT',
  NULL,
  rr.team_a_player1,
  rr.team_a_player2,
  rr.team_b_player1,
  rr.team_b_player2,
  rr.team_a_player1_dupr,
  rr.team_a_player2_dupr,
  rr.team_b_player1_dupr,
  rr.team_b_player2_dupr,
  rr.game1_a,
  rr.game1_b,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'submitted',
  200,
  '{"source":"legacy-backfill","type":"round_robin"}',
  NULL
FROM rr_rows rr
UNION ALL
SELECT
  pr.tournament_id,
  NULL,
  (SELECT submitted_by FROM submitter),
  'uat',
  NULL,
  NULL,
  'legacy:playoff:' || pr.tournament_id || ':' || pr.round_number || ':' || pr.match_number,
  pr.event_name,
  CASE
    WHEN pr.round_number = 1 THEN 'Quarter-finals'
    WHEN pr.round_number = 2 THEN 'Semi-finals'
    WHEN pr.round_number = 3 AND pr.match_number = 1 THEN 'Gold Match'
    WHEN pr.round_number = 3 AND pr.match_number = 2 THEN 'Bronze Match'
    ELSE 'Playoff'
  END,
  pr.location,
  pr.match_date,
  'DOUBLES',
  'SIDEOUT',
  NULL,
  COALESCE(ts1.p1_name, pr.team1_id, 'Team A'),
  ts1.p2_name,
  COALESCE(ts2.p1_name, pr.team2_id, 'Team B'),
  ts2.p2_name,
  COALESCE(ts1.p1_dupr, 'legacy:' || pr.team1_id || ':1'),
  COALESCE(ts1.p2_dupr, 'legacy:' || pr.team1_id || ':2'),
  COALESCE(ts2.p1_dupr, 'legacy:' || pr.team2_id || ':1'),
  COALESCE(ts2.p2_dupr, 'legacy:' || pr.team2_id || ':2'),
  pr.game1_score1,
  pr.game1_score2,
  pr.game2_score1,
  pr.game2_score2,
  pr.game3_score1,
  pr.game3_score2,
  NULL,
  NULL,
  NULL,
  NULL,
  'submitted',
  200,
  '{"source":"legacy-backfill","type":"playoff"}',
  NULL
FROM playoff_rows pr
LEFT JOIN team_slots ts1 ON ts1.team_id = pr.team1_id
LEFT JOIN team_slots ts2 ON ts2.team_id = pr.team2_id
WHERE pr.game1_score1 IS NOT NULL
  AND pr.game1_score2 IS NOT NULL
  AND pr.team1_id IS NOT NULL
  AND pr.team2_id IS NOT NULL;
