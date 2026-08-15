# Cómo se ve el cambio — diffs concretos

**Documento compañero de** [`plan-migracion-ingles.md`](./plan-migracion-ingles.md) y
[`plan-migracion-ingles-regresion.md`](./plan-migracion-ingles-regresion.md)

Todos los diffs están escritos contra el contenido **actual** de cada archivo. No son
pseudocódigo: son el cambio literal.

---

## Commit A — Slug estable de paquetes *(6 archivos, atómico)*

Este commit no traduce nada. Solo desacopla la URL del nombre, para que traducir
después no rompa enlaces. **Es un cambio seguro que se puede desplegar hoy mismo**,
antes de decidir nada sobre idiomas.

### A.1 — Migración SQL

`supabase/migrations/20260814_inventory_slug.sql` *(nuevo)*

```sql
-- =============================================
-- MIGRATION: columna `slug` real en service_inventory
--
-- Hoy el slug se deriva de `name` en runtime (lib/packages/slug.js), lo que
-- significa que renombrar un producto cambia su URL en silencio. Esta columna
-- congela la URL y la hace independiente del nombre.
--
-- Seguridad:
--   - Aditivo. Sin renames, sin DROP, sin cambios de tipo.
--   - El backfill reproduce EXACTAMENTE generateSlug() → las URLs actuales no cambian.
--   - Índice UNIQUE parcial (WHERE slug IS NOT NULL) para tolerar filas sin slug.
--   - Verificado contra producción: 0 colisiones entre los 20 productos actuales.
--   - Reversible con: ALTER TABLE service_inventory DROP COLUMN slug;
-- =============================================

ALTER TABLE public.service_inventory
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Réplica en SQL de lib/packages/slug.js:generateSlug
--   lower → sin diacríticos → " - "→"-" → espacios→"-" → "/"→"-"
--   → limpiar no [a-z0-9-] → colapsar "-" → recortar extremos
UPDATE public.service_inventory
SET slug = trim(both '-' from
             regexp_replace(
               regexp_replace(
                 regexp_replace(
                   regexp_replace(
                     regexp_replace(
                       lower(unaccent(name)),
                     '\s+-\s+', '-', 'g'),
                   '\s+', '-', 'g'),
                 '/+', '-', 'g'),
               '[^a-z0-9-]', '', 'g'),
             '-+', '-', 'g'))
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_inventory_slug
  ON public.service_inventory(slug) WHERE slug IS NOT NULL;

COMMENT ON COLUMN public.service_inventory.slug IS
  'URL slug estable. Se genera del nombre al crear, pero NO se regenera al renombrar: la URL sobrevive a la traducción del nombre.';
```

> ⚠️ `unaccent` requiere `CREATE EXTENSION IF NOT EXISTS unaccent;`. Si no se quiere
> añadir la extensión, hacer el backfill desde Node reutilizando el `generateSlug` real
> (más seguro: garantiza paridad byte a byte con el algoritmo de producción).
>
> **Verificación obligatoria del backfill** — antes de crear el índice:
> ```sql
> SELECT count(*) FROM service_inventory WHERE slug IS NULL;              -- → 0
> SELECT slug, count(*) FROM service_inventory GROUP BY slug HAVING count(*) > 1;  -- → vacío
> ```

### A.2 — `lib/packages/slug.js`

```diff
 export async function findPackageBySlug(slug, options = {}) {
   if (!slug) return null;

   const select = options.select || `...`;

   const adminClient = createAdminClient();

-  const { data, error } = await adminClient
-    .from("service_inventory")
-    .select(select)
-    .eq("product_type", "package")
-    .eq("is_published", true);
-
-  if (error) {
-    console.error("findPackageBySlug error:", error);
-    return null;
-  }
-
-  return (data || []).find((pkg) => generateSlug(pkg.name) === slug) || null;
+  // Camino rápido: resolver por la columna `slug` (una fila, índice único).
+  const { data: bySlug, error } = await adminClient
+    .from("service_inventory")
+    .select(select)
+    .eq("product_type", "package")
+    .eq("is_published", true)
+    .eq("slug", slug)
+    .maybeSingle();
+
+  if (error) {
+    console.error("findPackageBySlug error:", error);
+    return null;
+  }
+  if (bySlug) return bySlug;
+
+  // Fallback transitorio: match por nombre, como antes. Cubre (a) filas cuyo
+  // backfill aún no se ha propagado y (b) URLs viejas de paquetes ya renombrados.
+  // Retirar cuando `slug IS NULL` sea 0 en producción y los 301 estén activos.
+  const { data: all } = await adminClient
+    .from("service_inventory")
+    .select(select)
+    .eq("product_type", "package")
+    .eq("is_published", true);
+
+  return (all || []).find((pkg) => generateSlug(pkg.name) === slug) || null;
 }
```

> El fallback es lo que hace el despliegue **seguro**: durante la transición ninguna URL
> deja de resolver, ni las nuevas ni las viejas.

### A.3 — `components/pages/packages/components/PackageCard.jsx`

```diff
-  const slug = generateSlug(packageData.name);
+  // La columna manda; generateSlug solo cubre filas aún sin backfill.
+  const slug = packageData.slug || generateSlug(packageData.name);
```

*(Un único cambio: las tres `<Link href={/packages/${slug}}>` de las líneas 19, 52 y 97
ya usan esa variable.)*

### A.4 — `app/api/inventory/route.js` (POST)

```diff
+import { generateSlug } from "@/lib/packages/slug";
+
 …
     const inventoryData = {
       provider_id: body.providerId || body.provider_id || null,
       service_id: body.serviceId || body.service_id || null,
       destination_id: body.destinationId || body.destination_id || null,
       name: body.name,
+      slug: body.slug || generateSlug(body.name),
+      language: body.language === "es" ? "es" : "en",   // ← default EN tras el flip
       sku: body.sku || null,
       description: body.description || null,
       product_type: productType,
```

Y en el manejo de error, distinguir la colisión de slug de la de SKU:

```diff
     if (error) {
       console.error("Error creating inventory item:", error);
       if (error.code === "23505") {
-        return NextResponse.json({ error: "Ya existe un producto con ese SKU" }, { status: 409 });
+        const dupSlug = String(error.message || "").includes("idx_service_inventory_slug");
+        return NextResponse.json(
+          { error: dupSlug ? "Ya existe un producto con esa URL (slug)" : "Ya existe un producto con ese SKU" },
+          { status: 409 },
+        );
       }
```

### A.5 — `app/api/inventory/[id]/route.js` (PATCH)

```diff
     const allowedFields = [
-      "provider_id", "service_id", "destination_id", "name", "sku",
+      "provider_id", "service_id", "destination_id", "name", "slug", "language", "sku",
       "description", "product_type", "cost_price", "sale_price", "currency",
       "pricing_details", "status", "quantity_available", "valid_from",
       "valid_until", "blackout_dates", "details", "images", "is_featured",
       "is_published", "display_order", "meta_title", "meta_description"
     ];
```

> **Nota deliberada**: `slug` es editable pero **no se auto-regenera** al cambiar `name`.
> Esa es exactamente la propiedad que buscamos — traducir el nombre no toca la URL.
> Si Emma quiere cambiar la URL, lo hace explícitamente (y añade el 301).

### A.6 — `app/sitemap.js` *(arregla el bug PB-1)*

```diff
   let packagePages = [];
   try {
     const { data: packages } = await adminClient
       .from("service_inventory")
       .select("slug, updated_at")
       .eq("is_published", true)
       .eq("product_type", "package")
+      .eq("language", "en")          // ← se añade en el commit C, no aquí
+      .not("slug", "is", null)
       .neq("status", "discontinued");
```

Hoy esta query **falla entera** porque la columna no existe, y `packagePages` queda
vacío: ningún paquete está en el sitemap. Con A.1 empieza a funcionar sola.

---

## Commit B — Columnas `language`

### B.1 — Migración

`supabase/migrations/20260814_language_columns.sql` *(nuevo)*

```sql
-- Mismo patrón que 20260531_destinations_add_language.sql: aditivo e idempotente.

ALTER TABLE public.service_inventory
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'es'
  CHECK (language IN ('es', 'en'));
CREATE INDEX IF NOT EXISTS idx_service_inventory_language
  ON public.service_inventory(language);

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'es'
  CHECK (language IN ('es', 'en'));
CREATE INDEX IF NOT EXISTS idx_blog_posts_language
  ON public.blog_posts(language);

-- Marcar las traducciones que YA existen (creadas a mano antes de este plan)
UPDATE public.service_inventory SET language = 'en' WHERE name IN (
  'Canaima National Park / Standard Comfort Package',
  'Canaima National Park & Angel Falls | Premium Category',
  'Los Roques Express Getaway (2D/1N)',
  'Premium Geodesic Glamping: La Tortuga Island',
  'CANAIMA & CATATUMBO: NATURAL PHENOMENA EXPEDITION',
  'Mount Roraima Tepuy Trekking: The Lost World (10 Days / 9 Nights)'
);

UPDATE public.blog_posts SET language = 'en' WHERE slug IN (
  'safe-travel-venezuela',
  'angel-falls-luxury-eco-expedition',
  'secrets-of-los-roques',
  'los-roques-archipelago-la-tortuga-island',
  'los-roques-the-secret-behind-the-paradise'
);
```

Verificación: `SELECT language, count(*) FROM service_inventory GROUP BY language;`
→ debe dar `en: 6`, `es: 14`. Y en `blog_posts`: `en: 5`, `es: 11`.

### B.2 — `app/api/cms/blog/route.js` (POST) y `[id]/route.js` (PATCH)

```diff
       .insert({
         title: body.title,
         slug: normalizedSlug,
+        language: body.language === "es" ? "es" : "en",
         excerpt: body.excerpt || null,
```

```diff
     const allowedFields = [
-      "title", "slug", "excerpt", "content", "cover_image", "category",
+      "title", "slug", "language", "excerpt", "content", "cover_image", "category",
       "tags", "author_name", "destination_id", "status", "published_at",
       "meta_title", "meta_description",
     ];
```

### B.3 — Defaults del CMS a `"en"`

```diff
# app/(pages)/dashboard/cms/destinations/new/page.js:42
-    image_url: "", category_id: "", destination_type: "venezuela", language: "es",
+    image_url: "", category_id: "", destination_type: "venezuela", language: "en",
```

```diff
# app/(pages)/dashboard/cms/destinations/[id]/page.js:61 y :120
-    language: "es",
+    language: "en",
-          language: d.language || "es",
+          language: d.language || "en",
```

```diff
# app/api/cms/destinations/route.js:90
-    const language = body.language === "en" ? "en" : "es";
+    const language = body.language === "es" ? "es" : "en";
```

> Sin esto, cada destino/paquete/post que Emma cree tras el flip **nace invisible**.

---

## Commit C — Diccionario de UI + filtros de idioma

### C.1 — `lib/i18n/en.js` *(nuevo)*

```js
/**
 * Diccionario único de textos de UI del sitio público.
 *
 * Por qué un objeto plano y no next-intl: el sitio es monolingüe (inglés) y ~55 %
 * del texto visible vive en Supabase, que ninguna librería de i18n toca. Esto da
 * el beneficio real (un solo sitio donde cambiar el copy) sin routing por locale
 * ni dependencias nuevas. Si algún día vuelve el español, `es.js` entra sin refactor.
 *
 * Convención de claves: <area>.<componente>.<elemento>
 */
export const en = {
  // ── CTAs compartidos ──
  "cta.quote": "Get a quote",
  "cta.quoteFor": "Get a quote for {name}",
  "cta.comingSoon": "Coming soon",
  "cta.continueWhatsApp": "Continue to WhatsApp",
  "cta.viewPackages": "View packages ({count})",

  // ── Mensajes de WhatsApp (van al chat del asesor) ──
  "wa.generic": "Hi, I'm interested in your travel services.",
  "wa.service": "Hi, I'd like a quote for: {name}",
  "wa.destination": "Hi, I'm interested in traveling to {name}, Venezuela. Could you send me more information?",
  "wa.flight": "Hi, I'm interested in flights to {name}, {country}. Could you help me with options?",
  "wa.hotel": "Hi, I'm interested in hotels in {name}, {country}. Could you help me with options?",

  // ── Home ──
  "home.services.title": "Our Services",
  "home.services.subtitle": "Everything you need for the perfect trip",
  "home.destinations.title": "Discover Venezuela",
  "home.destinations.subtitle": "The Caribbean's last great secret is waiting for you",

  // ── Packages ──
  "packages.header.eyebrow": "Travel Packages",
  "packages.header.title": "Complete Experiences",
  "packages.empty.title": "Coming soon",
  "packages.empty.body": "We're putting together incredible travel packages for you. Check back soon!",

  // ── Lead capture ──
  "lead.consentRequired": "You must authorize data processing to continue",
  // …
};
```

`lib/i18n/index.js` *(nuevo)*

```js
import { en } from "./en";

const DICT = en;

/**
 * t("cta.quoteFor", { name: "Los Roques" })
 * Devuelve la clave si falta la traducción — visible en QA, nunca rompe el render.
 */
export function t(key, vars) {
  let out = DICT[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return out;
}
```

### C.2 — Cómo queda un componente

`components/pages/home/sections/ServicesSection.js`:

```diff
+import { t } from "@/lib/i18n";
 …
-        <SectionTitle
-          title="Nuestros Servicios"
-          subTitle="Todo lo que necesitas para tu viaje perfecto"
-        />
+        <SectionTitle
+          title={t("home.services.title")}
+          subTitle={t("home.services.subtitle")}
+        />
 …
-          const whatsappMessage = `Hola, estoy interesado en cotizar: ${service.name}`;
+          const whatsappMessage = t("wa.service", { name: service.name });
 …
-                    Próximamente
+                    {t("cta.comingSoon")}
 …
-                  quoteLabel={`Cotizar ${service.name}`}
+                  quoteLabel={t("cta.quoteFor", { name: service.name })}
```

### C.3 — Filtros de idioma en las consultas públicas

`lib/cms.js` — las 4 funciones:

```diff
   const { data: destinations, error: destError } = await supabase
     .from("destinations")
     .select("*")
     .eq("is_active", true)
+    .eq("language", "en")
     .order("display_order", { ascending: true });
```

```diff
     const { data: countData, error: countError } = await supabase
       .from("service_inventory")
       .select("destination_id")
       .eq("product_type", "package")
       .eq("is_published", true)
+      .eq("language", "en")
       .in("destination_id", destinationIds);
```

Mismo patrón en `getFeaturedDestinationsFromDB` y `getDestinationsByTypeFromDB`, y en:
`components/pages/home/sections/FeaturedPackages.js`,
`components/pages/packages/sections/PackagesList.jsx`, `FeaturedPackages.jsx`,
`app/(pages)/blog/page.js`, `app/(pages)/destinos/[slug]/page.js` (getPackages),
`app/(pages)/packages/destino/[slug]/page.js`, `app/api/packages/route.js`,
`app/api/destinations/route.js`, `lib/packages/slug.js` y `app/sitemap.js`.

> 🔴 **Las consultas del dashboard NO se filtran.** `app/api/inventory/*`,
> `app/api/cms/*` y las páginas de `/dashboard` deben seguir viendo ambos idiomas,
> o Emma pierde acceso a su propio contenido archivado.

### C.4 — Categorías del blog: traducir la etiqueta, NO la clave

`app/(pages)/blog/page.js`:

```diff
 const ALL_CATEGORIES = [
-  { key: "todos", label: "Todos" },
-  { key: "destinos", label: "Destinos" },
-  { key: "consejos", label: "Consejos" },
-  { key: "itinerarios", label: "Itinerarios" },
-  { key: "ofertas", label: "Ofertas" },
-  { key: "noticias", label: "Noticias" },
+  // ⚠️ `key` = valor literal en blog_posts.category. NO traducir: viaja en la URL
+  // (/blog?category=destinos) y se compara crudo en q.eq("category", category).
+  // Traducir la clave deja la página VACÍA sin error y rompe los enlaces indexados.
+  { key: "todos", label: "All" },
+  { key: "destinos", label: "Destinations" },
+  { key: "tips", label: "Travel Tips" },
+  { key: "consejos", label: "Advice" },
+  { key: "itinerarios", label: "Itineraries" },
+  { key: "ofertas", label: "Deals" },
+  { key: "noticias", label: "News" },
 ];
```

> De paso arregla un desajuste preexistente: la BD usa `tips` (3 posts) y `general`,
> que no estaban en la lista → esos posts nunca aparecían como chip de filtro.

---

## Commit D — Rutas y redirects

### D.1 — Renombrado

```
git mv "app/(pages)/destinos"          "app/(pages)/destinations"
git mv "app/(pages)/packages/destino"  "app/(pages)/packages/destination"
```

Y actualizar los 6 puntos que construyen esas URLs
(`VenezuelaDestinations.js:82` y `:152`, `blog/[slug]/page.js:259` y `:265`,
`destinations/[slug]/page.js:96`, `packages/destination/[slug]/page.js:143`,
`sitemap.js:32` y `:52`).

### D.2 — `next.config.mjs`

```diff
 const nextConfig = {
   webpack: (config, { isServer }) => { … },
   images: { … },
+
+  async redirects() {
+    return [
+      // ── Renombrado de rutas (prefijo) ──
+      { source: "/destinos/:slug",         destination: "/destinations/:slug",          permanent: true },
+      { source: "/packages/destino/:slug", destination: "/packages/destination/:slug",  permanent: true },
+
+      // ── Mapa ES→EN de destinos con gemelo en inglés ──
+      // Va DESPUÉS de la regla de prefijo, así que la entrada aquí es la ruta ya
+      // renombrada. Next evalúa en orden: la primera coincidencia gana.
+      { source: "/destinations/canaima",          destination: "/destinations/canaima-national-park",          permanent: true },
+      { source: "/destinations/los-roques",       destination: "/destinations/los-roques-archipelago",         permanent: true },
+      { source: "/destinations/roraima",          destination: "/destinations/mount-roraima",                  permanent: true },
+      { source: "/destinations/isla-la-tortuga",  destination: "/destinations/la-tortuga-island",              permanent: true },
+      { source: "/destinations/catatumbo",        destination: "/destinations/catatumbo-lightning-venezuela",  permanent: true },
+
+      // Limpieza del prefijo técnico `en-` (C6)
+      { source: "/destinations/en-canaima-national-park", destination: "/destinations/canaima-national-park", permanent: true },
+
+      // ── Paquetes y blog: una entrada por slug ES que se retire ──
+      // Alimentar desde el export de Search Console (Fase 0.2).
+    ];
+  },
+
   async headers() { … },
 };
```

> ⚠️ El orden importa: la regla de prefijo `/destinos/:slug` se evalúa primero y
> reescribe a `/destinations/:slug`; el mapa slug-a-slug la recoge en la segunda vuelta.
> Verificar `curl -I https://venezuelavoyages.com/destinos/canaima` → `301` →
> `/destinations/canaima` → `301` → `/destinations/canaima-national-park`.
> **Dos saltos son aceptables pero no ideales**: si Search Console muestra muchas
> URLs `/destinos/canaima`, añadir la entrada directa en un solo salto.

### D.3 — Enlaces internos dentro del contenido del blog

Script de una pasada (`scripts/fix-blog-internal-links.mjs`):

```js
const REPLACEMENTS = [
  [/https?:\/\/(www\.)?venezuelavoyages\.com\/destinos\//g, "https://venezuelavoyages.com/destinations/"],
  [/\/packages\/canaima-salto-angel-campamento-categoria-standard/g,
   "/packages/canaima-national-park-standard-comfort-package"],   // el actual está despublicado → 404
  [/http:\/\/venezuelavoyages\.com/g, "https://venezuelavoyages.com"],
];
// UPDATE blog_posts SET content = <reemplazado> WHERE id = …   (6 posts afectados)
```

---

## Commit E — KB del chatbot

### E.1 — `lib/ai/ingestion/parsers/db.js`

```diff
 export async function extractDestinations() {
   const sb = admin();
   const { data, error } = await sb
     .from("destinations")
     .select(
       "id, name, slug, description, short_description, country, city, tags, highlights, pricing"
     )
+    .eq("is_active", true)
+    .eq("language", "en")
     .limit(500);
```

Y el andamiaje textual, que va **dentro del embedding**:

```diff
-    parts.push(`Destino: ${d.name}`);
+    parts.push(`Destination: ${d.name}`);
     if (d.country || d.city) {
-      parts.push(`Ubicación: ${[d.city, d.country].filter(Boolean).join(", ")}`);
+      parts.push(`Location: ${[d.city, d.country].filter(Boolean).join(", ")}`);
     }
 …
-      parts.push("Categorías: " + d.tags.join(", "));
+      parts.push("Categories: " + d.tags.join(", "));
 …
-      parts.push(`Información de precios: ${JSON.stringify(d.pricing)}`);
+      parts.push(`Pricing information: ${JSON.stringify(d.pricing)}`);
     …
-    title: `Destino: ${d.name}`,
+    title: `Destination: ${d.name}`,
```

Igual en `extractServiceInventory` (`Precio:`, `Disponible:`, `sin fecha límite`,
`Detalles de precio:`, `Detalles:`, `Producto`) y en `extractCatalogServices`
(`Servicio:`, `Enlace en el sitio:`).

> `extractServiceInventory` ya filtra `is_published = true`, así que los paquetes ES
> salen solos al archivarlos. Añadir igualmente `.eq("language", "en")` por simetría.

### E.2 — `app/api/crm/chatbot/kb/sync/route.js`

```diff
     const result = await ingestKbAction({
       type: body.type,
       url: body.url,
+      language: "en",
     });
```

Sin esto, `ingestKbAction.js:69` (`input.language || "es"`) reetiqueta los 59
documentos como españoles en cada re-sync.

### E.3 — `lib/ai/tools/searchPackages.js` *(arregla PB-2, bug de hoy)*

```diff
         url:
           s.destination?.slug && (s.service?.slug || "").includes("package")
-            ? `/packages/${s.destination.slug}`
+            ? `/packages/destination/${s.destination.slug}`
             : s.service?.href || null,
```

`/packages/canaima` es un slug **de destino** en la ruta **de paquete**: ningún paquete
se llama "Canaima", así que devuelve 404. El chatbot está mandando leads a una página
inexistente ahora mismo.

### E.4 — Idioma por defecto del agente

```diff
# app/api/chatbot/chat/route.js  y  lib/ai/utils.js
-  const language = detectLanguage(lastUserMessage) || "es";
+  const language = detectLanguage(lastUserMessage) || "en";
```

`detectLanguage` se mantiene: el visitante hispanohablante ocasional sigue recibiendo
respuesta en español. Solo cambia el **default** cuando no hay señal.

---

## Orden de despliegue y qué se puede hacer ya

| Commit | ¿Se puede desplegar antes de decidir sobre idiomas? | Efecto visible |
|---|---|---|
| **A** — slug de paquetes | ✅ **Sí, hoy** | Ninguno para el usuario. Arregla el sitemap (PB-1) |
| **E.3** — URL de `searchPackages` | ✅ **Sí, hoy** | El chatbot deja de mandar leads a un 404 |
| **B** — columnas `language` | ✅ Sí (aditivo, nadie las lee aún) | Ninguno |
| **C** — diccionario + filtros | ❌ Solo tras crear las filas EN | El sitio pasa a inglés |
| **D** — rutas + redirects | ❌ Tras C | URLs nuevas |
| **E** — KB | ❌ Tras la traducción de datos | El chatbot cita fuentes en inglés |

**A y E.3 son valor inmediato sin riesgo de idioma**: arreglan dos bugs que existen hoy
(paquetes fuera del sitemap, chatbot enviando a 404) y dejan el terreno preparado.
Si quieres empezar por algo, empieza por ahí.
