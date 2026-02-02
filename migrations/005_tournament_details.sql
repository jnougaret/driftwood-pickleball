ALTER TABLE tournaments ADD COLUMN start_date TEXT;
ALTER TABLE tournaments ADD COLUMN start_time_et TEXT;
ALTER TABLE tournaments ADD COLUMN timezone TEXT DEFAULT 'America/New_York';
ALTER TABLE tournaments ADD COLUMN format_type TEXT;
ALTER TABLE tournaments ADD COLUMN skill_level_cap REAL;
ALTER TABLE tournaments ADD COLUMN entry_fee_amount REAL;
ALTER TABLE tournaments ADD COLUMN csv_url TEXT;
ALTER TABLE tournaments ADD COLUMN photo_url TEXT;
ALTER TABLE tournaments ADD COLUMN display_order INTEGER DEFAULT 0;

UPDATE tournaments
SET timezone = COALESCE(timezone, 'America/New_York');

INSERT INTO tournaments (
  id,
  title,
  start_time,
  start_date,
  start_time_et,
  timezone,
  location,
  format,
  format_type,
  skill_level,
  skill_level_cap,
  entry_fee,
  entry_fee_amount,
  prize_split,
  theme,
  status,
  display_order,
  live_start,
  live_end
)
VALUES
  (
    'feb28-tournament',
    'Saturday Moneyball',
    '2:00 PM - Date TBD',
    NULL,
    '14:00',
    'America/New_York',
    'The Picklr Westbrook',
    'Coed Doubles',
    'coed_doubles',
    'DUPR 9.25 and below',
    9.25,
    '$15 per player',
    15,
    '50% - 30% - 20%',
    'blue',
    'upcoming',
    10,
    '2026-02-07T14:00:00.000Z',
    '2026-02-07T18:00:00.000Z'
  ),
  (
    'jan24',
    'Saturday January 24 Moneyball',
    NULL,
    '2026-01-24',
    '14:00',
    'America/New_York',
    'The Picklr Westbrook',
    'Coed Doubles',
    'coed_doubles',
    'DUPR 9.25 and below',
    9.25,
    '$15 per player',
    15,
    '50% - 30% - 20%',
    'gold',
    'completed',
    20,
    NULL,
    NULL
  ),
  (
    'jan10',
    'Saturday January 10 Moneyball',
    NULL,
    '2026-01-10',
    '14:00',
    'America/New_York',
    'The Picklr Westbrook',
    'Coed Doubles',
    'coed_doubles',
    'DUPR 9.50 and below',
    9.5,
    '$15 per player',
    15,
    '50% - 30% - 20%',
    'blue',
    'completed',
    30,
    NULL,
    NULL
  )
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  start_date = COALESCE(tournaments.start_date, excluded.start_date),
  start_time_et = COALESCE(tournaments.start_time_et, excluded.start_time_et),
  timezone = COALESCE(tournaments.timezone, excluded.timezone),
  location = COALESCE(tournaments.location, excluded.location),
  format = COALESCE(tournaments.format, excluded.format),
  format_type = COALESCE(tournaments.format_type, excluded.format_type),
  skill_level = COALESCE(tournaments.skill_level, excluded.skill_level),
  skill_level_cap = COALESCE(tournaments.skill_level_cap, excluded.skill_level_cap),
  entry_fee = COALESCE(tournaments.entry_fee, excluded.entry_fee),
  entry_fee_amount = COALESCE(tournaments.entry_fee_amount, excluded.entry_fee_amount),
  prize_split = COALESCE(tournaments.prize_split, excluded.prize_split),
  theme = COALESCE(tournaments.theme, excluded.theme),
  status = COALESCE(tournaments.status, excluded.status),
  display_order = COALESCE(tournaments.display_order, excluded.display_order),
  live_start = COALESCE(tournaments.live_start, excluded.live_start),
  live_end = COALESCE(tournaments.live_end, excluded.live_end);

UPDATE tournaments
SET csv_url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRS9t1AEOSPAWfObfkh4vn77k1eEgMXQFAY7HNTfmSAwYwe2pQiXUpRQshRWGBf4pettKOkn1F-2bFY/pub?gid=1866706696&single=true&output=csv',
    photo_url = 'photos/winners-jan24.jpg'
WHERE id = 'jan24' AND (csv_url IS NULL OR csv_url = '');

UPDATE tournaments
SET csv_url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRS9t1AEOSPAWfObfkh4vn77k1eEgMXQFAY7HNTfmSAwYwe2pQiXUpRQshRWGBf4pettKOkn1F-2bFY/pub?gid=0&single=true&output=csv',
    photo_url = 'photos/winners-jan10.jpeg'
WHERE id = 'jan10' AND (csv_url IS NULL OR csv_url = '');
