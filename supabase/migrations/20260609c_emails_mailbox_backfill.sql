-- =============================================
-- MIGRATION: backfill emails.mailbox_id for inbound rows where the
--            recipient address didn't match any mailbox at ingestion time
--            (typos / aliases like msanchez vs m.sanchez).
--
-- Why this exists:
--   The webhook resolves mailbox_id by exact-match on the recipient
--   address against `mailboxes.address`. Resend forwards mail to aliases
--   that aren't strictly seeded in the mailboxes table (the customer's MX
--   accepts msanchez@, sanchez@, etc. — all routed to the same person),
--   so the inbound rows end up with mailbox_id=NULL. When the user filters
--   the inbox by mailbox in the UI, those orphans become invisible.
--
-- This backfill maps known aliases to their canonical mailbox.
--
-- Safety: only UPDATEs rows where mailbox_id IS NULL (no overwrite of
-- legitimate assignments). Idempotent: re-running is a no-op.
-- =============================================

-- Helper: lower-cased local-part lookup against mailboxes, after
-- stripping dots and dashes from the local part (so msanchez ≈ m.sanchez).
-- We embed the mapping rather than installing a function because this
-- runs once and the rule set is tiny.

-- m.sanchez aliases
UPDATE public.emails e
SET mailbox_id = (
  SELECT id FROM public.mailboxes
  WHERE lower(address) = 'm.sanchez@venezuelavoyages.com'
  LIMIT 1
)
WHERE e.direction = 'inbound'
  AND e.mailbox_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(e.to_emails) AS t
    WHERE lower(t->>'email') IN (
      'msanchez@venezuelavoyages.com',
      'sanchez@venezuelavoyages.com',
      'm.sanchez@venezuelavoyages.com'
    )
  );

-- ventas
UPDATE public.emails e
SET mailbox_id = (
  SELECT id FROM public.mailboxes
  WHERE lower(address) = 'ventas@venezuelavoyages.com'
  LIMIT 1
)
WHERE e.direction = 'inbound'
  AND e.mailbox_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(e.to_emails) AS t
    WHERE lower(t->>'email') IN (
      'ventas@venezuelavoyages.com',
      'venta@venezuelavoyages.com',
      'sales@venezuelavoyages.com'
    )
  );

-- info
UPDATE public.emails e
SET mailbox_id = (
  SELECT id FROM public.mailboxes
  WHERE lower(address) = 'info@venezuelavoyages.com'
  LIMIT 1
)
WHERE e.direction = 'inbound'
  AND e.mailbox_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(e.to_emails) AS t
    WHERE lower(t->>'email') IN (
      'info@venezuelavoyages.com',
      'informacion@venezuelavoyages.com',
      'contacto@venezuelavoyages.com'
    )
  );

-- reservas
UPDATE public.emails e
SET mailbox_id = (
  SELECT id FROM public.mailboxes
  WHERE lower(address) = 'reservas@venezuelavoyages.com'
  LIMIT 1
)
WHERE e.direction = 'inbound'
  AND e.mailbox_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(e.to_emails) AS t
    WHERE lower(t->>'email') IN (
      'reservas@venezuelavoyages.com',
      'reserva@venezuelavoyages.com',
      'reservations@venezuelavoyages.com',
      'booking@venezuelavoyages.com'
    )
  );

NOTIFY pgrst, 'reload schema';
