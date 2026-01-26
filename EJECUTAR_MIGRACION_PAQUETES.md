# 🚀 Guía de Ejecución - Migración de Paquetes

## Paso 1: Ejecutar la Migración SQL

Ejecuta el siguiente comando en la raíz del proyecto:

```bash
npm run migrate:packages
```

O ejecuta manualmente el archivo SQL en Supabase:

1. Ve a tu Dashboard de Supabase
2. Navega a **SQL Editor**
3. Abre el archivo `supabase/migrations/004_insert_wakutours_package.sql`
4. Copia y pega todo el contenido
5. Click en **Run**

## Paso 2: Verificar que los Datos se Insertaron

Ejecuta esta consulta en SQL Editor para verificar:

```sql
-- Ver proveedor Wakutours
SELECT * FROM tourism_providers WHERE slug = 'wakutours';

-- Ver paquete El Botuto
SELECT * FROM service_inventory WHERE sku = 'PKG-LR-BOTUTO-2D1N';
```

## Paso 3: Probar el Módulo de Paquetes

1. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Navega a: `http://localhost:3000/packages`

3. Deberías ver el paquete "Posada El Botuto - Los Roques 2D/1N" como paquete destacado

## Paso 4: Actualizar la Navegación (Opcional)

Si quieres agregar un enlace a Paquetes en el menú de navegación, edita el archivo de rutas o el componente de navegación.

## URLs Disponibles

- **Lista de paquetes**: `/packages`
- **Detalle del paquete**: `/packages/posada-el-botuto-los-roques-2d-1n`
- **Reservar paquete**: `/packages/posada-el-botuto-los-roques-2d-1n/book`
- **API de paquetes**: `/api/packages`
- **API paquete específico**: `/api/packages/posada-el-botuto-los-roques-2d-1n`

## Datos Insertados

### Proveedor: Wakutours
- **Nombre**: Wakutours
- **Tipo**: Tour Operator
- **Website**: https://wakutours.com
- **Servicios**: Paquetes turísticos, Tours, Hospedaje, Excursiones
- **Destinos**: Los Roques, Margarita, Morrocoy
- **Rating**: 4.8/5

### Paquete: Posada El Botuto - Los Roques 2D/1N
- **SKU**: PKG-LR-BOTUTO-2D1N
- **Precio**: $633.00 USD por persona
- **Duración**: 2 días / 1 noche
- **Destino**: Archipiélago Los Roques
- **Estado**: Disponible
- **Destacado**: Sí

## Estructura de Archivos Creados

```
app/(pages)/packages/
├── page.js                       # Página principal de paquetes
├── [slug]/
│   ├── page.js                   # Detalle del paquete
│   └── book/
│       └── page.js               # Página de reserva

app/api/packages/
├── route.js                      # API GET /api/packages
└── [slug]/
    └── route.js                  # API GET /api/packages/:slug

components/pages/packages/
├── sections/
│   ├── PackagesHeader.jsx        # Header con banner
│   ├── FeaturedPackages.jsx      # Paquetes destacados
│   ├── PackagesList.jsx          # Lista de todos los paquetes
│   ├── PackageItinerary.jsx      # Mostrar itinerario
│   ├── PackageIncludes.jsx       # Qué incluye/no incluye
│   ├── PackageBookingForm.jsx    # Formulario de reserva
│   ├── PackageBookingSummary.jsx # Resumen de reserva
│   └── PackageDetailsTab.jsx     # Tabs de detalles
└── components/
    └── PackageCard.jsx           # Tarjeta de paquete

supabase/migrations/
└── 004_insert_wakutours_package.sql  # Script de inserción
```

## Próximos Pasos Recomendados

1. **Agregar más paquetes**: Usa el dashboard de inventario en `/dashboard/inventory/new`
2. **Configurar sistema de cotizaciones**: Integrar el formulario de reserva con el sistema de leads
3. **Agregar imágenes reales**: Reemplazar las imágenes de placeholder con fotos reales de Los Roques
4. **SEO**: Configurar metadatos para cada paquete
5. **Sistema de reservas**: Implementar flujo de pago completo

## Troubleshooting

### Error: "Tabla no encontrada"
- Asegúrate de haber ejecutado la migración `003_cms_providers_inventory.sql` primero

### El paquete no aparece en la página
- Verifica que `is_published = true` y `status = 'available'`
- Revisa los logs de la consola del navegador
- Verifica que el proveedor Wakutours exista

### Error en las imágenes
- Las imágenes actuales son de Unsplash (placeholder)
- Puedes reemplazarlas con URLs reales de Los Roques

## Soporte

Si encuentras algún problema, revisa:
1. Los logs del servidor (`npm run dev`)
2. La consola del navegador
3. Los logs de Supabase en el Dashboard
