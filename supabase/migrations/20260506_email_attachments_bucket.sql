-- =============================================
-- MIGRATION: Storage bucket + idempotency for email attachments
-- Fixes the bug where attachments in inbound emails are unreadable
-- (Resend's cdn.resend.app URLs require auth, browsers can't send it).
--
-- The bucket is PRIVATE — different from 'documents' which is public —
-- because email attachments may contain private/commercial information.
-- Reads happen ONLY via signed URLs generated server-side after auth check.
-- =============================================

-- 1. Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-attachments',
  'email-attachments',
  false,             -- private; signed URLs only
  41943040,          -- 40 MB total (matches Resend per-email cap)
  ARRAY[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    'application/zip', 'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/html',
    'application/json',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 41943040,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage policies — service-role only (writes from webhook + reads via signed URL).
--    No public read, no authenticated read: the API layer issues signed URLs after
--    enforcing its own auth check. This is intentional defense-in-depth.

DROP POLICY IF EXISTS "service_role_email_attachments_select" ON storage.objects;
CREATE POLICY "service_role_email_attachments_select" ON storage.objects
  FOR SELECT TO service_role
  USING (bucket_id = 'email-attachments');

DROP POLICY IF EXISTS "service_role_email_attachments_insert" ON storage.objects;
CREATE POLICY "service_role_email_attachments_insert" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'email-attachments');

DROP POLICY IF EXISTS "service_role_email_attachments_update" ON storage.objects;
CREATE POLICY "service_role_email_attachments_update" ON storage.objects
  FOR UPDATE TO service_role
  USING (bucket_id = 'email-attachments')
  WITH CHECK (bucket_id = 'email-attachments');

DROP POLICY IF EXISTS "service_role_email_attachments_delete" ON storage.objects;
CREATE POLICY "service_role_email_attachments_delete" ON storage.objects
  FOR DELETE TO service_role
  USING (bucket_id = 'email-attachments');

-- 3. Idempotency: prevent duplicated rows if Resend retries the webhook for
--    the same email.received event. Partial UNIQUE so historical NULLs are kept.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_emails_resend_id
  ON emails(resend_id) WHERE resend_id IS NOT NULL;

-- =============================================
-- NOTE on the JSONB shape of emails.attachments:
--   New rows (post-this-migration) store:
--     { filename, size, content_type, storage_path, ingest_error? }
--   Pre-existing rows keep their original:
--     { filename, size, content_type, url }
--   The UI handles both — see components/dashboard/email/EmailView.jsx
-- =============================================
