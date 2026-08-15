# Plan LEAN — Flip a inglés en 4–5 días

**Sustituye a** [`plan-migracion-ingles.md`](./plan-migracion-ingles.md) como ruta recomendada.
Ese documento sigue siendo válido como **inventario y análisis**; lo que cambia es la estrategia.
El [análisis de regresión](./plan-migracion-ingles-regresion.md) sigue vigente casi entero (ver §5).

---

## 0. Por qué el plan anterior costaba 15 días

Tres decisiones, ninguna pedida por el negocio:

| Decisión | Coste | ¿Para qué servía? |
|---|---:|---|
| Abstracción i18n (`lib/i18n/en.js` + `t()` en ~43 archivos) | ~3 días | Poder volver al español algún día |
| Modelo "una fila por idioma" (columnas `language`, filtros, duplicados) | ~4 días + **doble mantenimiento del CMS para siempre** | Ídem |
| Renombrar rutas `/destinos` → `/destinations` + mapa de 301 | ~1,5 días + riesgo SEO | Cosmética de URL |
| Traducción con revisión línea a línea de 125 K caracteres | ~2 días extra | Calidad |

**Los tres primeros son seguro contra un riesgo que el negocio ya descartó.** Si la audiencia es
100 % inglesa y no va a volver el español, ese seguro cuesta 8,5 días y deja deuda permanente.

La versión sin seguro: **traducir en sitio**. Sin diccionario, sin columnas de idioma, sin filas
duplicadas. El rollback no es una capa de arquitectura — es **git + un snapshot de Supabase**.

---

## 1. Los atajos que NO funcionan (investigados, descartados)

Antes de recortar hay que descartar la tentación obvia: "que un servicio lo traduzca solo".

### ❌ Widget de Google Translate

**Descontinuado para sitios comerciales desde diciembre de 2019.** Desde 2020 solo está
disponible para organizaciones gubernamentales, sin ánimo de lucro y académicas. No es una opción.

### ❌ Widget JS de traducción en el cliente (Elfsight y similares)

Traducen el DOM **después** de que carga la página. Google indexa el HTML original — es decir,
**el español**. Para este negocio eso es fatal: el tráfico llega por búsqueda orgánica, y el
propio esfuerzo de SEO del repo (sitemap, `meta_title`/`meta_description` por fila, canonical,
Search Console, verificación de Yandex) quedaría trabajando para posicionar contenido en español.

Es exactamente la crítica documentada del widget: *"no actual multilingual SEO capabilities"*,
frente a las soluciones que renderizan en servidor.

### ❌ Proxy de traducción (Weglot, Linguise, Verbi)

Técnicamente sí resuelve el SEO — renderizan en servidor, generan hreflang y sitemaps. Dos
razones lo descartan **para este caso concreto**:

1. **Presupuesto.** Weglot arranca en **€15/mes** y su plan gratuito cubre **2 000 palabras**.
   Solo el contenido de BD de este sitio son ~125 000 caracteres ≈ **20 000 palabras**, sin
   contar la UI. El tier realista es el de €79/mes. La restricción del proyecto es coste cero.
2. **Alquilas tu propio sitio.** El proxy sirve las traducciones desde sus servidores en cada
   request: *"when you stop paying, your multilingual site stops working and you lose everything"*.
   Meter una dependencia de pago mensual en la ruta crítica de renderizado de un negocio con
   presupuesto cero es un riesgo estructural, no un ahorro.

### ✅ Lo que sí aplica

El propio ecosistema i18n admite que envolver todo en `t()` es *"weeks of work, touching every
component"*. Ese diagnóstico es la confirmación de que **la capa i18n es el gasto, no la
traducción**. Si nunca vas a tener dos idiomas, no pagues esa capa.

---

## 2. La estrategia LEAN

> **Traducir en sitio, con LLM + revisión humana. Cero abstracción nueva.**

| Superficie | Plan anterior | Plan LEAN |
|---|---|---|
| Textos de UI | Extraer a `lib/i18n/en.js` + `t()` en 43 archivos | **Reemplazo literal en sitio**. `"Nuestros Servicios"` → `"Our Services"` |
| Contenido de BD | Columna `language`, filas EN duplicadas, filtros en 12 consultas, defaults del CMS | **`UPDATE` en sitio**. Una sola fila por entidad |
| Rutas | Renombrar + mapa de 301 | **No se tocan.** `/destinos/canaima` se queda |
| Rollback | Reversible por diseño (filas ES archivadas) | **git revert + restore del snapshot** |
| Mantenimiento futuro del CMS | ×2 (dos idiomas) | ×1 |

**Sobre no renombrar las rutas**: `/destinos/` en la barra de direcciones es lo único que queda
en español, y **el visitante prácticamente no lo lee**. A cambio te ahorras 1,5 días, el mapa de
redirects, el riesgo de perder ranking y los 6 posts con enlaces internos hardcodeados. Si algún
día el SEO lo justifica, se hace por separado — es un cambio independiente y aislado.

---

## 3. El plan, día a día

### Día 0 — Preparación y congelado de URLs *(medio día)*

1. **Snapshot de Supabase** (`pg_dump` o snapshot del proyecto). **Este es el rollback de datos.**
   Sin esto no hay marcha atrás — no lo saltes.
2. Rama `feat/english-flip` desde `dev`.
3. **Columna `slug` en `service_inventory` + backfill** — el commit A del documento de cambios.
   **No es ceremonia de i18n: es integridad de datos.** Sin esto, traducir el nombre de un
   paquete cambia su URL en silencio y rompe cada enlace vivo. 2 horas.
4. Baseline en GA4 (idioma de navegador y país) para poder medir el efecto después.

### Día 1 — Contenido de BD *(1 día)*

Script `scripts/translate-db.mjs` que recorre las tablas y traduce en sitio, usando la cadena
de fallback gratuita ya configurada en `lib/ai/providers.js` (Gemini 2.5 Flash → Nemotron →
gpt-oss). ~125 K caracteres ≈ 35 K tokens: entra de sobra en el free tier en una sesión.

```
--dry-run   → escribe traducciones/YYYY-MM-DD.json
(revisión humana del JSON)
--apply     → UPDATE fila a fila
```

**Alcance por tabla:**

| Tabla | Campos |
|---|---|
| `destinations` (18 ES activos) | `name`, `short_description`, `description`, `tags[]`, `highlights[]`, `meta_title`, `meta_description`, **`metadata` JSONB** (7 claves: `cultural_description`, `must_see_places`, `experiences`, `practical_info`, `testimonials`, `gastronomy`, `lodging`) |
| `service_inventory` (14 ES) | `name`, `description`, `meta_title`, `meta_description`, **`details` JSONB** (`includes`, `not_includes`, `itinerary`, `schedule`, `recommendations`, `important_notes`) |
| `blog_posts` (11 ES) | `title`, `excerpt`, `content`, `meta_title`, `meta_description`, `tags[]` |
| `catalog_services` (9) | `name`, `description` |
| `destination_categories` (6) | `name`, `subtitle` |
| `tourism_providers` (3) | `description` |
| `hotels` (4) | `description` |
| `website_reviews` (3) | `title`, `comment` — *decisión de negocio previa: ¿reales o relleno?* |

**Lista de exclusión (traducir esto rompe cosas):**

```
slug          ← claves de URL en todas las tablas
sku           ← referencia con proveedores
category      ← blog_posts: viaja en /blog?category=destinos
status, type  ← todos los enums
```

**Duplicados EN que ya existen**: 5 destinos, 6 paquetes y 5 posts se crearon a mano en inglés.
Antes de traducir, **borrar o despublicar la fila ES gemela** para no quedarse con dos versiones
de lo mismo. Es un `UPDATE ... SET is_active = false` sobre una lista de 16 slugs conocidos
(están en `plan-migracion-ingles.md` §1.3).

**Revisión humana obligatoria** sobre nombres propios: Salto Ángel → Angel Falls, tepuy, curiara,
Mukumbarí, chigüire, Gran Roque. Y sobre precios e itinerarios (números y fechas), donde un error
de traducción es un error comercial.

### Día 2 — Textos de UI en sitio *(1 día)*

Reemplazo literal en los 43 archivos del grupo "sitio público" + los 3 de `data/`
(~277 strings). Sin `t()`, sin diccionario:

```diff
-          title="Nuestros Servicios"
-          subTitle="Todo lo que necesitas para tu viaje perfecto"
+          title="Our Services"
+          subTitle="Everything you need for the perfect trip"
```

Orden por impacto: home (`ServicesSection`, `VenezuelaDestinations`, `Popular*`, `Reviews`) →
`DualCTA` + `LeadCaptureModal` + `useLeadCapture` (los CTA de WhatsApp) → `/packages` →
`/destinos/[slug]` → `/blog` → `QuickLinks` (enlaces legales) → `data/*.js`.

Los 3 archivos de `data/` **no son opcionales**: son el fallback que se renderiza si Supabase
falla. En español, un incidente de BD devuelve la landing al español.

> **Al final de este día, cualquiera que entre ve todo en inglés.** Lo que queda son
> integraciones que el visitante no ve en la primera visita.

### Día 3 — Legales, chatbot y documentos *(1 día)*

- **Páginas legales** (4 páginas, ~50 strings) desde los `.docx` de la raíz. Redacción, no código.
- **KB del chatbot** — sin esto responde en inglés citando fuentes en español:
  - `extractDestinations` no filtra ni por `is_active`: añadir el filtro *(bug real, RG-4a)*
  - Traducir el andamiaje del parser (`Destino:` → `Destination:`, `Precio:` → `Price:`…) — va dentro del embedding
  - Pasar `language: 'en'` en la ruta de sync, o cada re-sync reetiqueta los 59 documentos como `es`
  - Re-sincronizar las 3 fuentes de BD + subir los 4 `.docx` en inglés
- **Chatbot**: default de idioma a `"en"`, UI del widget (26 strings), y el fix de la URL rota de
  `searchPackages` — hoy manda leads a un 404.
- **Documentos al cliente**: PDF de cotización, voucher, plantillas `.hbs` (que además siguen
  diciendo "CHECK-IN VENEZUELA") y el enlace roto a `/terms-and-conditions`.

### Día 4 — QA *(1 día)*

- Barrido con `audit-spanish-strings.mjs`: grupos "1-PUBLIC SITE" y "2-STATIC DATA" a 0
- Recorrido manual: home → destino → paquete → reserva → WhatsApp → chatbot → blog → legales
- Crear un destino y un paquete de prueba desde el CMS y verificar que salen bien
- `npm run build` + `npm run lint`
- Verificar que GA4 y Clarity siguen disparando

**Total: 4,5 días.** Con margen realista, **5–6**.

---

## 4. Qué pierdes al recortar (y por qué se puede vivir con ello)

| Pierdes | Mitigación | ¿Duele? |
|---|---|---|
| Volver al español "con un `UPDATE`" | Snapshot de Supabase + git. Restaurar es una operación de 10 min sobre una copia | No, si el snapshot se hace bien |
| Un sitio central para cambiar copy | `grep` + editar. Con un equipo de una persona es equivalente | No |
| URLs en inglés (`/destinations/…`) | Se puede hacer después, aislado | Cosmético |
| Traducción pulida al 100 % en el día 4 | El texto queda publicado y se refina sobre la marcha | No — el contenido vivo se edita desde el CMS |

**El riesgo real que asumes**: si dentro de 6 meses aparece tráfico hispanohablante y hay que
volver, no es un `UPDATE` — es rehacer la traducción inversa. Por eso el snapshot del día 0 es
innegociable: convierte "rehacer" en "restaurar".

---

## 5. Qué queda del análisis de regresión

La estrategia cambia; los bugs no. De los 6 hallazgos:

| # | Estado en el plan LEAN |
|---|---|
| **RG-1** — listas blancas de la API | **Parcial.** La parte `language` desaparece (no hay columna). La parte **`slug` sigue siendo crítica**: sin ella, cada paquete nuevo nace con `slug NULL` → 404 |
| **RG-2** — `PackageCard` deriva el slug del nombre | 🔴 **Sigue vigente.** Mismo commit que la columna `slug` |
| **RG-3** — traducir `blog_posts.category` vacía el blog | 🔴 **Sigue vigente.** Está en la lista de exclusión del día 1 |
| **RG-4** — la KB sigue en español | 🟠 **Sigue vigente** (día 3), menos el filtro de idioma |
| **RG-5** — defaults del CMS a `es` | ✅ **Desaparece.** No hay columna `language` que envenenar |
| **RG-6** — falta el `metadata` JSONB de destinos | 🔴 **Sigue vigente.** Es volumen de contenido, no arquitectura — está en el alcance del día 1 |

Los 8 puntos verificados como seguros (cotizaciones y vouchers históricos inmutables, cero
colisiones de slug, RLS, trigger de precios, orden de routing) **siguen siendo válidos**.

Los 5 bugs preexistentes siguen ahí: dos de ellos (**paquetes fuera del sitemap** y **el chatbot
enviando leads a un 404**) se arreglan de paso en los días 0 y 3.

---

## 6. Comparativa final

| | Plan completo | **Plan LEAN** |
|---|---:|---:|
| Días de trabajo | 13–17 | **4,5–6** |
| "Todo el mundo ve inglés" | día ~9,5 | **día ~2** |
| Coste en dinero | 0 € | **0 €** |
| Mantenimiento del CMS después | ×2 idiomas | **×1** |
| Reversibilidad | Por diseño (`UPDATE`) | Snapshot + git |
| Riesgo SEO | Medio (rename + 301) | **Bajo** (no se tocan URLs) |
| Dependencias nuevas | 0 | **0** |

**Recomendación**: LEAN. El plan completo solo se justifica si vuelve a haber audiencia
hispanohablante — y esa es justamente la premisa que el negocio descartó.

---

## 7. Herramientas open source: qué existe y por qué no encaja

Se revisó el ecosistema OSS buscando algo que hiciera esto de forma automática. **No existe una
herramienta que traduzca strings hardcodeados en sitio.** Todo el tooling asume que quieres i18n:

| Herramienta | Qué hace | Por qué no sirve aquí |
|---|---|---|
| [`i18n-ai-translate`](https://github.com/taahamahdi/i18n-ai-translate) (99★) | Traduce con LLM archivos i18next JSON, `.po`, `.properties`, `.strings`. Soporta Ollama local | **Solo toca archivos de i18n.** No lee JS/JSX. Requiere tener ya la capa i18n |
| [`languine`](https://github.com/languine-ai/languine) | CLI de traducción con IA | Ídem: parte de archivos de traducción |
| [`i18n-translator`](https://github.com/ankurrokad/i18n-translator) | Traduce JSON de next-i18next/nestjs-i18n | Ídem |
| [`react-auto-intl`](https://github.com/edspencer/react-auto-intl) | Extrae strings de JSX y **los reemplaza por llamadas `t()`** | Hace justo lo que decidimos **evitar**: instala la capa i18n de 3 días |
| `i18next-cli localize` | "de hardcoded a localizado en un comando": envuelve en `t()`, extrae claves, traduce vía Locize | Ídem + servicio de pago (Locize) |
| [`loctool`](https://github.com/iLib-js/loctool), [`xtexts`](https://github.com/Icelandair/xtexts), `react-gettext-parser` | Escanean código y escriben ficheros de recursos | Ídem, con gettext |

**Diagnóstico**: todos resuelven "quiero N idiomas". Ninguno resuelve "quiero cambiar
permanentemente de idioma". Es un caso raro, y por eso no hay herramienta — el camino de todos
pasa por extraer a JSON, que es exactamente el gasto que queremos evitar.

### Complementos OSS que sí aportan

| Herramienta | Uso real aquí |
|---|---|
| [**LibreTranslate**](https://github.com/LibreTranslate/LibreTranslate) + [**Argos Translate**](https://github.com/argosopentech/argos-translate) (MIT) | API de traducción **self-hosted, offline, ilimitada y gratis** (`pip install libretranslate`). Red de seguridad si se agota el free tier de Gemini/Groq. Calidad inferior a un LLM en copy de marketing → usar como fallback, no como principal |
| **ast-grep** / `jscodeshift` | Localizar con precisión texto JSX y string literals para el reemplazo, y verificar que no queda nada |
| `scratchpad/audit-spanish-strings.mjs` | Medir el avance: los grupos "1-PUBLIC SITE" y "2-STATIC DATA" deben llegar a 0 |

---

## 8. La forma más fácil, en concreto

**La herramienta ya la tienes: Claude Code.** Edita los 43 archivos directamente, sin capa i18n,
sin dependencias nuevas y con mejor calidad que la traducción automática en copy de marketing.
El trabajo se reduce a 3 pasos:

### Paso 1 — Congelar URLs *(2 h, una sola vez)*

Aplicar el **commit A** de [`plan-migracion-ingles-cambios.md`](./plan-migracion-ingles-cambios.md):
columna `slug` + backfill + `PackageCard` + listas blancas. Es lo único que hay que hacer *antes*
de traducir. También arregla el sitemap.

### Paso 2 — Código, por tandas *(1 día)*

Trabajar en grupos de 5–8 archivos para poder revisar cada diff:

```
Traduce al inglés todos los textos visibles al usuario en estos archivos.
Reemplazo literal en sitio: no crees diccionario ni función t().
No toques: slugs, keys, valores de enum, nombres de variables, ni comentarios de código.
Tono: agencia de viajes premium, público internacional.

<lista de archivos>
```

Orden por impacto: home → CTAs de WhatsApp (`DualCTA`, `LeadCaptureModal`, `useLeadCapture`) →
`/packages` → `/destinos/[slug]` → `/blog` → `QuickLinks` → `data/*.js`.

Verificar tras cada tanda: `node audit-spanish-strings.mjs` y `npm run build`.

### Paso 3 — Base de datos *(1 día)*

Un script de ~60 líneas (`scripts/translate-db.mjs`) que recorre las tablas y traduce en sitio
usando la cadena de fallback gratuita **que ya está configurada** en `lib/ai/providers.js`
(Gemini 2.5 Flash → Nemotron → gpt-oss). ~35 K tokens: entra en el free tier en una sesión.

```
node scripts/translate-db.mjs --dry-run    # → traducciones/2026-08-14.json
#   ← revisión humana del JSON (nombres propios, precios, itinerarios)
node scripts/translate-db.mjs --apply
```

Con la lista de exclusión de la §3 (`slug`, `sku`, `category`, enums) codificada dentro del script,
no como disciplina del que lo ejecuta.

> **Lo importante**: no hay que instalar, aprender ni pagar nada nuevo. Las dos piezas que faltan
> — el commit A y el script de BD — son trabajo de un día entre las dos, y el resto es revisar
> diffs.
