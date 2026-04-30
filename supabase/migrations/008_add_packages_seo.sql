-- =============================================
-- MIGRACIÓN: AGREGAR CAMPOS SEO A PAQUETES
-- Venezuela Voyages - Campos meta_title y meta_description en service_inventory
-- Homologa el patrón aplicado a destinations en 006_add_destinations_seo.sql
-- =============================================

-- Agregar columnas SEO a service_inventory
ALTER TABLE service_inventory ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE service_inventory ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- Agregar comentarios descriptivos
COMMENT ON COLUMN service_inventory.meta_title IS 'Título SEO para la página del producto (ej. paquete turístico)';
COMMENT ON COLUMN service_inventory.meta_description IS 'Descripción SEO para la página del producto (ej. paquete turístico)';

-- =============================================
-- FIN DE LA MIGRACIÓN
-- =============================================
