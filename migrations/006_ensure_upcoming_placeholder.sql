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
  display_order
)
SELECT
  'tournament-' || strftime('%s', 'now'),
  'Saturday Moneyball',
  '2:00 PM - Date TBD',
  NULL,
  '14:00',
  'America/New_York',
  'The Picklr Westbrook',
  'Coed Doubles',
  'coed_doubles',
  'TBD and below',
  NULL,
  '$15 per player',
  15,
  '50% - 30% - 20%',
  'blue',
  'upcoming',
  999
WHERE NOT EXISTS (
  SELECT 1
  FROM tournaments
  WHERE status IN ('upcoming', 'live')
);
