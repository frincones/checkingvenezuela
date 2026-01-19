-- =============================================
-- MIGRACIÓN: Actualizar URLs de imágenes de destinos
-- Venezuela Voyages - URLs de Unsplash temporales
-- =============================================

-- Actualizar imágenes de destinos de Venezuela - Playas
UPDATE public.destinations
SET image_url = 'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?q=80&w=1974&auto=format&fit=crop'
WHERE slug = 'los-roques';

UPDATE public.destinations
SET image_url = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop'
WHERE slug = 'isla-margarita';

UPDATE public.destinations
SET image_url = 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?q=80&w=2096&auto=format&fit=crop'
WHERE slug = 'morrocoy';

-- Actualizar imágenes de destinos de Venezuela - Aventura
UPDATE public.destinations
SET image_url = 'https://images.unsplash.com/photo-1558981852-426c6c22a060?q=80&w=2071&auto=format&fit=crop'
WHERE slug = 'canaima';

UPDATE public.destinations
SET image_url = 'https://images.unsplash.com/photo-1624253321171-1be53e12f5f4?q=80&w=1974&auto=format&fit=crop'
WHERE slug = 'roraima';

UPDATE public.destinations
SET image_url = 'https://images.unsplash.com/photo-1564433594009-5dd5ef7f2848?q=80&w=2070&auto=format&fit=crop'
WHERE slug = 'los-llanos';

-- Actualizar imágenes de destinos de Venezuela - Cultura
UPDATE public.destinations
SET image_url = 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=1986&auto=format&fit=crop'
WHERE slug = 'merida';

UPDATE public.destinations
SET image_url = 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2070&auto=format&fit=crop'
WHERE slug = 'colonia-tovar';

-- Actualizar imágenes de destinos de Venezuela - Fenómenos
UPDATE public.destinations
SET image_url = 'https://images.unsplash.com/photo-1461511669078-d46bf351cd6e?q=80&w=2070&auto=format&fit=crop'
WHERE slug = 'catatumbo';

-- =============================================
-- FIN DE LA MIGRACIÓN
-- =============================================
