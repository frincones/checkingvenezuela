-- =============================================
-- MIGRACIÓN: AGREGAR CAMPOS SEO A DESTINOS
-- Venezuela Voyages - Campos meta_title y meta_description
-- =============================================

-- Agregar columnas SEO a destinations
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- Agregar comentarios descriptivos
COMMENT ON COLUMN destinations.meta_title IS 'Título SEO para la página del destino';
COMMENT ON COLUMN destinations.meta_description IS 'Descripción SEO para la página del destino';

-- =============================================
-- FIN DE LA MIGRACIÓN
-- =============================================
