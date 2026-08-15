# Estado de ejecución — Flip a inglés

**Rama**: `feat/english-flip` · **Actualizado**: 2026-08-14

---

## Resumen

| Fase | Estado |
|---|---|
| Código — 45 archivos traducidos | ✅ Hecho (build exit 0, lint sin errores) |
| Respaldo de las 10 tablas que mutan | ✅ `backups/english-flip-20260814-2305/` |
| **Fase 1a** — columna `slug`: migración + código | ✅ Hecho |
| **Fase 1b** — aplicar el DDL + backfill | ⛔ **Bloqueado: requiere Emma** |
| **Fase 2** — decisión B2 | ✅ Se conserva el inglés |
| **Fase 3** — deduplicación ES/EN | ✅ Aplicado (37 operaciones) |
| **Fase 4** — traducción de la BD | 🟡 Dry-run en curso |
| **Fase 5** — KB: extractores, purga, tools | ✅ Código hecho · re-sync pendiente |

---

## ⛔ Lo único que necesita tu mano

**Supabase no expone `exec_sql`**, así que el DDL hay que pegarlo en el Dashboard.
Son 3 líneas:

1. Abrir **Supabase → SQL Editor**
2. Pegar el contenido de [`supabase/migrations/20260814_inventory_slug.sql`](../supabase/migrations/20260814_inventory_slug.sql)
3. Ejecutar
4. Avisarme, y yo corro:
   ```
   node scripts/english-flip/01-backfill-slugs.mjs           # dry-run
   node scripts/english-flip/01-backfill-slugs.mjs --apply
   ```

Hasta entonces el sitio funciona igual: `findPackageBySlug` detecta que la columna
no existe y cae al match por nombre de siempre. **Nada está roto mientras tanto.**

Mientras la columna no exista, el script de traducción **no toca
`service_inventory.name`** — lo detecta solo y se lo salta, porque el nombre define
la URL del paquete.

---

## Fase 3 — deduplicación (aplicada y verificada)

37 operaciones, todas `UPDATE`. **Cero `DELETE`**: 11 paquetes están referenciados
por cotizaciones emitidas.

| | Antes | Después |
|---|---:|---:|
| Destinos Venezuela activos | 14 (9 es + 5 en, duplicados) | **9** (4 es + 5 en) |
| Paquetes publicados | 15 | **11** |
| Posts publicados | 16 | **11** |
| Paquetes apuntando a un destino inactivo | — | **0** |

Lo que hizo, en orden (el orden importaba):

1. **Heredó `display_order`** de la fila ES a la EN — si no, los 5 destinos en
   inglés quedaban todos en orden 0 y el home los mostraba desordenados.
2. **Repuntó `destination_id`** de 9 paquetes y 8 posts del destino ES al EN — si
   no, las páginas de destino en inglés se quedaban sin paquetes.
3. **Desactivó** los 5 destinos ES duplicados.
4. **Descontinuó** 6 paquetes ES (`is_published=false`, `status='discontinued'`),
   incluidos los 2 del caso B2.
5. **Pasó a borrador** 5 posts ES.

> Efecto colateral bueno: esto **ya arregla el duplicado que había en producción**
> — 4 paquetes se mostraban dos veces al mismo precio en dos idiomas.

---

## Fase 5 — arreglos de la KB (código hecho)

| Arreglo | Archivo |
|---|---|
| `extractDestinations` no filtraba `is_active` → indexaba destinos desactivados y archivados | `lib/ai/ingestion/parsers/db.js` |
| Andamiaje del RAG en español (`Destino:`, `Precio:`, `Disponible:`…) — va dentro del embedding | `lib/ai/ingestion/parsers/db.js` (23 cadenas) |
| **La re-ingesta duplicaba en vez de reemplazar**: upsert por `content_hash`, el doc viejo quedaba huérfano | `lib/actions/chatbot/ingestKbAction.js` (purga previa para fuentes `db_*`) |
| El re-sync reetiquetaba todo como `es` | `app/api/crm/chatbot/kb/sync/route.js` (`language: "en"`) |
| `searchPackages` devolvía `/packages/<slug-de-destino>` → **404 en producción hoy** | `lib/ai/tools/searchPackages.js` |
| `searchDestinations` ofrecía destinos desactivados | `lib/ai/tools/searchDestinations.js` |

**Pendiente tras desplegar** (`node scripts/english-flip/04-kb-status.mjs` lo lista):

- Re-sincronizar `db_destinations`, `db_packages`, `db_services` desde
  `/dashboard/chatbot/knowledge-base` — la purga ya es automática
- `node scripts/english-flip/04-kb-status.mjs --purge-manual` para los 4 docs de
  hoteles (esa fuente quedó como `type='manual'` y no tiene ruta de re-sync)
- Subir la versión **en inglés** de los 4 `.docx` corporativos

---

## Scripts

| Script | Qué hace |
|---|---|
| `00-backup.mjs` | Exporta a JSON las 10 tablas que mutan. **El rollback de datos** |
| `01-backfill-slugs.mjs` | Backfill de `service_inventory.slug` con el `generateSlug` real |
| `02-dedupe.mjs` | Deduplicación ES/EN. Los pares van codificados y aborta si no cuadran |
| `03-translate-db.mjs` | Traducción in situ. Cadena de LLM gratuitos, `--dry-run` / `--apply` |
| `04-kb-status.mjs` | Informe de la KB + purga de la fuente `manual` |

Todos aceptan dry-run por defecto y solo escriben con `--apply`.

**Proveedor de traducción**: la key de Gemini está **sin créditos** y
`gpt-oss-120b` dejó de ser gratis en OpenRouter. La cadena efectiva es
`nvidia/nemotron-3-super-120b:free` → `groq/llama-3.3-70b` → `groq/llama-3.1-8b`.
Coste: 0.

---

## Rollback

- **Código**: `git checkout dev` (nada commiteado todavía)
- **Datos**: `backups/english-flip-20260814-2305/*.json` tiene el estado previo
  completo de las 10 tablas
- **Dedup**: todo fue `UPDATE` sobre filas identificables, reversible
- **KB**: se rehace re-sincronizando
