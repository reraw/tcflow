-- Migration V7: Add completed_at timestamp to reminder_dismissals
-- ===============================================================
-- Purpose:
--   Support midnight-rollover of completed reminders on the Dashboard.
--   Previously, presence of a reminder_dismissals row meant "dismissed
--   forever." We now treat it as "completed_at <timestamp>" so the UI
--   can keep today's completions visible and roll prior days into the
--   Completed tab.
--
-- Run in Supabase SQL Editor. Safe to re-run.

-- 1. Add column (nullable so the backfill UPDATE can run).
ALTER TABLE reminder_dismissals
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 2. Backfill any existing rows. Prefer created_at if present (accurate
--    historical timestamp), otherwise use NOW() so nothing disappears on
--    users when the rollover logic goes live.
UPDATE reminder_dismissals
SET completed_at = COALESCE(created_at, NOW())
WHERE completed_at IS NULL;

-- 3. Lock the column down: default NOW(), NOT NULL.
ALTER TABLE reminder_dismissals
  ALTER COLUMN completed_at SET DEFAULT NOW();

ALTER TABLE reminder_dismissals
  ALTER COLUMN completed_at SET NOT NULL;

-- 4. Index for the Completed-tab query which sorts by completion time.
CREATE INDEX IF NOT EXISTS idx_reminder_dismissals_completed_at
  ON reminder_dismissals(completed_at DESC);
