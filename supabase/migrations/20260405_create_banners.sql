CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  link_label TEXT DEFAULT 'Ver más',
  badge_text TEXT,
  position TEXT DEFAULT 'hero',
  background_color TEXT DEFAULT '#0A1A44',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_active ON public.banners(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_banners_dates ON public.banners(starts_at, ends_at) WHERE is_active = true;
