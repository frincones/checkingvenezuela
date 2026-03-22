-- =============================================
-- MIGRACIÓN: BLOG
-- Venezuela Voyages - Sistema de Blog
-- =============================================

CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL DEFAULT '',
    cover_image TEXT,
    category TEXT DEFAULT 'general',
    tags JSONB DEFAULT '[]',
    author_name TEXT,
    destination_id UUID REFERENCES public.destinations(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    meta_title TEXT,
    meta_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts(category) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_blog_posts_destination ON public.blog_posts(destination_id);
