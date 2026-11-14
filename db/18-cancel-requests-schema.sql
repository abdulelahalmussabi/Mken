ALTER TABLE mken_appointments ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ;
-- RLS is already enabled on mken_appointments, and updates are restricted to the owner/admin.
-- Webhook uses service role key which bypasses RLS safely.
