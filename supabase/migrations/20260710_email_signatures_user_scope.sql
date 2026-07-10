-- Email signatures — scope to user + RLS + one-default-per-user constraint.
--
-- The original email_signatures table was global: any user could see and
-- overwrite anyone else's signatures (including flipping the is_default flag
-- across the whole system). With more than one active advisor this breaks
-- socially. This migration:
--
--   1. Adds user_id (FK -> auth.users) and backfills existing rows onto
--      the first admin available so no row is orphaned.
--   2. Marks user_id NOT NULL going forward.
--   3. Ensures at most one is_default = true PER user, via a partial
--      unique index (Postgres-standard way to express this).
--   4. Enables RLS with policies that keep every user inside their own
--      row set for select / insert / update / delete.
--
-- Safe to run multiple times: guards with IF NOT EXISTS / IF EXISTS.

BEGIN;

-- 1. user_id column
ALTER TABLE public.email_signatures
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Backfill existing rows onto the earliest confirmed user of the system.
--    In practice this is the founding admin. If email_signatures is empty
--    (fresh install) this is a no-op.
UPDATE public.email_signatures
SET user_id = (
  SELECT id FROM auth.users
  WHERE email_confirmed_at IS NOT NULL
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE user_id IS NULL;

-- 3. Enforce NOT NULL now that every row has an owner.
ALTER TABLE public.email_signatures
  ALTER COLUMN user_id SET NOT NULL;

-- 4. At most one default per user.
CREATE UNIQUE INDEX IF NOT EXISTS email_signatures_one_default_per_user
  ON public.email_signatures (user_id)
  WHERE is_default = true;

-- 5. Helper index for the common "list mine" query.
CREATE INDEX IF NOT EXISTS email_signatures_user_id_idx
  ON public.email_signatures (user_id, created_at DESC);

-- 6. RLS
ALTER TABLE public.email_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_signatures_select_own ON public.email_signatures;
CREATE POLICY email_signatures_select_own
  ON public.email_signatures FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS email_signatures_insert_own ON public.email_signatures;
CREATE POLICY email_signatures_insert_own
  ON public.email_signatures FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS email_signatures_update_own ON public.email_signatures;
CREATE POLICY email_signatures_update_own
  ON public.email_signatures FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS email_signatures_delete_own ON public.email_signatures;
CREATE POLICY email_signatures_delete_own
  ON public.email_signatures FOR DELETE
  USING (user_id = auth.uid());

COMMIT;
