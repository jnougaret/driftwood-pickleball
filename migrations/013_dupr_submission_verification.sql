-- Add verification tracking fields for DUPR match submission reconciliation

ALTER TABLE dupr_submitted_matches ADD COLUMN verification_status TEXT;
ALTER TABLE dupr_submitted_matches ADD COLUMN verification_response TEXT;
ALTER TABLE dupr_submitted_matches ADD COLUMN verified_at DATETIME;
