# Plan de Implementación: Migración a Inglés (English-First)

**Proyecto**: Venezuela Voyages — `fullstack-nextjs-golobe-travel-agency`
**Fecha de análisis**: 2026-08-13
**Alcance**: Landing pública + contenido en base de datos + integraciones (chatbot, emails, PDFs, SEO)
**Fuera de alcance (decisión)**: Dashboard `/dashboard` (uso interno, audiencia hispanohablante)

> ⚠️ **SUPERSEDIDO como ruta recomendada** por [`plan-migracion-ingles-LEAN.md`](./plan-migracion-ingles-LEAN.md) — mismo resultado en **4,5–6 días** en lugar de 13–17, traduciendo en sitio en vez de montar una capa i18n y un modelo bilingüe en BD. Este documento sigue siendo la referencia de **inventario, hallazgos y arquitectura**; su plan de fases solo aplica si el negocio decide conservar el español.
>
> 📎 **Documentos compañeros**
> - [`plan-migracion-ingles-regresion.md`](./plan-migracion-ingles-regresion.md) — análisis de regresión cross-aplicación. Detectó 6 regresiones que este plan habría causado y 7 áreas de contenido que no contabilizaba; **ya están incorporadas abajo**. Trae el **orden de commits obligatorio** (§7) y el **checklist pre-merge** (§8). No ejecutar ninguna fase sin leerlo.
> - [`plan-migracion-ingles-cambios.md`](./plan-migracion-ingles-cambios.md) — **los diffs concretos**, archivo por archivo, escritos contra el contenido actual del repo.

---

## 0. Resumen Ejecutivo

La aplicación **ya está a mitad de camino**, pero de forma ad-hoc y sin arquitectura: `<html lang="en">`, metadata raíz, Nav, Footer, `/about` y el hero ya están en inglés (commits `680d334`, `ec7a1fe`, `fb7ab91`), mientras que el resto de la landing, todo el contenido de la BD y todos los documentos al cliente siguen en español. El resultado hoy es una página **mixta**, que es peor que cualquiera de los dos extremos: penaliza SEO (contenido en un idioma, `lang` en otro), rompe la confianza del visitante y confunde a Google.

**Recomendación**: no montar i18n completo (next-intl, rutas `/en` `/es`). Hacer un **flip monolingüe a inglés**, extrayendo los textos de UI a un diccionario único (`lib/i18n/en.js`) para que un `es.js` futuro sea drop-in. Razones:

1. La audiencia declarada es 100 % inglés → no hay tráfico ES que proteger con rutas duplicadas.
2. **~55 % del texto visible vive en Supabase, no en el código** — ninguna librería de i18n resuelve eso.
3. i18n completo multiplica el trabajo ×3 y el mantenimiento del CMS ×2 de forma permanente, con presupuesto LLM cero.

**Esfuerzo estimado**: **13–17 días** de trabajo efectivo, en 8 fases, con la landing en inglés al terminar la Fase 3 (día ~6). *(La estimación inicial era 10–14; el análisis de regresión añadió 2,5 días de trabajo que no estaba contabilizado — ver §7.)*

---

## 1. Inventario Real (medido, no estimado)

### 1.1 Strings en español en el código

Medición automática sobre 654 archivos `.js/.jsx/.ts/.tsx` (script en
`scratchpad/audit-spanish-strings.mjs` — sirve también para medir avance):

| Área | Archivos | ~Strings ES | ¿Traducir? |
|---|---:|---:|---|
| **1 — Sitio público (landing + páginas)** | 39 | **193** | ✅ Sí — prioridad 1 |
| **2 — Data estática (fallbacks)** | 4 | **84** | ✅ Sí — prioridad 1 |
| **3 — Chatbot (widget + prompts + tools)** | 27 | **235** | ⚠️ Parcial (ver §6) |
| **4 — Documentos al cliente (PDF / email)** | 8 | **41** | ✅ Sí — prioridad 2 |
| 5 — Dashboard admin (páginas + componentes) | 60 | 517 | ❌ No (interno) |
| 6 — API admin (mensajes de error) | 40 | 198 | ❌ No (interno) |
| 7 — API pública / otros | 6 | 13 | ⚠️ Solo mensajes visibles |
| 8 — Server actions CRM | 4 | 88 | ⚠️ Solo los que llegan al cliente |
| 9 — Scripts de desarrollo | 16 | 532 | ❌ No |
| **TOTAL** | **207** | **~1 914** | **~570 en alcance** |

**Archivos públicos con más carga** (los primeros 10 concentran ~50 % del trabajo de landing):

```
23  app/(pages)/privacy-policy/page.js
16  components/pages/home/sections/Reviews.js
15  app/(pages)/blog/page.js
12  components/pages/packages/sections/PackageBookingForm.jsx
11  app/(pages)/terms-of-service/page.js
10  app/(pages)/return-policy/page.js
 9  app/(pages)/destinos/[slug]/page.js
 9  app/(pages)/packages/destino/[slug]/page.js
 8  app/(pages)/packages/[slug]/page.js
 7  app/(pages)/about/page.js
34  data/popularDestinations.js      (fallback estático)
32  data/venezuelaDestinations.js    (fallback estático)
14  data/servicesConfig.js           (fallback estático)
```

### 1.2 Contenido en Supabase (conteos reales de producción)

| Tabla | Filas | Estado del idioma | Columna `language` |
|---|---:|---|---|
| `destinations` | **32** | 27 ES / 5 EN (duplicados ya creados) | ✅ Sí (`es`\|`en`) |
| `service_inventory` (paquetes) | **20** (15 publicados) | 14 ES / 6 EN (duplicados ad-hoc) | ❌ **No** |
| `blog_posts` | **16** | 11 ES / 5 EN (5 pares ya traducidos) | ❌ **No** |
| `catalog_services` | **9** | 100 % ES | ❌ No |
| `destination_categories` | **6** | 100 % ES | ❌ No |
| `tourism_providers` | 3 | ES (descripciones) | ❌ No |
| `banners` | **0** | — (vacío, sin deuda) | ❌ No |
| `kb_documents` (RAG chatbot) | **59** | **100 % ES** | ✅ Sí (todo `es`) |
| `kb_chunks` | 61 | 100 % ES (embeddings ES) | — |
| `chat_conversations` | 33 | 32 ES / 1 EN | ✅ Sí |
| `quotations` / `vouchers` | 23 / 2 | ES (textos, T&C) | ❌ No |

**El patrón "una fila por idioma" ya existe de facto** en destinos, paquetes y blog — se creó a mano, sin columna que lo formalice salvo en `destinations`. El plan lo formaliza en vez de inventar otro.

### 1.3 Traducciones que YA existen (no rehacer)

- **Destinos EN**: `en-canaima-national-park`, `los-roques-archipelago`, `mount-roraima`, `la-tortuga-island`, `catatumbo-lightning-venezuela`
- **Paquetes EN**: Canaima Standard Comfort, Canaima & Angel Falls Premium, Los Roques Express Getaway, Premium Geodesic Glamping La Tortuga, Mount Roraima Trekking, Canaima & Catatumbo Natural Phenomena
- **Blog EN**: `safe-travel-venezuela`, `angel-falls-luxury-eco-expedition`, `secrets-of-los-roques`, `los-roques-archipelago-la-tortuga-island`, `los-roques-the-secret-behind-the-paradise`
- **Código**: `app/layout.js` (metadata + OG), `components/sections/Nav.js`, `components/sections/QuickLinks.js` (parcial), `components/sections/Footer.js`, `app/(pages)/about/page.js`, `app/(pages)/support/page.js`, `data/heroConfig.js`, `components/sections/AnnouncementBar.jsx`

---

## 2. Hallazgos Críticos (bloqueantes o de alto riesgo)

### 🔴 C1 — Los slugs de paquetes se derivan del NOMBRE

`lib/packages/slug.js` genera la URL con `generateSlug(pkg.name)`; `service_inventory` **no tiene columna `slug`**. Consecuencia directa:

> **Traducir el nombre de un paquete cambia silenciosamente su URL** y rompe todo enlace indexado, compartido por WhatsApp o incrustado en una cotización PDF ya enviada.

**Debe resolverse ANTES de tocar cualquier nombre.** Ver Fase 1.1.

### 🔴 C2 — El sitemap no incluye paquetes (bug preexistente)

`app/sitemap.js:66` consulta `service_inventory.select("slug, updated_at")` → la columna no existe → **la query falla y `packagePages` queda vacío**. Verificado contra producción:

```
sitemap package query => ERROR: column service_inventory.slug does not exist
```

Hoy Google no ve ninguna página de paquete desde el sitemap. Se arregla solo con C1.

### 🟠 C3 — Rutas públicas en español

`/destinos/[slug]` y `/packages/destino/[slug]` son URLs en español servidas a una audiencia inglesa. Cambiarlas mejora SEO y coherencia, pero exige **redirects 301** o se pierde el ranking acumulado.

### 🟠 C4 — La base de conocimiento del chatbot es 100 % española

Los 59 documentos y 61 chunks de `kb_documents`/`kb_chunks` están en español y sus embeddings se generaron sobre texto español. El prompt del agente "Vale" ya es bilingüe (`lib/ai/prompts/system.js`) y detecta idioma, **pero el RAG solo puede recuperar contenido en español** → responde en inglés citando fuentes españolas, con degradación de calidad en el retrieval.

### 🟠 C5 — `openGraph.locale` inconsistente

`app/layout.js` declara `en_VE`, pero `/about`, `/packages`, `/packages/[slug]` y `/destinos/[slug]` declaran `es_VE`. Señal contradictoria para crawlers y previews sociales.

### 🟡 C6 — Slug `en-canaima-national-park` con prefijo técnico

El prefijo `en-` es un artefacto de creación manual, no un patrón. Debe normalizarse a `canaima-national-park` con su 301.

### 🟡 C7 — Los datos dicen que hoy el tráfico conversa en español

32 de 33 conversaciones del chatbot están marcadas `language='es'`. Es probable que sean pruebas internas, pero **conviene confirmarlo en GA4 (idioma del navegador + país) antes de retirar el español**, no después. No bloquea el plan: la Fase 4 deja el contenido ES archivado y reversible, no borrado.

---

## 3. Arquitectura Objetivo

### 3.1 Textos de UI: diccionario único, sin librería

```
lib/i18n/
  ├── index.js      // export const t = (key) => dict[key] ?? key
  └── en.js         // { "cta.quote": "Get a quote", "home.destinations.title": "Discover Venezuela", ... }
```

- Cero dependencias nuevas, cero cambio de rutas, cero coste.
- Un `es.js` futuro entra sin refactor si algún día se reabre el español.
- Convención de claves: `<area>.<componente>.<elemento>` (ej. `home.services.title`).

**No** usar next-intl / react-intl en esta fase: aportan routing por locale y pluralización que hoy no se necesitan, y no tocan el 55 % del texto que vive en Supabase.

### 3.2 Contenido de BD: fila por idioma + filtro `language`

| Tabla | Estrategia | Justificación |
|---|---|---|
| `destinations` | **Fila por idioma** (ya tiene `language`) | 32 filas, contenido largo y con SEO propio; ya hay 5 EN |
| `service_inventory` | **Fila por idioma** (añadir `language`) | Ya existen 6 duplicados EN; contenido largo con `details` JSONB |
| `blog_posts` | **Fila por idioma** (añadir `language`) | Ya existen 5 pares; artículos independientes con slug propio |
| `catalog_services` (9) | **Traducir in-place** | Catálogo corto y estable; duplicar es sobreingeniería |
| `destination_categories` (6) | **Traducir in-place** | Ídem |
| `tourism_providers` (3) | **Traducir in-place** | Solo `description` |
| `banners` (0) | Nada | Tabla vacía; se crearán en inglés |

Las páginas públicas filtran `.eq("language", "en")`. Las filas ES quedan `is_active = false` / `is_published = false` — **archivadas, no borradas**. Rollback = un `UPDATE`.

### 3.3 Punto de decisión a 30 días

Si GA4 confirma tráfico ES ≈ 0 tras un mes en inglés, se congela el mantenimiento del contenido ES (Emma mantiene solo EN). Si aparece tráfico ES relevante, las filas siguen ahí y se reactivan. **Esta decisión no se toma ahora.**

---

## 4. Plan por Fases

### Fase 0 — Preparación y línea base *(0,5 día)*

| # | Tarea | Entregable |
|---|---|---|
| 0.1 | Baseline GA4 + Clarity: idioma de navegador, país, páginas más vistas, tasa de rebote por página | Captura/hoja con métricas pre-migración |
| 0.2 | Exportar Search Console: páginas indexadas + consultas, para construir el mapa de redirects | CSV de URLs indexadas |
| 0.3 | Backup completo de Supabase (`pg_dump` o snapshot del proyecto) | Snapshot con fecha |
| 0.4 | Rama `feat/english-migration` desde `dev` | Rama creada |
| 0.5 | Correr `audit-spanish-strings.mjs` y guardar el conteo inicial (1 914) | Baseline de progreso |

> ⚠️ 0.2 es el único paso que no se puede recuperar después. Sin la lista de URLs indexadas, el mapa de redirects se hace a ciegas.

---

### Fase 1 — Fundaciones técnicas *(2 días)* — **bloquea todo lo demás**

**1.1 Columna `slug` real en `service_inventory` (resuelve C1 y C2)**

```sql
-- supabase/migrations/20260814_inventory_slug.sql
ALTER TABLE public.service_inventory ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill con el MISMO algoritmo de lib/packages/slug.js
-- (lowercase, sin diacríticos, " - "→"-", espacios→"-", "/"→"-", limpieza)
UPDATE public.service_inventory SET slug = <generateSlug(name)> WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_inventory_slug
  ON public.service_inventory(slug) WHERE slug IS NOT NULL;
```

Luego en `lib/packages/slug.js`: `findPackageBySlug` pasa a resolver por columna
(`.eq("slug", slug)`) con **fallback al match por nombre** durante una release, para
no romper nada en el despliegue. Así, traducir `name` ya no altera la URL.

> ✅ Verificado: los 20 productos actuales generan **0 colisiones de slug** → el índice `UNIQUE` es seguro.

**El mismo commit debe incluir, o hay ventana rota en producción** (ver regresión §7, commit A):

- `components/pages/packages/components/PackageCard.jsx:14` → `packageData.slug ?? generateSlug(packageData.name)`.
  Si no, el enlace usa el nombre traducido y la ruta resuelve por columna → **404 en cada tarjeta**. *(RG-2)*
- `app/api/inventory/route.js` (POST) → añadir `slug` (derivado de `body.name` si no viene) y `language` al objeto `inventoryData`.
- `app/api/inventory/[id]/route.js` (PATCH) → añadir `"slug"` y `"language"` a `allowedFields`.
  Ambos endpoints usan **listas blancas explícitas**: sin esto, cada paquete que Emma cree nace con `slug = NULL` y `language = 'es'` → invisible en el sitio, ausente del sitemap y con 404 permanente, **sin ningún error visible**. *(RG-1)*

**1.2 Columna `language` en `service_inventory` y `blog_posts`**

Copiar el patrón exacto de `20260531_destinations_add_language.sql` (aditivo,
`DEFAULT 'es' NOT NULL`, `CHECK (language IN ('es','en'))`, índice, idempotente).
Marcar a `'en'` las filas ya traducidas (6 paquetes, 5 posts — lista en §1.3).

También en este commit: añadir `"language"` a `allowedFields` de
`app/api/cms/blog/[id]/route.js` y al objeto de `insert` de `app/api/cms/blog/route.js`
(mismo problema de lista blanca que RG-1).

> ✅ Verificado: las políticas RLS filtran por `is_active`/`is_published`/`status`, nunca
> por columnas de texto → la migración aditiva no toca permisos. El trigger
> `log_price_change` reacciona a precios, no a texto → traducir nombres no ensucia
> `inventory_price_history`.

**1.3 Módulo `lib/i18n/`** con el diccionario `en.js` vacío y el helper `t()`.

**1.4 Normalizar `openGraph.locale` a `en_VE`** en las 5 páginas que declaran `es_VE` (C5).

**1.5 Arreglar `app/sitemap.js`**: usar la nueva columna `slug` y añadir `/blog` y las páginas de paquete.

*Criterio de aceptación*: `npm run build` verde, `/sitemap.xml` lista los 15 paquetes publicados, todas las URLs actuales de `/packages/...` siguen resolviendo.

---

### Fase 2 — Shell público + landing *(1 día)*

| Archivo | Qué cambia |
|---|---|
| `data/routes.json` | `return-policy` → "Return & Refund Policy", `security-policy` → "Security Policies" |
| `components/sections/QuickLinks.js` | Sección Legal (4 enlaces en ES) + comentario "Teléfono/WhatsApp" |
| `components/sections/FooterWhatsAppLink.jsx` | `whatsappMessage`, `triggerLabel` |
| `components/ui/DualCTA.js` | `quoteLabel` "Cotizar", `quoteMessage`, badge "Próximamente" |
| `components/ui/LeadCaptureModal.jsx` | Labels del formulario + `"Debes autorizar el tratamiento de datos…"` |
| `hooks/useLeadCapture.js` | Mensajes de WhatsApp por defecto |
| `components/pages/home/sections/ServicesSection.js` | Título "Nuestros Servicios", subtítulo, badge, CTAs |
| `components/pages/home/sections/VenezuelaDestinations.js` | "Descubre Venezuela", "Ver Paquetes", `quoteMessage` |
| `components/pages/home/sections/PopularFlightDestinations.js` | `quoteMessage` + `quoteLabel` |
| `components/pages/home/sections/PopularHotelDestinations.js` | Ídem |
| `components/pages/home/sections/FeaturedPackages.js` | Encabezados |
| `components/pages/home/sections/LatestBlogPosts.js` | Encabezados |
| `components/pages/home/sections/Reviews.js` | ⚠️ **7 testimonios hardcodeados** en `FEATURED_REVIEWS` con nombres venezolanos ("María Fernanda González", "Carlos Eduardo Rodríguez"…). **Decisión de negocio previa**: ¿son testimonios reales o de relleno? Traducir reseñas reales de clientes es delicado; las opciones son traducir, sustituir por reseñas reales en inglés, o retirar la sección |
| `components/local-ui/ShareButtons.jsx` | `aria-label` y tooltips |
| `components/ui/DualCTAWithTracking.js`, `components/WhatsAppButton.js` | CTAs con mensaje de WhatsApp en español |

Todos los textos entran al diccionario `lib/i18n/en.js`, no hardcodeados.

*Criterio de aceptación*: la home en `/` no muestra ni una palabra en español con el CMS en modo fallback estático.

---

### Fase 3 — Páginas de contenido y legales *(2,5 días)*

| Página | Notas |
|---|---|
| `app/(pages)/privacy-policy/page.js` (23) | Ya documenta GA4 + Clarity (commit `dbb01aa`); traducir manteniendo esa sección |
| `app/(pages)/terms-of-service/page.js` (11) | Fuente: `Términos y condiciones venezuela voyages.docx` |
| `app/(pages)/return-policy/page.js` (10) | Fuente: `Política de Devolución y Reembolso…docx` |
| `app/(pages)/security-policy/page.js` (6) | Fuente: `Políticas de Seguridad…docx` |
| `app/(pages)/blog/page.js` (15) + `[slug]` (6) | Filtros, categorías, "Leer más", estados vacíos |
| `app/(pages)/packages/page.js` + `PackagesHeader` + `PackagesList` | Metadata ES + hero completo en ES |
| `app/(pages)/packages/[slug]/page.js` (8) | Metadata, "Paquete no encontrado", "desde $" |
| `app/(pages)/packages/destino/[slug]/page.js` (9) | |
| `app/(pages)/destinos/[slug]/page.js` (9) | "Descubre X", "Lugares Imprescindibles", metadata |
| `components/pages/packages/sections/PackageBookingForm.jsx` (12) | Formulario de reserva — validaciones incluidas |
| `components/pages/packages/sections/*` | Itinerary, Includes, BookingSummary |
| `app/(pages)/flights/page.js`, `hotels/page.js`, `hotels/[slug]`, `flights/[flightNumber]` | ⚠️ Siguen **públicas y en el sitemap** con metadata en español y cuerpo en inglés, aunque el buscador del home está desactivado. Decidir: traducir la metadata **o** sacarlas del sitemap y `noindex` |
| `data/venezuelaDestinations.js`, `popularDestinations.js`, `servicesConfig.js` | Fallbacks estáticos (84 strings) — deben coincidir con la traducción de BD |

> ⚠️ Los 3 archivos de `data/` son el **fallback** que se renderiza si Supabase falla. Si quedan en español, un incidente de BD devuelve la landing al español. No son opcionales.

**Los 4 `.docx` legales en la raíz del repo son la fuente de verdad de los textos legales** y también alimentan la KB del chatbot (§6). Traducirlos una vez y usar esa traducción en ambos sitios.

*Criterio de aceptación*: recorrido completo home → destino → paquete → reserva → legales sin español.

---

### Fase 4 — Migración de datos en Supabase *(3,5 días)*

**4.1 Traducción in-place (catálogos cortos)** — un solo script SQL revisado a mano:

- `catalog_services` (9): "Vuelos"→"Flights", "Tours y Actividades"→"Tours & Activities", "Traslados"→"Transfers", "Seguro de Viaje"→"Travel Insurance", "Alquiler de Autos"→"Car Rental", "Cruceros"→"Cruises", "Plan Corporativo"→"Corporate Travel", "Todo Incluido"→"All Inclusive" + sus `description`
- `destination_categories` (6): "Destinos de Playa"→"Beach Destinations", "Aventura y Naturaleza Salvaje"→"Adventure & Wild Nature", "Cultura y Montaña"→"Culture & Mountains", "Fenómenos Únicos"→"Unique Phenomena", "Destinos Internacionales"→"International Destinations", "Hoteles Populares"→"Popular Hotels" + `subtitle`
- `tourism_providers` (3): solo `description`
- `hotels` (4): `description` — alimenta la tool `searchHotels` y 5 documentos de la KB *(SC-2)*
- `website_reviews` (3): `title` + `comment` — visibles en el home; misma decisión de negocio que `FEATURED_REVIEWS` *(SC-1)*

> 🔴 **Regla innegociable — no traducir claves técnicas** *(RG-3)*
>
> Se traducen **etiquetas**, nunca **valores que funcionan como clave**:
>
> | ❌ NO traducir | Por qué |
> |---|---|
> | `blog_posts.category` (`destinos`, `tips`, `noticias`) | Viaja en la URL `/blog?category=destinos` y se compara crudo en `q.eq("category", category)`. Traducirlo deja la página **vacía sin error** y rompe los enlaces indexados. Traducir solo `label` en `ALL_CATEGORIES` de `app/(pages)/blog/page.js:24` |
> | `slug` de cualquier tabla | Claves de enlace interno y de URL |
> | `service_inventory.sku` | Referencia operativa con proveedores |
> | Todos los `status` / `type` / enums | `available`, `published`, `package`, `venezuela`… |

**4.2 Filas EN faltantes (fila por idioma)**

| Tabla | Filas EN a crear | Detalle |
|---|---:|---|
| `destinations` tipo `venezuela` | **5** | Los Llanos, Isla de Margarita, Morrocoy, Mérida y Sierra Nevada, Colonia Tovar |
| `destinations` tipo `flight` | **9 activos** | Cancún, Punta Cana, Miami, Madrid, Panamá, Bogotá, Buenos Aires, Nueva York, Cartagena |
| `destinations` tipo `hotel` | 0 activos | Los 7 están `is_active=false` — traducir solo si se reactivan |
| `service_inventory` | **~8 publicados** | Los ES publicados sin gemelo EN |
| `blog_posts` | **11** | Los 11 posts ES sin versión EN |

Campos a traducir por fila: `name`/`title`, `short_description`, `description`, `excerpt`, `content`, `meta_title`, `meta_description`, `tags[]`, `highlights[]`, y en paquetes el JSONB `details` (`includes`, `not_includes`, `itinerary`, `schedule`, `recommendations`, `important_notes`).

> 🔴 **`destinations.metadata` es el 70 % del contenido de la página de destino** *(RG-6)*
>
> `app/(pages)/destinos/[slug]/page.js:60-66` renderiza casi toda la página desde
> `dest.metadata`: `cultural_description`, `must_see_places`, `experiences`,
> `practical_info`, `testimonials`, `gastronomy`, `lodging`. Son **3 200–6 600 caracteres
> por destino** (9 destinos ES activos ≈ 41 K caracteres). Omitirlo deja las páginas de
> destino prácticamente enteras en español bajo un título en inglés.

**Volumen total medido**: ~125 000 caracteres ≈ 35 000 tokens
(destinos ES 47 K · paquetes ~35 K · blog ~40 K · resto ~4 K).
Cabe holgado en el free tier de Gemini (250 RPD / 250 K TPM) en una sola sesión.

**4.3 Método de traducción — coste cero**

Escribir `scripts/translate-content.mjs` que reutilice la cadena de fallback ya
configurada en `lib/ai/providers.js` (Gemini 2.5 Flash → Nemotron → gpt-oss, todos
free tier, ~2 250 llamadas/día). Modo de uso:

1. `--dry-run` que escribe un JSON con las traducciones propuestas
2. **Revisión humana obligatoria** de nombres de destino, precios, itinerarios y textos legales
3. `--apply` que inserta las filas EN

> No traducir automáticamente sin revisión: los nombres propios venezolanos (Salto Ángel → Angel Falls, curiara, tepuy, Mukumbarí, chigüire) y los términos legales se degradan con traducción literal.

**4.4 Archivar contenido ES**: `UPDATE ... SET is_active = false` / `is_published = false` en las filas `language='es'` **solo después** de verificar que existe la EN equivalente. Nunca `DELETE`.

**4.5 Filtrar por idioma en las consultas públicas**: `lib/cms.js` (4 funciones), `components/pages/home/sections/FeaturedPackages.js`, `PackagesList.jsx`, `app/(pages)/blog/page.js`, `app/sitemap.js`, `app/api/packages/*`, `app/api/destinations/*` → añadir `.eq("language", "en")`.

> ⚠️ **Orden crítico** (regresión §7, commit C): este filtro entra **después** de que
> exista la fila EN de cada ES publicada. Aplicarlo antes deja el sitio vacío.
> Las consultas del **dashboard admin no se filtran** — Emma debe seguir viendo ambos idiomas.

**4.6 Voltear los defaults de idioma del CMS a `"en"`** — obligatorio, no opcional *(RG-5)*:

| Archivo | Línea | Cambio |
|---|---:|---|
| `app/(pages)/dashboard/cms/destinations/new/page.js` | 42 | `language: "es"` → `"en"` |
| `app/(pages)/dashboard/cms/destinations/[id]/page.js` | 61, 120 | ídem |
| `app/api/cms/destinations/route.js` | 90 | `body.language === "en" ? "en" : "es"` → default `"en"` |
| `dashboard/cms/packages/new` y `[id]` | — | enviar `language: "en"` en el payload |

Sin esto, **cada contenido nuevo que cree Emma nace invisible para el sitio**.

*Criterio de aceptación*: 0 filas con `language='es'` visibles en el sitio público; conteo EN ≥ conteo ES previo publicado; crear un destino y un paquete de prueba desde el CMS y verificar que aparecen en la web y en el sitemap.

---

### Fase 5 — Rutas y SEO *(1,5 días)*

**5.1 Renombrar rutas en español**

```
/destinos/[slug]           → /destinations/[slug]
/packages/destino/[slug]   → /packages/destination/[slug]
```

**5.2 Redirects 301 en `next.config.mjs`** (`async redirects()`):

- Reglas de prefijo: `/destinos/:slug` → `/destinations/:slug`, `/packages/destino/:slug` → `/packages/destination/:slug`
- **Mapa slug-a-slug** para los pares ES→EN ya conocidos:

| Desde (ES) | Hacia (EN) |
|---|---|
| `/destinos/canaima` | `/destinations/canaima-national-park` |
| `/destinos/los-roques` | `/destinations/los-roques-archipelago` |
| `/destinos/roraima` | `/destinations/mount-roraima` |
| `/destinos/isla-la-tortuga` | `/destinations/la-tortuga-island` |
| `/destinos/catatumbo` | `/destinations/catatumbo-lightning-venezuela` |
| `/destinations/en-canaima-national-park` | `/destinations/canaima-national-park` *(C6)* |
| …+ los slugs de paquetes y blog que cambien | |

- Alimentar el mapa con el CSV de Search Console de la Fase 0.2. Toda URL indexada debe tener destino; si no lo tiene, apuntar a la sección padre, nunca a 404.

**5.3 `canonical` explícito** en las páginas de destino, paquete y blog (`lib/utils/canonicalUrl.js` ya existe).

**5.4 `robots.js` y `sitemap.js`**: re-verificar tras el rename; el sitemap debe contener solo URLs EN.

**5.5 Enlaces internos dentro del contenido del blog** *(SC-3)* — **6 de 16 posts** llevan URLs absolutas hardcodeadas en la columna `content` (HTML), que ningún redirect de código "limpia":

| Post | Enlace embebido |
|---|---|
| `5-secretos-de-los-roques…`, `blog-enigmas-misterios…`, `secrets-of-los-roques` | `https://www.venezuelavoyages.com/packages/los-roques-2d-1n` |
| `angel-falls-luxury-eco-expedition` (post **EN**) | `…/destinos/canaima` → apunta a la versión **española** del destino |
| `salto-angel-guia-maestra…` | `…/packages/canaima-salto-angel-campamento-categoria-standard` → paquete `is_published=false` → **404 hoy** *(PB-3)* |
| `catatumbo-el-faro-eterno…` | `http://venezuelavoyages.com` (sin https) |

Script de `UPDATE` con reemplazo de patrones sobre `blog_posts.content`. Los 301 los cubren, pero un enlace interno que pasa por redirect diluye autoridad y el de PB-3 sigue roto.

**5.6 `BreadcrumbUI`** *(SC-7)*: imprime los segmentos crudos del pathname (`destinos / canaima`). Tras el rename mostrará `destinations / canaima-national-park` — en inglés pero poco pulido. Cosmético; si se aborda, mapear el último segmento al `name` de la entidad.

**5.7 Search Console**: reenviar sitemap, solicitar indexación de las URLs nuevas, vigilar "Página con redirección" durante 2–4 semanas.

> ✅ Verificado: en Next.js los `redirects()` de `next.config.mjs` se evalúan **antes** del middleware. El `headers()` que inyecta `X-Pathname` (del que dependen el modo mantenimiento, el `ChatWidget` y `BannersSidebar` en `app/layout.js`) no colisiona, y `vercel.json` está vacío. Los 301 no interfieren con la sesión de Supabase.

*Criterio de aceptación*: toda URL del export de Search Console responde 200 o 301 (nunca 404). Verificar con un script de barrido.

---

### Fase 6 — Chatbot y base de conocimiento *(1,5 días)*

> 🔴 **Tres defectos hacen que la KB siga sirviendo español aunque se traduzca la BD** *(RG-4)*.
> Corregirlos **antes** de re-sincronizar, o la re-ingesta reintroduce el español.

**6.0 Arreglar el pipeline de ingesta** — prerequisito de 6.1:

- **`extractDestinations`** (`lib/ai/ingestion/parsers/db.js:24-32`) no filtra **nada**: ni `is_active` ni `language`. Archivar las filas ES con `is_active=false` **no las saca de la KB**. Añadir `.eq("is_active", true).eq("language", "en")`.
  *(`extractServiceInventory` sí filtra `is_published=true`, así que los paquetes ES sí salen solos al archivarlos — la inconsistencia entre ambos extractores es el bug.)*
- **Andamiaje textual en español** en el mismo archivo: `Destino:`, `Ubicación:`, `Highlights:`, `Categorías:`, `Servicio:`, `Precio:`, `Disponible:`, `sin fecha límite`, `Detalles de precio:`, `Detalles:`. Van dentro del embedding y aparecen en las citas del widget. Traducirlos.
- **`ingestKbAction.js:69`**: `const language = input.language || "es"` y la ruta `kb/sync` publica solo `{ type }` → cada re-sync reetiqueta los 59 documentos como `es`. Pasar `language: 'en'` explícito.

**6.1 Re-sincronizar las fuentes de BD** — `POST /api/crm/chatbot/kb/sync` con `db_destinations`, `db_packages`, `db_services`. Como la Fase 4 ya tradujo la BD, los ~50 documentos derivados se regeneran en inglés automáticamente. **Debe correr después de la Fase 4 y de 6.0, nunca antes.**

**6.1-bis Arreglar la URL rota de `searchPackages`** *(PB-2, bug preexistente)*: `lib/ai/tools/searchPackages.js:101-105` construye `/packages/${s.destination.slug}` — un slug **de destino** en la ruta **de paquete**. Ningún paquete se llama "Canaima", así que `/packages/canaima` devuelve 404 y el chatbot manda leads a una página inexistente **hoy**. La ruta correcta es `/packages/destino/<slug>` (o `/packages/destination/<slug>` tras la Fase 5).

**6.2 Documentos corporativos**: subir las versiones EN de los 4 `.docx` (Quiénes somos, T&C, Devolución, Seguridad) por `/dashboard/chatbot/knowledge-base` y marcar los ES como inactivos. Reutilizar la traducción de la Fase 3.

**6.3 Regenerar embeddings**: la re-ingesta llama a Jina v3 (multilingüe, 1 M tokens/mes gratis). ~60 documentos entran holgados en la cuota.

**6.4 Textos de UI del widget** (`components/ChatWidget/*`, 26 strings): mensaje de bienvenida, placeholder, `ConsentDialog`, `ConversationList`, `SourceBadge`.

**6.5 Prompt por defecto a inglés**: `getSystemPrompt({ language })` ya es bilingüe; cambiar el default de `"es"` a `"en"` en `app/api/chatbot/chat/route.js` y `lib/ai/utils.js` (`detectLanguage` se mantiene, para no romper al visitante hispanohablante ocasional).

**6.6 Descripciones de tools** (`lib/ai/tools/*`, ~180 strings en español): **el modelo las lee cada turno y guían el flujo**. Traducirlas es un cambio de comportamiento del agente, no cosmético. Ejecutar **después** del resto y re-correr la suite de 22 escenarios del commit `f849aef` antes de mergear.

*Criterio de aceptación*: el chatbot responde en inglés a un saludo en inglés citando fuentes en inglés; los 22 escenarios de la suite pasan.

---

### Fase 7 — Documentos al cliente *(1,5 días)*

| Archivo | Contenido |
|---|---|
| `lib/pdf/voucher-generator.js` (11) | Etiquetas del voucher PDF |
| `lib/vouchers/schema.js` (11) | Mensajes de validación Zod (visibles al cliente en errores) |
| `lib/vouchers/actions.js` (11) | |
| `lib/email/voucherEmailHtml.js` (4) | Cuerpo del email de voucher |
| `app/api/crm/quotations/[id]/pdf/route.js` (15) | PDF de cotización — el documento comercial principal |
| `app/api/crm/quotations/[id]/send/route.js` (15) | Asunto + cuerpo del email de cotización |
| `lib/actions/crm/quotationActions.js` (33) | Términos, notas al cliente, textos por defecto |
| `data/emailDefaultData.js` | Datos por defecto + ⚠️ **enlace roto**: apunta a `/terms-and-conditions`, ruta que no existe (la real es `/terms-of-service`) *(SC-5 / PB-4)* |
| `lib/email/emailTemplates/*.hbs` (4 plantillas) | Confirmación de email, alta de usuario, reset de contraseña, confirmación de vuelo. ⚠️ **Las 4 siguen diciendo "CHECK-IN VENEZUELA"** en título, `alt` del logo y copyright — el rebranding nunca las tocó *(SC-6)* |
| `components/.../Ticket.jsx` | Ticket de vuelo |

> ✅ **Verificado seguro — el histórico no se toca.** `quotations.items[]` guarda un
> **snapshot completo** (`description`, `unit_price`, `product_details`, `destination_data`,
> `product_images`, `provider_data`) y el generador de PDF
> (`app/api/crm/quotations/[id]/pdf/route.js:724-757`) lee **solo del snapshot**, nunca
> vuelve a consultar `service_inventory`. Traducir o archivar paquetes **no altera** las 23
> cotizaciones existentes ni sus PDFs regenerados. Lo mismo con `vouchers.services`.
> No hace falta decidir nada sobre documentos históricos: son inmutables por diseño.

> Los `.hbs` se compilan con `handlebars-loader` en modo `strict: true` (`next.config.mjs`):
> una variable o helper que falte **rompe el build**, no falla en runtime. Editar con cuidado.

*Criterio de aceptación*: generar una cotización y un voucher de prueba end-to-end; PDF y email 100 % en inglés.

---

### Fase 8 — QA, medición y rollback *(1 día)*

> El **checklist completo de verificación pre-merge** (12 comprobaciones concretas con
> sus queries SQL) está en [`plan-migracion-ingles-regresion.md` §8](./plan-migracion-ingles-regresion.md).
> Lo de abajo es el QA de salida; aquello es la puerta de entrada a cada merge.

**8.1 Barrido automático**: correr `audit-spanish-strings.mjs`; el bloque "1 — Sitio público" debe quedar en **0**, "2 — Data estática" en **0**.

**8.1-bis Sin red de seguridad automatizada**: la suite (`__tests__/`, 3 archivos) cubre conexión a Supabase, operaciones de BD y la API de leads, y **no contiene ninguna aserción sobre strings en español** — no se romperá, pero tampoco detectará nada. Todo el QA de esta migración es manual salvo el barrido de 8.1 y 8.3.

**8.2 QA manual del recorrido completo**:
home → servicios → destino → paquete → formulario de reserva → WhatsApp → chatbot → newsletter → legales → blog

**8.3 Barrido de URLs**: script que pida cada URL del CSV de Search Console y reporte los códigos ≠ 200/301.

**8.4 Verificar analítica**: GA4 y Clarity siguen disparando tras los cambios de ruta (revisar tras el rename, es el punto donde suelen romperse los eventos).

**8.5 Plan de rollback**:
- Código: revert de la rama (Vercel mantiene el deployment anterior → *Instant Rollback*)
- Datos: `UPDATE ... SET is_active = true WHERE language='es'` + revertir el filtro `.eq("language","en")`
- KB: re-sync de las fuentes de BD tras revertir los datos
- Redirects: quitar el bloque `redirects()` de `next.config.mjs`

**8.6 Métricas a 7 y 30 días** contra la línea base de la Fase 0: tasa de rebote, duración de sesión, leads creados, conversaciones de chatbot, impresiones/clics en Search Console.

---

## 5. Orden de Ejecución y Dependencias

```
Fase 0 ─┬─> Fase 1 ─┬─> Fase 2 ──> Fase 3 ─┬──────────────> Fase 8
        │           │                       │
        │           └─> Fase 4 ─┬─> Fase 5 ─┤
        │                       │           │
        │                       └─> Fase 6 ─┤
        └─────────────────────> Fase 7 ─────┘
```

**Dependencias duras**:
- Fase 1.1 (`slug` + listas blancas + `PackageCard`) **en un solo commit atómico** y **antes** de cualquier renombrado de paquete → si no, se rompen URLs
- Fase 4.2 (filas EN creadas) **antes** de Fase 4.5 (filtro `.eq("language","en")`) → invertirlo deja el sitio vacío
- Fase 6.0 (arreglo del pipeline) **antes** de Fase 6.1 (re-sync) → invertirlo reingesta español
- Fase 4 (datos) **antes** de Fase 6 (KB) → si no, se re-ingesta español
- Fase 0.2 (export de Search Console) **antes** de Fase 5 → después ya no está el "antes"
- Fase 5.1 (rename) y 5.2 (redirects) **en el mismo commit** → separarlos es un 404 masivo
- Fase 6.6 (tools) **al final** del bloque de chatbot → cambia el comportamiento del agente

> El desglose commit a commit está en [`plan-migracion-ingles-regresion.md` §7](./plan-migracion-ingles-regresion.md).

**Puede paralelizarse**: Fase 7 (documentos al cliente) es independiente de todo lo demás y puede correr desde el día 1.

---

## 6. Riesgos y Mitigación

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Traducir nombres de paquete cambia URLs y rompe enlaces vivos | 🔴 Alto | Fase 1.1 — columna `slug` estable, desacoplada del nombre |
| **Contenido nuevo del CMS nace invisible** (listas blancas de API + defaults `es`) | 🔴 Alto | Fases 1.1 y 4.6 — `slug`/`language` en las listas blancas + defaults a `"en"`; QA: crear un ítem de prueba y verificar que aparece *(RG-1, RG-5)* |
| **Enlaces de tarjeta rotos** si `PackageCard` sigue derivando el slug del nombre | 🔴 Alto | Commit atómico junto a la migración *(RG-2)* |
| **Traducir `blog_posts.category` vacía el blog sin dar error** | 🟠 Medio | Regla "no traducir claves técnicas" en Fase 4.1 *(RG-3)* |
| **La KB sigue en español** pese a traducir la BD | 🟠 Medio | Fase 6.0 — filtros + andamiaje + `language:'en'` antes del re-sync *(RG-4)* |
| **Páginas de destino quedan en español** por omitir `metadata` JSONB | 🟠 Medio | Fase 4.2 — las 7 claves de `metadata` en alcance *(RG-6)* |
| Pérdida de ranking SEO por rutas nuevas | 🔴 Alto | 301 completos mapeados desde Search Console + canonical + sitemap |
| Traducción automática degrada nombres propios y textos legales | 🟠 Medio | `--dry-run` + revisión humana obligatoria; glosario de términos venezolanos |
| Fallbacks de `data/*.js` en español asoman en incidente de BD | 🟠 Medio | Traducirlos en Fase 3 (no dejarlos para el final) |
| Traducir tool descriptions altera el flujo del chatbot | 🟠 Medio | Fase 6.6 al final + suite de 22 escenarios antes de mergear |
| Cotizaciones PDF ya enviadas con enlaces antiguos | 🟠 Medio | Los 301 cubren el caso; no reemitir documentos históricos |
| Aparece tráfico ES real tras el flip (C7) | 🟡 Bajo | Contenido ES archivado, no borrado; reversible con un `UPDATE` |
| Cuota free-tier de LLM agotada a mitad de la traducción | 🟡 Bajo | Script reanudable por fila; ~2 250 llamadas/día bastan para ~40 filas |

---

## 7. Estimación

| Fase | Días | Tipo de trabajo |
|---|---:|---|
*(Estimación revisada tras el análisis de regresión; el delta está en la última columna.)*

| Fase | Días | Δ vs. estimación inicial | Tipo de trabajo |
|---|---:|---:|---|
| 0 — Preparación y línea base | 0,5 | — | Ops / medición |
| 1 — Fundaciones técnicas | 2,0 | +0,5 | Backend + migraciones (listas blancas, `PackageCard`) |
| 2 — Shell público + landing | 1,0 | — | Frontend |
| 3 — Páginas de contenido y legales | 2,5 | — | Frontend + redacción |
| 4 — Migración de datos Supabase | 3,5 | +1,0 | Datos + revisión humana (`metadata` JSONB, hoteles, reseñas) |
| 5 — Rutas y SEO | 1,5 | +0,5 | Backend + SEO (enlaces internos del blog) |
| 6 — Chatbot y KB | 1,5 | +0,5 | IA / RAG (arreglo del pipeline de ingesta) |
| 7 — Documentos al cliente | 1,5 | — | Backend + plantillas |
| 8 — QA, medición y rollback | 1,0 | — | QA |
| **TOTAL** | **15,0** | **+2,5** | *(rango 13–17 con revisiones)* |

**Hito visible**: al final de la Fase 3 (día ~6) la landing pública está completamente en inglés, aunque el contenido de BD todavía muestre español. Al final de la Fase 4 (día ~9,5) el sitio está funcionalmente en inglés.

---

## 8. Decisiones Pendientes de Confirmar

1. **`/dashboard` se queda en español** — asumido (uso interno). Confirmar.
2. **Testimonios del home** — `FEATURED_REVIEWS` (7 hardcodeados) + `website_reviews` (3 filas). **¿Son reseñas reales de clientes o contenido de relleno?** Determina si se traducen, se sustituyen por reseñas reales en inglés, o se retira la sección. *(Bloquea la Fase 2.)*
3. **Destinos internacionales `flight`/`hotel`** — 7 destinos de hotel están inactivos hoy. ¿Se reactivan (y se traducen) o se dejan archivados?
4. **`/flights` y `/hotels`** — siguen públicas e indexadas con el buscador desactivado. ¿Se traducen o se sacan del sitemap con `noindex`? *(Bloquea la Fase 3.)*
5. **Dominio y URLs** — ¿se mantiene `venezuelavoyages.com` sin prefijo de idioma? (recomendado sí, monolingüe). Verificar además que `www.venezuelavoyages.com` resuelve: 5 posts del blog enlazan con esa forma.

**Ya no son decisiones** (el análisis de regresión las convirtió en obligatorias):

- ~~Idioma por defecto del CMS~~ → **obligatorio** ponerlo en `"en"` (Fase 4.6), o el contenido nuevo nace invisible.
- ~~Cotizaciones y vouchers históricos~~ → **no aplica**: son snapshots JSONB inmutables, la traducción no los alcanza (verificado, OK-1/OK-2).
