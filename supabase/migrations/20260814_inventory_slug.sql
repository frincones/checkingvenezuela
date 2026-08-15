-- =============================================
-- MIGRATION: columna `slug` real en service_inventory
--
-- Problema que resuelve:
--   Hoy el slug de un paquete se deriva de `name` en runtime
--   (lib/packages/slug.js:generateSlug), así que renombrar un producto
--   —por ejemplo al traducirlo al inglés— cambia su URL EN SILENCIO y
--   rompe todo enlace indexado, compartido por WhatsApp o incrustado en
--   una cotización ya enviada.
--
--   De paso arregla app/sitemap.js, que consulta `service_inventory.slug`
--   y hoy falla entera, dejando TODOS los paquetes fuera del sitemap.
--
-- Seguridad:
--   - Aditivo: sin renames, sin DROP, sin cambios de tipo.
--   - El backfill NO va aquí: se hace desde Node reutilizando el
--     generateSlug real (scripts/english-flip/01-backfill-slugs.mjs).
--     Hacerlo en SQL con unaccent() no garantiza paridad byte a byte con
--     la normalización NFD de JavaScript, y una diferencia de un carácter
--     cambia una URL.
--   - El índice UNIQUE es parcial (WHERE slug IS NOT NULL) para tolerar
--     filas sin slug mientras se propaga el backfill.
--   - Verificado contra producción: 0 colisiones entre los 20 productos
--     actuales, 0 slugs vacíos.
--   - Reversible con: ALTER TABLE service_inventory DROP COLUMN slug;
--
-- Orden de aplicación:
--   1. Este SQL (Dashboard → SQL Editor)
--   2. node scripts/english-flip/01-backfill-slugs.mjs --apply
--   3. Verificar: 0 filas con slug NULL, 0 slugs duplicados
--   4. Recién entonces se puede traducir `name`
-- =============================================

ALTER TABLE public.service_inventory
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_inventory_slug
  ON public.service_inventory(slug) WHERE slug IS NOT NULL;

COMMENT ON COLUMN public.service_inventory.slug IS
  'URL slug estable. Se genera del nombre al crear el producto, pero NO se regenera al renombrarlo: la URL sobrevive a la traducción del nombre. Cambiarlo a mano exige añadir el 301 correspondiente.';
