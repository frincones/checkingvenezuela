-- =============================================
-- MIGRATION: add `language` column to destinations
--
-- Goal (Option A from analysis): allow admins to create destinations whose
-- content is written entirely in English (e.g. "Canaima National Park"),
-- coexisting with the Spanish ones already seeded ("Parque Nacional
-- Canaima"). Each destination is an independent row — NOT a translation
-- of another. The `language` column is a classification flag, used to
-- filter / tag in the admin and (optionally, later) on the public site.
--
-- Safety:
--   - Additive only. No column rename, no DROP, no type change.
--   - DEFAULT 'es' + NOT NULL: the 6 (and any other) pre-existing rows get
--     labeled 'es' automatically without a backfill query.
--   - CHECK constraint locks the value to ('es','en') so the API doesn't
--     need a separate enum type (lighter, easier to extend later).
--   - IF NOT EXISTS makes the script idempotent.
--   - No RLS / trigger / FK changes are needed (none of them reference
--     this column).
--   - Reversible with: ALTER TABLE destinations DROP COLUMN language;
-- =============================================

ALTER TABLE public.destinations
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'es'
  CHECK (language IN ('es', 'en'));

CREATE INDEX IF NOT EXISTS idx_destinations_language
  ON public.destinations(language);

COMMENT ON COLUMN public.destinations.language IS
  'Language of the destination content (es|en). Used for admin classification and optional public-site filtering. Each destination is independent — this is NOT a translation pointer.';
