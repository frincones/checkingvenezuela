# Análisis de Regresión — Cambios en Base de Datos (pre-flight)

**Fecha**: 2026-08-14
**Alcance**: los dos cambios pendientes sobre Supabase
1. Columna `slug` en `service_inventory` (+ backfill + índice único)
2. Traducción **in situ** del contenido de 8 tablas

**Método**: consultas contra la base de **producción** + lectura de los consumidores reales.
Nada de esto es inferencia.

---

## Veredicto

| | |
|---|---:|
| 🟢 Verificado seguro | **7** |
| 🔴 **Bloqueantes** — hay que resolverlos ANTES de traducir | **3** |
| 🟠 Requiere acción durante la ejecución | **2** |
| ⚪ Bugs preexistentes descubiertos | **3** |

**El cambio 1 (columna `slug`) es seguro y se puede aplicar hoy.**
**El cambio 2 (traducción) NO se puede lanzar tal cual**: produciría ~15 entidades duplicadas
en el sitio público. Los tres bloqueantes son de datos, no de código, y se resuelven con una
decisión de Emma más un script de deduplicación.

---

## 🟢 Verificado seguro

| # | Qué se verificó | Resultado |
|---|---|---|
| **S1** | **Colisiones de slug de paquetes** — se calculó `generateSlug(name)` sobre los **20** productos (todos `product_type='package'`) | **0 colisiones, 0 slugs vacíos** → el índice `UNIQUE` parcial se puede crear sin conflicto |
| **S2** | **Trigger `log_price_change`** en `service_inventory` | Solo dispara `IF OLD.cost_price IS DISTINCT FROM NEW.cost_price OR OLD.sale_price IS DISTINCT FROM NEW.sale_price`. La traducción **no toca precios** → no contamina `inventory_price_history` (15 filas hoy) |
| **S3** | **Triggers `updated_at`** (6 tablas, `BEFORE UPDATE`) | Se dispararán y refrescarán `updated_at`. Efecto: el `lastModified` del sitemap se actualiza para todo el contenido traducido. **Es lo deseable**, no una regresión |
| **S4** | **Cotizaciones históricas** — 22 de 23 referencian `inventory_id`; **11 paquetes distintos**; **0 referencias colgadas** | Los `items[]` son snapshot congelado (`description`, `product_details`, `destination_data`, `product_images`). El PDF lee solo del snapshot. Traducir **no altera ninguna cotización emitida** |
| **S5** | **RLS** | Las políticas filtran por `is_active` / `is_published` / `status`, nunca por texto. El script usa `service_role` (bypass). Añadir una columna no toca ninguna política |
| **S6** | **Claves foráneas** | La traducción no toca ningún `id`. `service_inventory.destination_id`, `category_id`, `provider_id`, `blog_posts.destination_id` intactos |
| **S7** | **Índices existentes** | Ninguno es funcional sobre texto traducido. El `gin_trgm` está en `kb_chunks`, que se regenera aparte |

---

## 🔴 Bloqueantes — resolver ANTES de traducir

### B1 — La traducción in situ crearía **15 entidades duplicadas** en el sitio

El sitio ya tiene contenido en inglés creado a mano. Traducir la fila española **en su sitio**
produce dos filas con el mismo contenido.

**Destinos — 5 pares** (los 5 EN y los 9 ES están **todos activos hoy**, o sea que el home ya
muestra los dos idiomas mezclados):

| Fila ES (se traduciría a…) | Fila EN que ya existe | Colisión |
|---|---|---|
| `canaima` → "Canaima National Park" | `en-canaima-national-park` "Canaima National Park" | **nombre idéntico** |
| `los-roques` → "Los Roques Archipelago" | `los-roques-archipelago` | **nombre idéntico** |
| `roraima` → "Mount Roraima" | `mount-roraima` | **nombre idéntico** |
| `isla-la-tortuga` → "La Tortuga Island" | `la-tortuga-island` | **nombre idéntico** |
| `catatumbo` → "Catatumbo Lightning" | `catatumbo-lightning-venezuela` | **nombre idéntico** |

**Paquetes — 4 pares con el MISMO precio, ambos publicados** (o sea: ya se están mostrando
duplicados en el sitio ahora mismo, en dos idiomas):

| ES (publicado) | EN (publicado) | Precio |
|---|---|---:|
| Trekking al Tepuy Roraima. El Mundo Perdido 10 D / 9 N | Mount Roraima Tepuy Trekking: The Lost World | **$1254 ambos** |
| Glamping Premium en Isla de La Tortuga | Premium Geodesic Glamping: La Tortuga Island | **$615 ambos** |
| CANAIMA & CATATUMBO: EXPEDICIÓN FENÓMENOS NATURALES | CANAIMA & CATATUMBO: NATURAL PHENOMENA EXPEDITION | **$2708 ambos** |
| Los Roques 2D/1N | Los Roques Express Getaway (2D/1N) | **$633 ambos** |

**Blog — 5 pares:**

| ES | EN |
|---|---|
| `viajes-seguros-venezuela` | `safe-travel-venezuela` |
| `salto-angel-guia-maestra-para-tocar-el-cielo…` | `angel-falls-luxury-eco-expedition` |
| `blog-enigmas-misterios-los-roques-2026` | `secrets-of-los-roques` |
| `los-roques-la-tortuga-2026-guia-vip` | `los-roques-archipelago-la-tortuga-island-2026-vi` |
| `los-roques-sin-palmeras` | `los-roques-the-secret-behind-the-paradise-withou` |

**Acción requerida (antes del `--apply`)**: para cada par, **no traducir la fila ES**; en su
lugar desactivarla (`is_active=false` / `is_published=false` / `status='draft'`).
**Nunca `DELETE`** — 11 paquetes están referenciados por cotizaciones (S4).

> El script `translate-db.mjs` debe llevar esta lista de 14 pares **codificada como exclusión**,
> y abortar si detecta un par no listado (mismo precio + mismo destino, o títulos equivalentes).

### B2 — Dos pares ambiguos que necesitan decisión de Emma

No los puedo resolver yo: los precios **no coinciden**, así que pueden ser el mismo producto
con una actualización de precio, o dos productos distintos.

| ES | EN | Diferencia |
|---|---|---|
| Parque Nacional Canaima y Salto Ángel \| Categoría Superior — **$1595** (pub) | Canaima National Park & Angel Falls \| Premium Category — **$1639** (pub) | $44 |
| Canaima - Salto Ángel \| Campamento Categoría Standard — **$1210** (no pub) | Canaima National Park / Standard Comfort Package — **$1388** (pub) | $178 |

**¿Son el mismo paquete o dos categorías distintas?** El segundo par es menos urgente (el ES
está despublicado). El primero **sí está duplicado en el sitio ahora mismo**.

### B3 — Re-sincronizar la KB **duplica** los documentos, no los reemplaza

`lib/ai/ingestion/pipeline.js:130-155`: `ingestDocuments` hace upsert por
`(source_id, content_hash)`. Al traducir, **el hash cambia** → se **inserta un documento nuevo**
y el español **se queda para siempre**. No hay ningún `DELETE` de documentos huérfanos (solo se
borran los *chunks* del documento que ya existía).

Estado actual y resultado de un re-sync sin corregir esto:

| Fuente | Docs hoy | Tras re-sync |
|---|---:|---:|
| `db_destinations` | 29 | 29 ES + ~18 EN |
| `db_packages` | 12 | 12 ES + ~15 EN |
| `db_services` | 10 | 10 ES + 9 EN |
| `manual` (hoteles) | 4 | 4 ES + 4 EN |
| `docx` (4 corporativos) | 4 | 4 ES + 4 EN |
| **TOTAL** | **59 (100 % `es`)** | **~110, la mitad español obsoleto** |

El chatbot recuperaría contenido español y precios viejos de la mitad de su índice.

**Acción requerida**: purgar los documentos de la fuente **antes** de re-ingestar —
`DELETE FROM kb_documents WHERE source_id = <id>` (los `kb_chunks` caen por `ON DELETE CASCADE`)
— o añadir esa purga a `ingestKbAction` para las fuentes `db_*`.

---

## 🟠 Acción durante la ejecución

### E1 — El backfill del `slug` debe hacerse desde Node, no con `unaccent`

El SQL que propuse usa `unaccent()`, que exige `CREATE EXTENSION`. Aunque esté disponible, su
normalización **no es idéntica** a `lib/packages/slug.js` (que usa `NFD` + strip de diacríticos
en JavaScript). Una diferencia de un carácter cambia una URL.

**Hacerlo desde Node importando el `generateSlug` real** garantiza paridad byte a byte.
Verificación obligatoria antes de crear el índice:

```sql
SELECT count(*) FROM service_inventory WHERE slug IS NULL;                       -- → 0
SELECT slug, count(*) FROM service_inventory GROUP BY slug HAVING count(*) > 1;  -- → vacío
```

### E2 — Actualizar `destinations.language` de las filas traducidas

La columna tiene `CHECK (language IN ('es','en'))`. Si se traduce una fila ES en su sitio y se
deja `language='es'`, la clasificación del admin queda mintiendo. El `UPDATE` de traducción debe
incluir `language='en'`.

> Verificado: **ninguna consulta pública filtra por `language` hoy** (por eso el home muestra
> los dos idiomas mezclados). Cambiar el valor no rompe nada — solo corrige la etiqueta.

---

## ⚪ Bugs preexistentes descubiertos en esta revisión

| # | Bug | Evidencia |
|---|---|---|
| **P1** | **El sitio ya muestra contenido duplicado en dos idiomas.** 4 paquetes con precio idéntico y 5 destinos con nombre equivalente están publicados a la vez | Consulta a producción, ver B1 |
| **P2** | **`searchDestinations` no filtra `is_active`.** El chatbot puede ofrecer los 12 destinos desactivados (hoteles de Cancún, Punta Cana, Miami… todos `is_active=false`) | `lib/ai/tools/searchDestinations.js:56-70` — no hay `.eq("is_active", true)` |
| **P3** | La KB nunca purga documentos obsoletos, aunque el contenido de origen cambie | `lib/ai/ingestion/pipeline.js` (= B3) |

---

## Plan de ejecución corregido

**Paso 1 — Columna `slug`** ✅ *seguro, aplicable ya*
Migración aditiva + backfill desde Node + índice único + `PackageCard` + listas blancas de la
API. Sin dependencia de las decisiones de abajo.

**Paso 2 — Decisión de Emma sobre B2** (2 pares ambiguos de Canaima).

**Paso 3 — Deduplicación** *(antes de traducir)*
Desactivar las 14 filas ES que ya tienen gemela EN. Solo `UPDATE`, nunca `DELETE`.
Esto **por sí solo ya arregla P1**, con lo que el sitio mejora aunque no se traduzca nada más.

**Paso 4 — Traducción in situ** de lo que queda:
~13 destinos, ~10 paquetes, 11 posts, 9 servicios, 6 categorías, 3 proveedores, 4 hoteles,
3 reseñas — con `--dry-run` → revisión humana → `--apply`, y `language='en'` en destinos.

**Paso 5 — KB**: purgar `kb_documents` de las 4 fuentes `db_*`/`manual`, arreglar el filtro
`is_active` de los extractores, traducir el andamiaje del parser, y **entonces** re-sincronizar.

**Rollback**: snapshot de Supabase antes del paso 3. Los pasos 3 y 4 son `UPDATE`s sobre filas
identificables; el 5 se rehace re-sincronizando.
