ALTER TABLE users ADD COLUMN dupr_premium_l1 INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN dupr_verified_l1 INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN dupr_entitlements_json TEXT;
ALTER TABLE users ADD COLUMN dupr_entitlements_checked_at DATETIME;

ALTER TABLE tournament_settings ADD COLUMN requires_dupr_premium INTEGER DEFAULT 0;
ALTER TABLE tournament_settings ADD COLUMN requires_dupr_verified INTEGER DEFAULT 0;

UPDATE tournament_settings
SET requires_dupr_premium = COALESCE(requires_dupr_premium, 0),
    requires_dupr_verified = COALESCE(requires_dupr_verified, 0)
WHERE requires_dupr_premium IS NULL OR requires_dupr_verified IS NULL;
