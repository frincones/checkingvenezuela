-- =============================================
-- MIGRATION: ensure UNIQUE INDEX on emails.resend_id
--
-- This index was originally bundled inside
--   supabase/migrations/20260506_email_attachments_bucket.sql
-- (part of PR #49). In production it was found that the bucket portion
-- of that migration was applied but this index was NOT — so the webhook
-- and the sync script that rely on it for idempotency (upsert + onConflict
-- 'resend_id', ignoreDuplicates) fail with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--   specification"
--
-- Re-shipping it as its own migration file (idempotent) so any environment
-- that missed it can catch up cleanly.
--
-- Safety:
--   - IF NOT EXISTS  → no-op if already there
--   - WHERE resend_id IS NOT NULL  → partial index keeps historical NULL
--     rows untouched and lets Postgres apply the uniqueness only where it
--     matters. Multiple legacy NULLs (if any) are still allowed.
--   - No data backfill needed. No RLS / trigger changes. Zero-downtime.
--
-- Reversible:
--   DROP INDEX IF EXISTS public.uniq_emails_resend_id;
-- =============================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_emails_resend_id
  ON public.emails(resend_id) WHERE resend_id IS NOT NULL;
