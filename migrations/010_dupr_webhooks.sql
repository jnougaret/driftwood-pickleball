-- DUPR webhook + subscription tracking

CREATE TABLE IF NOT EXISTS dupr_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT,
  topic TEXT,
  event TEXT,
  payload TEXT NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dupr_webhook_events_topic ON dupr_webhook_events(topic);
CREATE INDEX IF NOT EXISTS idx_dupr_webhook_events_event ON dupr_webhook_events(event);
CREATE INDEX IF NOT EXISTS idx_dupr_webhook_events_created_at ON dupr_webhook_events(created_at);

CREATE TABLE IF NOT EXISTS dupr_player_subscriptions (
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

CREATE INDEX IF NOT EXISTS idx_dupr_player_subscriptions_user ON dupr_player_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_dupr_player_subscriptions_dupr_id ON dupr_player_subscriptions(dupr_id);
CREATE INDEX IF NOT EXISTS idx_dupr_player_subscriptions_status ON dupr_player_subscriptions(status);

CREATE TABLE IF NOT EXISTS dupr_webhook_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  topics_json TEXT NOT NULL,
  status_code INTEGER,
  response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dupr_webhook_registrations_created_at ON dupr_webhook_registrations(created_at);

