# Análisis de Regresión Cross-Aplicación — Migración a Inglés

**Documento compañero de** [`plan-migracion-ingles.md`](./plan-migracion-ingles.md)
**Fecha**: 2026-08-13
**Método**: lectura del código de todos los consumidores afectados + consultas a la BD de producción (no estimaciones)

---

## Resumen del veredicto

| Veredicto | Cantidad |
|---|---:|
| 🔴 **Regresiones que el plan original habría causado** | **6** |
| 🟠 **Contenido/superficie que el plan no contabilizaba** | **7** |
| 🟢 **Verificado seguro** (se auditó y no rompe nada) | **8** |
| ⚪ **Bugs preexistentes** encontrados de paso (no los causa el plan) | **5** |

El plan es viable, pero **tal como estaba escrito habría roto 6 cosas**. Este documento lista cada una, el mecanismo exacto del fallo y el cambio requerido en el plan. La §5 recoge las correcciones ya aplicadas al plan principal.

---

## 1. 🔴 Regresiones que el plan original habría causado

### RG-1 — `POST /api/inventory` y `PATCH /api/inventory/[id]` ignoran columnas nuevas

**Mecanismo.** Ambos endpoints usan **listas blancas explícitas de columnas**:

- `app/api/inventory/route.js:120-145` construye `inventoryData` campo a campo
- `app/api/inventory/[id]/route.js:56-64` itera sobre `allowedFields = [...]`

Ninguna incluye `slug` ni `language`. Consecuencia en cadena:

1. Emma crea un paquete nuevo desde `/dashboard/cms/packages/new`
2. La fila entra con `slug = NULL` y `language = 'es'` (el DEFAULT de la migración)
3. La Fase 4.5 filtra `.eq("language","en")` → **el paquete nunca aparece en el sitio**
4. Con `slug = NULL`, `findPackageBySlug` (ya migrado a columna) tampoco lo resuelve → **404 permanente**
5. Y no entra al sitemap

Es un fallo **silencioso**: sin error, sin log, el paquete simplemente no existe para el público.

**Corrección requerida.** Añadir `slug` y `language` a ambas listas blancas, y en el POST derivar el slug con `generateSlug(body.name)` cuando no venga. Los formularios `dashboard/cms/packages/new` y `[id]` deben enviar `language: "en"` por defecto.

---

### RG-2 — `PackageCard.jsx` seguiría derivando el slug del nombre

**Mecanismo.** `components/pages/packages/components/PackageCard.jsx:14` hace `const slug = generateSlug(packageData.name)` y lo usa en 3 `<Link>`. Si la Fase 1.1 añade la columna `slug` pero no toca este componente, al traducir un nombre:

- El **enlace** apunta a `/packages/<slug-derivado-del-nombre-en-inglés>`
- La **ruta** resuelve por `slug` de columna (el viejo, en español)
- → 404 en cada tarjeta de paquete traducido

Es exactamente el modo de fallo que el comentario de cabecera de `lib/packages/slug.js` documenta que ya ocurrió una vez (commit `e94e6d5`).

**Corrección requerida.** `PackageCard` pasa a `packageData.slug ?? generateSlug(packageData.name)` **en el mismo commit** que la migración. Los cuatro consumidores (`PackageCard`, `/packages/[slug]`, `/packages/[slug]/book`, `/api/packages/[slug]`) tienen que cambiar juntos.

---

### RG-3 — Traducir `blog_posts.category` rompe los filtros del blog

**Mecanismo.** La columna `category` guarda **valores en español que funcionan como clave técnica**, no como etiqueta:

```js
// app/(pages)/blog/page.js:24-31
const ALL_CATEGORIES = [{ key: "destinos", label: "Destinos" }, { key: "tips", ... }, { key: "noticias", ... }]
// :43
q = q.eq("category", category)   // ← compara contra el valor crudo de la BD
// :206
href={`/blog?category=${cat.key}`}   // ← la clave viaja en la URL
```

Si la Fase 4 traduce `category` a `destinations`/`news`:
- Los enlaces `/blog?category=destinos` ya compartidos e indexados devuelven **0 resultados** (no 404 — peor: página vacía sin señal de error)
- El contador de la barra lateral (`allPostsForSidebar.filter(p => p.category === cat.key)`) queda en 0

**Corrección requerida.** **No traducir el valor de `category`.** Traducir solo `label` en `ALL_CATEGORIES`. Regla general para toda la Fase 4: *slugs, keys y valores de enum no se traducen; solo etiquetas*.

Aplica igual a: `destinations.slug`, `catalog_services.slug`, `destination_categories.slug`, `service_inventory.sku`, y todos los `status`/`type` enum.

---

### RG-4 — La KB del chatbot seguiría sirviendo español tras la Fase 6

Tres defectos independientes que se suman:

**(a) `extractDestinations` no filtra nada.** `lib/ai/ingestion/parsers/db.js:24-32` hace `.select(...).limit(500)` sobre `destinations` **sin `is_active` ni `language`**. Archivar las filas ES con `is_active = false` (Fase 4.4) **no las saca de la KB**: el chatbot seguirá recuperando los 27 destinos en español.

> Nota: `extractServiceInventory` sí filtra `is_published = true`, así que los paquetes ES **sí** salen solos al archivarlos. La inconsistencia entre los dos extractores es el problema.

**(b) El andamiaje textual está en español.** El parser envuelve el contenido con etiquetas en español que van al embedding:

```
Destino: {name}   ·   Ubicación: …   ·   Highlights: …   ·   Categorías: …
Servicio: {name}  ·   Precio: …      ·   Disponible: … → sin fecha límite
Detalles de precio: … · Detalles: …
```

Traducir la BD sin traducir el parser produce documentos híbridos: etiquetas en español alrededor de contenido en inglés. Degrada el retrieval y aparece literalmente en las citas del widget.

**(c) La re-sincronización vuelve a etiquetar `es`.** `lib/actions/chatbot/ingestKbAction.js:69` hace `const language = input.language || "es"`, y `app/api/crm/chatbot/kb/sync/route.js` publica solo `{ type }` sin `language`. Cada re-sync deja los 59 documentos marcados `es` otra vez.

**Corrección requerida.** Los tres puntos en la Fase 6: filtros en `extractDestinations`, traducción del andamiaje de `db.js`, y `language: 'en'` explícito en la ruta de sync.

---

### RG-5 — El CMS seguiría creando contenido en español por defecto

**Mecanismo.** Tres defaults apuntan a `es`:

| Archivo | Línea | Valor |
|---|---:|---|
| `app/(pages)/dashboard/cms/destinations/new/page.js` | 42 | `language: "es"` |
| `app/(pages)/dashboard/cms/destinations/[id]/page.js` | 61, 120 | `language: "es"` |
| `app/api/cms/destinations/route.js` | 90 | `body.language === "en" ? "en" : "es"` |

Tras el flip, cada destino nuevo que Emma cree nace invisible para el sitio. El plan lo mencionaba como "decisión pendiente" (§8.5); es en realidad **un cambio obligatorio de la Fase 4**, no una opción.

**Corrección requerida.** Voltear los tres defaults a `"en"` y dejar el selector visible solo si se conserva el modo bilingüe.

---

### RG-6 — Falta traducir el `metadata` JSONB de destinos (el 70 % del contenido de esas páginas)

**Mecanismo.** `app/(pages)/destinos/[slug]/page.js:60-66` renderiza casi toda la página desde `dest.metadata`:

```js
const culturalDesc  = meta.cultural_description
const places        = meta.must_see_places
const experiences   = meta.experiences
const practical     = meta.practical_info
const testimonials  = meta.testimonials
// + meta.gastronomy, meta.lodging
```

La Fase 4.2 del plan listaba `description`, `short_description`, `tags`, `highlights` y los meta SEO — **pero no `metadata`**. Medido en producción:

| Destino ES activo | `metadata` |
|---|---:|
| canaima | 6 601 ch |
| catatumbo | 6 154 ch |
| los-llanos | 5 569 ch |
| isla-la-tortuga | 4 463 ch |
| merida | 4 327 ch |
| isla-margarita | 4 220 ch |
| roraima | 3 742 ch |
| morrocoy | 3 534 ch |
| los-roques | 3 198 ch |

Traducir solo lo que decía el plan habría dejado las páginas de destino **casi enteras en español** con el título en inglés.

**Corrección requerida.** `metadata` entra en el alcance de la Fase 4.2, con sus 7 claves. Ver §3 para el volumen total recalculado.

---

## 2. 🟠 Superficie que el plan no contabilizaba

| # | Hallazgo | Impacto | Dónde encaja |
|---|---|---|---|
| **SC-1** | **`Reviews.js` tiene 7 testimonios hardcodeados en español** (`FEATURED_REVIEWS`, nombres tipo "María Fernanda González") + la tabla `website_reviews` con 3 filas más, ambas visibles en el home | La sección de reseñas del home es 100 % española | Fase 2 (código) + Fase 4 (BD) — **y decisión de negocio: ¿son testimonios reales o de relleno?** Traducir reseñas reales de clientes es delicado |
| **SC-2** | **Tabla `hotels` (4 filas) con descripciones en español** — alimenta la tool `searchHotels` y 5 documentos de la KB | El chatbot describe hoteles en español | Fase 4 (nueva tabla en alcance) |
| **SC-3** | **6 de 16 posts del blog llevan enlaces internos absolutos dentro del HTML de `content`** (`https://www.venezuelavoyages.com/packages/...`, `.../destinos/canaima`) | El renombrado de rutas los deja tras un 301; funcionan, pero conviene actualizarlos | Fase 5 — script de reemplazo en `content` |
| **SC-4** | **`/flights` y `/hotels` siguen públicas y en el sitemap** con `metadata` en español y cuerpo en inglés, aunque el buscador del home está desactivado | Páginas indexables en estado mixto | Fase 3 — o sacarlas del sitemap si se dan por muertas |
| **SC-5** | **`emailDefaultData.js` enlaza a `/terms-and-conditions`**, ruta que no existe (la real es `/terms-of-service`) | Enlace roto en todos los emails transaccionales | Fase 7 |
| **SC-6** | **Las 4 plantillas `.hbs` siguen diciendo "CHECK-IN VENEZUELA"** (título, alt del logo, copyright) — el rebranding no las tocó | Emails con la marca anterior | Fase 7 |
| **SC-7** | **`BreadcrumbUI` imprime los segmentos crudos del pathname** — hoy muestra `destinos / canaima` | Tras el rename mostrará `destinations / canaima-national-park`: en inglés pero feo | Fase 5, cosmético |

---

## 3. Volumen real de traducción (medido)

| Fuente | Caracteres | Notas |
|---|---:|---|
| Destinos ES (`description` + `short_description` + `metadata`) | **47 050** | 9 activos con metadata completa |
| Destinos EN ya existentes | 30 895 | No rehacer |
| Paquetes (`description` + `details` + `pricing_details`) | **49 667** | ~35 000 corresponden a filas ES |
| Blog (16 posts) | **63 517** | ~40 000 son los 11 posts ES |
| Hoteles, reseñas, servicios, categorías | ~4 000 | |
| **Total a traducir (aprox.)** | **~125 000 ch ≈ 35 000 tokens** | |

**Cabe holgadamente en el free tier.** Gemini 2.5 Flash da 250 RPD / 250 K TPM; ~40 filas troceadas entran en una sola sesión. La restricción de presupuesto cero se mantiene sin problema.

---

## 4. 🟢 Verificado seguro (auditado, no rompe)

| # | Qué se auditó | Resultado |
|---|---|---|
| **OK-1** | **Cotizaciones históricas** — `quotations.items[]` guarda **snapshot completo**: `description`, `unit_price`, `product_details`, `destination_data`, `product_images`, `provider_data`. El generador de PDF (`app/api/crm/quotations/[id]/pdf/route.js:724-757`) lee **solo del snapshot**, nunca vuelve a `service_inventory` | ✅ Traducir o archivar paquetes **no altera** las 23 cotizaciones existentes ni sus PDFs regenerados |
| **OK-2** | **Vouchers emitidos** — `vouchers.services` es JSONB congelado con el texto en español ya impreso | ✅ Intacto |
| **OK-3** | **Colisiones de slug de paquetes** — se calculó `generateSlug(name)` sobre los 20 productos: **0 colisiones** | ✅ El índice `UNIQUE` de la Fase 1.1 se puede crear sin conflictos |
| **OK-4** | **Colisiones de slug** en `destinations` (32) y `blog_posts` (16): **0 en ambas** | ✅ |
| **OK-5** | **RLS** — las políticas públicas filtran por `is_active` / `is_published` / `status`, no por columnas de texto. Añadir `language` y `slug` no toca ninguna política | ✅ Migración aditiva sin efectos sobre permisos |
| **OK-6** | **Trigger `log_price_change`** en `service_inventory` — reacciona a cambios de precio, no de texto | ✅ Traducir nombres no genera ruido en `inventory_price_history` |
| **OK-7** | **Tests (`__tests__/`)** — 3 archivos (conexión Supabase, operaciones DB, API de leads). **Ninguna aserción sobre strings en español** | ✅ La suite no se rompe… pero tampoco protege: **no hay red de seguridad automatizada para esta migración** |
| **OK-8** | **Orden de routing en Next.js** — `redirects()` de `next.config.mjs` se evalúa **antes** del middleware. El `headers()` que inyecta `X-Pathname` (usado por `app/layout.js` para modo mantenimiento, `ChatWidget` y `BannersSidebar`) no colisiona; `vercel.json` está vacío | ✅ Los 301 de la Fase 5 no interfieren con la sesión de Supabase ni con la lógica de layout |

---

## 5. ⚪ Bugs preexistentes encontrados (no los causa el plan)

| # | Bug | Evidencia | Recomendación |
|---|---|---|---|
| **PB-1** | **El sitemap no lista ningún paquete** | `app/sitemap.js:66` consulta `service_inventory.select("slug")`; verificado contra producción: `ERROR: column service_inventory.slug does not exist` | Se arregla solo con la Fase 1.1 |
| **PB-2** | **La tool `searchPackages` del chatbot devuelve URLs que dan 404** | `lib/ai/tools/searchPackages.js:101-105` construye `/packages/${s.destination.slug}` — un slug **de destino** en la ruta **de paquete**. Ningún paquete se llama "Canaima", así que `/packages/canaima` → `notFound()`. La ruta correcta sería `/packages/destino/<slug>` | Corregir en la Fase 6; si no, el rename de la Fase 5 lo deja igual de roto |
| **PB-3** | **Enlace muerto en el blog** | El post `salto-angel-guia-maestra...` enlaza a `/packages/canaima-salto-angel-campamento-categoria-standard`, cuyo paquete está `is_published = false` → 404 | Arreglar junto con SC-3 |
| **PB-4** | **Emails apuntan a `/terms-and-conditions`**, ruta inexistente | `data/emailDefaultData.js:31` | Fase 7 (= SC-5) |
| **PB-5** | **`openGraph.locale` contradictorio**: `en_VE` en la raíz, `es_VE` en about/packages/destinos | Ya recogido como C5 en el plan | Fase 1.4 |

---

## 6. Matriz de impacto por flujo de negocio

| Flujo | ¿Lo toca el plan? | Riesgo residual tras las correcciones |
|---|---|---|
| Home → destino → paquete → WhatsApp (**flujo principal de leads**) | Sí — Fases 2, 3, 4, 5 | 🟢 Bajo, con RG-2 y RG-6 corregidos |
| Captura de lead (`LeadCaptureModal` → `POST /api/crm/leads`) | Solo textos | 🟢 Ninguno — el contrato de la API no cambia |
| Chatbot → tools → creación de lead | Sí — Fase 6 | 🟠 Medio: traducir las descripciones de tools **cambia el comportamiento del agente**. Correr la suite de 22 escenarios (`f849aef`) |
| CRM: lead → cotización → PDF → envío | Solo plantillas (Fase 7) | 🟢 Ninguno sobre el histórico (OK-1) |
| Vouchers: emisión → PDF → email | Solo plantillas (Fase 7) | 🟢 Ninguno sobre el histórico (OK-2) |
| CMS: alta/edición de destinos, paquetes, blog | Sí — RG-1, RG-5 | 🔴 **Alto si no se corrigen RG-1 y RG-5** — contenido nuevo nace invisible |
| Módulo de email (bandeja, firmas, plantillas) | No | 🟢 Ninguno |
| Auth / perfil / ajustes de usuario | No | 🟢 Ninguno |
| Stripe / reservas de vuelo y hotel | No | 🟢 Ninguno — 0 reservas en BD, stack latente |
| Analítica (GA4, Clarity, Vercel) | Indirecto (Fase 5) | 🟠 Medio: el rename de rutas parte las series históricas de GA4. Anotar la fecha de corte |
| SEO / indexación | Sí — Fase 5 | 🟠 Medio: mitigado con 301 completos + canonical + reenvío del sitemap |

---

## 7. Orden de commits obligatorio (evita ventanas rotas)

Los cambios acoplados **deben viajar en el mismo commit**, o hay una ventana en la que producción está rota:

**Commit A — slug de paquetes (atómico, 5 archivos)**
```
supabase/migrations/*_inventory_slug.sql   (ALTER + backfill + índice único)
lib/packages/slug.js                       (findPackageBySlug por columna, con fallback por nombre)
components/pages/packages/components/PackageCard.jsx  (usa packageData.slug)
app/api/inventory/route.js                 (POST: slug + language en la lista blanca)
app/api/inventory/[id]/route.js            (PATCH: slug + language en allowedFields)
app/sitemap.js                             (usa la columna slug)
```
> El **fallback por nombre** en `findPackageBySlug` es lo que hace seguro el despliegue: mientras el backfill se propaga, las URLs viejas siguen resolviendo.

**Commit B — columnas `language`** (migración + listas blancas de blog e inventario + defaults del CMS a `"en"`), **antes** de tocar contenido.

**Commit C — filtros `.eq("language","en")`** en las consultas públicas, **después** de que exista la fila EN de cada ES publicada. Nunca antes: dejaría el sitio vacío.

**Commit D — rename de rutas + `redirects()`**, en un solo commit. Rutas nuevas sin redirects = 404 masivo.

**Commit E — KB**: filtros + andamiaje traducido + `language:'en'`, y **después** re-sync. Re-sincronizar antes de esto reingesta español.

---

## 8. Checklist de verificación pre-merge

Comprobaciones concretas, no genéricas:

- [ ] `SELECT count(*) FROM service_inventory WHERE slug IS NULL` → **0**
- [ ] `SELECT slug, count(*) FROM service_inventory GROUP BY slug HAVING count(*) > 1` → **vacío**
- [ ] Crear un paquete de prueba desde el CMS → aparece en `/packages`, en `/sitemap.xml` y su URL resuelve
- [ ] Cada fila `language='es'` con `is_published=true` tiene su gemela `'en'` **antes** de archivarla
- [ ] `GET /api/crm/quotations/<id>/pdf` de una cotización vieja → PDF byte-idéntico al anterior (OK-1)
- [ ] `/blog?category=destinos` sigue devolviendo resultados (RG-3)
- [ ] Barrido de las URLs del export de Search Console → ningún 404
- [ ] `SELECT language, count(*) FROM kb_documents GROUP BY language` → **0 filas `es`** tras la Fase 6
- [ ] Suite de 22 escenarios del chatbot en verde tras traducir las tool descriptions
- [ ] `audit-spanish-strings.mjs`: grupos "1-PUBLIC SITE" y "2-STATIC DATA" a **0**
- [ ] GA4 y Clarity siguen registrando pageviews en las rutas nuevas
- [ ] `npm run build` + `npm run lint` en verde (ojo: `eslint reactNoUnescapedEntities` ya rompió el build una vez con comillas en textos — commit `db51814`)

---

## 9. Correcciones aplicadas al plan principal

| Sección del plan | Cambio |
|---|---|
| Fase 1.1 | Se añade `slug` y `language` a las listas blancas de `/api/inventory` (RG-1) y el cambio de `PackageCard` (RG-2), como parte del mismo commit atómico |
| Fase 4.1 | Regla explícita: **no traducir slugs, keys ni valores de enum**, incluido `blog_posts.category` (RG-3) |
| Fase 4.2 | `destinations.metadata` (7 claves, ~47 K caracteres) entra en alcance (RG-6) |
| Fase 4 (nuevo) | Tablas `hotels` y `website_reviews` añadidas al alcance (SC-1, SC-2) |
| Fase 4 (nuevo) | Defaults `language` del CMS a `"en"` — obligatorio, no opcional (RG-5) |
| Fase 2 | `Reviews.js` con sus 7 testimonios hardcodeados, marcado como decisión de negocio (SC-1) |
| Fase 3 | `/flights` y `/hotels` incluidas o excluidas del sitemap explícitamente (SC-4) |
| Fase 5 | Script de reemplazo de enlaces internos en `blog_posts.content` (SC-3) |
| Fase 6 | Tres correcciones de la KB: filtros, andamiaje, `language:'en'` (RG-4) + fix de `searchPackages` (PB-2) |
| Fase 7 | Branding "CHECK-IN VENEZUELA" en los 4 `.hbs` y enlace roto de `emailDefaultData` (SC-5, SC-6) |
| Nuevo §7 | Orden de commits obligatorio |
| Nuevo §8 | Checklist de verificación pre-merge |
