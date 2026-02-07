-- =============================================
-- MIGRACIÓN: AGREGAR IMAGEN A CATEGORÍAS
-- Venezuela Voyages - Campo image_url para categorías
-- =============================================

-- Agregar columna image_url a destination_categories
ALTER TABLE destination_categories ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Agregar comentario descriptivo
COMMENT ON COLUMN destination_categories.image_url IS 'URL de la imagen de la categoría';

-- =============================================
-- FIN DE LA MIGRACIÓN
-- =============================================
