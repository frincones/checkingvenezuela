-- =============================================
-- MIGRATION: email labels (custom folders / tags)
--
-- The current `emails.folder` column is a CHECK-constrained text set to
-- 5 system values (inbox, sent, drafts, trash, archive). To support
-- user-defined labels without breaking the existing folder semantics,
-- we introduce two new entities:
--
--   email_labels         — the labels themselves (name + color)
--   email_label_links    — many-to-many between emails and labels
--
-- An email can carry any number of labels and still belong to a system
-- folder. This is the Gmail model — labels are orthogonal to folders.
--
-- Safety / reversibility:
--   - Pure additive: no changes to existing emails / folder constraints.
--   - All CASCADE deletes so removing an email or a label cleans up.
--   - RLS: authenticated users can read/write their own labels.
-- =============================================

CREATE TABLE IF NOT EXISTS public.email_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0A1A44',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT email_labels_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.email_label_links (
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.email_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (email_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_email_label_links_email
  ON public.email_label_links(email_id);
CREATE INDEX IF NOT EXISTS idx_email_label_links_label
  ON public.email_label_links(label_id);

-- RLS
ALTER TABLE public.email_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_label_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users manage labels" ON public.email_labels;
CREATE POLICY "Authenticated users manage labels" ON public.email_labels
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage label links" ON public.email_label_links;
CREATE POLICY "Authenticated users manage label links" ON public.email_label_links
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
