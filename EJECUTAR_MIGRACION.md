# Instrucciones para Ejecutar la Migración en Supabase

## Paso 1: Abrir el SQL Editor de Supabase

1. Ve a: **https://supabase.com/dashboard/project/stbbckupkuxasfthlsys/sql/new**
2. Inicia sesión si es necesario

## Paso 2: Copiar y Ejecutar el SQL

1. Abre el archivo: `supabase/migrations/003_cms_providers_inventory.sql`
2. Copia TODO el contenido del archivo
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en el botón **"Run"** (o presiona Ctrl+Enter)

## Paso 3: Verificar la Migración

Después de ejecutar, deberías ver las siguientes tablas creadas:

- `catalog_services` - Servicios del catálogo (Vuelos, Hoteles, etc.)
- `destination_categories` - Categorías de destinos (Playas, Aventura, etc.)
- `destinations` - Destinos individuales
- `tourism_providers` - Proveedores de turismo
- `provider_contracts` - Contratos con proveedores
- `service_inventory` - Inventario de productos
- `inventory_price_history` - Historial de precios

## Paso 4: Verificar los Datos

Ejecuta estas consultas para verificar que los datos se insertaron:

```sql
-- Verificar servicios
SELECT name, slug, status FROM catalog_services ORDER BY display_order;

-- Verificar categorías
SELECT name, slug, icon FROM destination_categories ORDER BY display_order;

-- Verificar destinos
SELECT name, slug, country FROM destinations ORDER BY display_order;
```

## Notas Importantes

- La migración incluye datos seed con los servicios y destinos actuales de la página
- Las políticas RLS permiten lectura pública y escritura solo para usuarios autenticados
- Si hay errores de "duplicate", significa que los datos ya existen (está bien)

## URL Directa al SQL Editor

https://supabase.com/dashboard/project/stbbckupkuxasfthlsys/sql/new
