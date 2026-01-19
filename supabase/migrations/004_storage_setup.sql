-- =============================================
-- MIGRACIÓN: CONFIGURACIÓN DE STORAGE
-- Venezuela Voyages - Bucket para imágenes del CMS
-- =============================================

-- Crear bucket para imágenes del CMS (público)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'cms-images',
    'cms-images',
    true,
    5242880, -- 5MB límite
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- =============================================
-- POLÍTICAS DE STORAGE
-- =============================================

-- Permitir lectura pública de imágenes
DROP POLICY IF EXISTS "Public read cms-images" ON storage.objects;
CREATE POLICY "Public read cms-images" ON storage.objects
    FOR SELECT USING (bucket_id = 'cms-images');

-- Permitir subida de imágenes a usuarios autenticados
DROP POLICY IF EXISTS "Authenticated users can upload cms-images" ON storage.objects;
CREATE POLICY "Authenticated users can upload cms-images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'cms-images'
        AND auth.role() = 'authenticated'
    );

-- Permitir actualización de imágenes a usuarios autenticados
DROP POLICY IF EXISTS "Authenticated users can update cms-images" ON storage.objects;
CREATE POLICY "Authenticated users can update cms-images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'cms-images'
        AND auth.role() = 'authenticated'
    );

-- Permitir eliminación de imágenes a usuarios autenticados
DROP POLICY IF EXISTS "Authenticated users can delete cms-images" ON storage.objects;
CREATE POLICY "Authenticated users can delete cms-images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'cms-images'
        AND auth.role() = 'authenticated'
    );

-- =============================================
-- FIN DE LA MIGRACIÓN
-- =============================================
