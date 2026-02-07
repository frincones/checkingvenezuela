-- =============================================
-- MIGRACIÓN: AGREGAR COLUMNAS FALTANTES
-- Venezuela Voyages - Columnas para categorías y proveedores
-- =============================================

-- Agregar columna description a destination_categories
ALTER TABLE destination_categories ADD COLUMN IF NOT EXISTS description TEXT;

-- Agregar columnas code y provider_type a tourism_providers
ALTER TABLE tourism_providers ADD COLUMN IF NOT EXISTS code VARCHAR(20);
ALTER TABLE tourism_providers ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50);

-- Agregar comentarios descriptivos
COMMENT ON COLUMN destination_categories.description IS 'Descripción detallada de la categoría de destino';
COMMENT ON COLUMN tourism_providers.code IS 'Código único del proveedor para identificación interna';
COMMENT ON COLUMN tourism_providers.provider_type IS 'Tipo específico de proveedor (tour_operator, hotel, airline, etc.)';

-- =============================================
-- FIN DE LA MIGRACIÓN
-- =============================================
