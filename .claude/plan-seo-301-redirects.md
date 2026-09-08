# Plan: redirecciones 301 — familia `/packages/destino/`

Estado: **aplicado y verificado en local — pendiente de commit y despliegue**
Fecha del análisis: 2026-09-08
Rama: `feat/seo-301-redirects`
Mapeo elegido: el nuestro (listado → listado), aprobado por Emma el 2026-09-08

---

## 1. Origen

Yeni (SEO) reporta 404 en Bing Webmaster y Yandex Webmaster y envía una lista
consolidada de 14 parejas, de las cuales 2 son nuevas:

```
/packages/destino/catatumbo   -> /destinos/catatumbo-lightning-venezuela
/packages/destino/los-roques  -> /destinos/los-roques-archipelago
```

## 2. Diagnóstico

`/packages/destino/[slug]` **no es una URL muerta: es una ruta viva**
(`app/(pages)/packages/destino/[slug]/page.js`). Consulta `destinations`
filtrando `is_active = true` y, si no encuentra fila, llama a `notFound()`.

Los slugs españoles se archivaron durante el flip a inglés, así que la consulta
devuelve `null` y la ruta responde 404. **No hay ningún defecto en el código.**
Es el mismo hueco de redirección que ya se cerró para `/destinos/`, solo que
esta segunda familia de URLs no se inventarió entonces.

### Alcance real: son 5, no 2

Yandex reportó 2 porque son las que tenía en cola. Probado en producción:

```
404  /packages/destino/canaima
404  /packages/destino/los-roques          <- reportada
404  /packages/destino/roraima
404  /packages/destino/isla-la-tortuga
404  /packages/destino/catatumbo           <- reportada
```

Cerrar solo las 2 reportadas garantiza que las otras 3 aparezcan en el
siguiente informe de Yandex. Se cierra la familia entera.

### Estado de las 14 parejas de Yeni (verificado en producción)

| Parejas | Estado |
|---|---|
| 1–10 y 12 | 301 correcto, destino 200 |
| 11 (`canaima-y-salto-angel-4d-3n`) | 301 activo, pero a destino distinto del que pide — divergencia deliberada, ver §6 |
| 13–14 (`/packages/destino/`) | 404, sin regla |

## 3. El cambio

**Un solo fichero: `next.config.mjs`.** Cero backend, cero Supabase, cero
migraciones, cero cambios en integraciones.

Se añaden 5 pares al array `pairs` de `redirects()`:

```js
// ── Paquetes por destino ──
// Esta familia de URLs se pasó por alto en la primera tanda de 301. La ruta
// /packages/destino/[slug] resuelve contra destinations.is_active, así que al
// archivar los slugs españoles pasó a devolver 404 igual que /destinos/.
//
// El destino es el listado inglés equivalente, NO la ficha de destino: mantener
// el tipo de contenido (listado -> listado) conserva la intención de búsqueda.
// Un salto listado -> ficha Google puede leerlo como redirección irrelevante y
// no traspasar autoridad. Los 5 destinos tienen al menos 1 paquete publicado,
// así que ninguno cae en la pantalla "Coming soon".
["/packages/destino/canaima",         "/packages/destino/en-canaima-national-park"],
["/packages/destino/los-roques",      "/packages/destino/los-roques-archipelago"],
["/packages/destino/roraima",         "/packages/destino/mount-roraima"],
["/packages/destino/isla-la-tortuga", "/packages/destino/la-tortuga-island"],
["/packages/destino/catatumbo",       "/packages/destino/catatumbo-lightning-venezuela"],
```

Opcional (huérfano detectado en el barrido, no está en la lista de Yeni):

```js
["/packages/relampago-del-catatumbo-ruta-del-cacao", "/packages/relampago-del-catatumbo"],
```

Total: 17 reglas → 22 (23 con el huérfano).

### Verificación previa de los destinos

| URL destino | HTTP | Paquetes publicados |
|---|---|---|
| `/packages/destino/en-canaima-national-park` | 200 | 3 |
| `/packages/destino/catatumbo-lightning-venezuela` | 200 | 1 |
| `/packages/destino/los-roques-archipelago` | 200 | 1 |
| `/packages/destino/mount-roraima` | 200 | 1 |
| `/packages/destino/la-tortuga-island` | 200 | 1 |

---

## 4. Análisis de regresión cross-aplicación

Ejecutado antes de tocar nada. Todo verificado contra producción o contra la
base de datos real, no por inspección de código.

### 4.1 Analítica y atribución

Configurado en el sitio: **GA4** (`G-ZP34JNKX19`), **Microsoft Clarity**,
**Vercel Analytics** (`app/layout.js`).

El riesgo real no es que deje de medirse — el tag dispara en la página final —
sino que el 301 **descarte los parámetros de campaña** y rompa la atribución.
Probado contra las reglas ya desplegadas:

```
/destinos/canaima?utm_source=newsletter&utm_medium=email&utm_campaign=sep
  -> /destinos/en-canaima-national-park?utm_source=newsletter&utm_medium=email&utm_campaign=sep

/destinos/catatumbo?gclid=TEST123
  -> /destinos/catatumbo-lightning-venezuela?gclid=TEST123

/blog/viajes-seguros-venezuela?fbclid=ABC
  -> /blog/safe-travel-venezuela?fbclid=ABC
```

**UTM, `gclid` y `fbclid` se conservan íntegros.** GA4, Google Ads y Meta no
pierden atribución. Las reglas nuevas usan el mismo mecanismo, así que se
comportan igual.

### 4.2 Checklist completo

| Área | Comprobación | Resultado |
|---|---|---|
| GA4 / Ads / Meta | UTM, gclid, fbclid a través del 301 | Se conservan |
| Clarity, Vercel Analytics | Disparan en la página final | Sin impacto |
| `vercel.json` | ¿Reglas que compitan? | `{}` vacío |
| Middleware / sesión Supabase | Orden de evaluación | Next evalúa headers → redirects → middleware: la petición redirigida no llega a `updateSession`. Son rutas públicas de marketing, no necesitan sesión |
| Cabeceras CSP / X-Content-Type-Options | ¿Siguen emitiéndose en el 301? | Sí, `headers()` corre antes que `redirects()` |
| `app/sitemap.js` | ¿Emitiría las URLs redirigidas? | No: filtra `is_active = true` en ambas familias |
| `app/robots.js` | ¿Bloquea estas rutas? | No: solo `/dashboard/`, `/api/`, `/user/` |
| Banners (`banners.link_url`) | Enlaces a rutas afectadas | 0 filas (tabla vacía) |
| Blog (`blog_posts.content`) | Enlaces a `/packages/destino/` | 0 posts |
| KB del chatbot | `kb_documents` (59) + `kb_chunks` (61) | 0 URLs afectadas |
| Plantillas de correo `.hbs` | Referencias a estas rutas | Ninguna |
| Enlaces internos — home | `lib/cms.js` filtra `is_active = true` y solo enlaza con `packageCount > 0` | No genera 404 |
| Enlaces internos — chatbot | `lib/ai/tools/searchPackages.js` construye la URL desde destinos activos con paquetes publicados | No genera 404 |
| JSON-LD / datos estructurados | Búsqueda en todo el árbol | No existe ninguno |
| PayPal / Resend / Stripe | Dependencia de estas rutas | Ninguna |
| Coste de las reglas | 22 reglas estáticas compiladas en el edge | Despreciable |

### 4.3 Riesgos identificados

**R1 — Sombra sobre un slug reactivado.** Si alguien vuelve a activar un
destino con slug español desde el CMS, la regla 301 lo taparía de forma
permanente y la página nunca se serviría. Probabilidad baja: los slugs se
archivaron deliberadamente en el flip y sus gemelos ingleses son los vigentes.
Mitigación: queda documentado aquí y en el comentario del `next.config.mjs`.

**R2 — Cadena de dos saltos con barra final.** `/destinos/canaima/` responde
308 → `/destinos/canaima` → 301 → destino. Es el comportamiento por defecto de
Next (`skipTrailingSlashRedirect` desactivado) y ya afecta a las 17 reglas
actuales. No rompe nada; Bing y Yandex resuelven cadenas cortas. No se toca:
activar esa opción cambiaría el comportamiento de todo el sitio.

---

## 5. Hallazgos preexistentes — FUERA del alcance de este cambio

Detectados durante la regresión. No los provoca esta modificación y **no deben
mezclarse en este PR**, pero son directamente relevantes para el trabajo de SEO
y probablemente contribuyen al ruido de rastreo que ve Yeni.

**P1 — El sitemap emite las 69 URLs en el apex, sin `www`.** El apex responde
**307** hacia `www`. O sea que cada URL del sitemap le cuesta al rastreador un
salto extra, y además un 307 es *temporal*: como señal de canonicalización es
más débil que un 301. `app/sitemap.js:3` tiene el dominio escrito a fuego
(`https://venezuelavoyages.com`).

**P2 — Las páginas no emiten `<link rel="canonical">` ni `og:url`.**
Verificado en producción sobre `/destinos/en-canaima-national-park`: no existe
ninguna de las dos etiquetas. Con apex y `www` resolviendo ambos y sin canonical,
los buscadores tienen que adivinar el host preferido. Es riesgo real de
contenido duplicado entre dos hostnames. `metadataBase` en `app/layout.js:55`
también apunta al apex.

**P3 — Nueve destinos archivados más generan 18 URLs en 404** (`cancun-hotel`,
`cartagena-hotel`, `colonia-tovar`, `lima-flight`, `merida-hotel`,
`miami-hotel`, `panama-hotel`, `punta-cana-hotel`, `santa-marta-hotel`), en
ambas familias. Son restos del dedupe de duplicados hotel/vuelo, no del flip de
idioma, y no tienen equivalente inglés real. Recomendación: dejarlos en 404
salvo que Bing o Yandex los reporten. Preguntar a Yeni.

**P4 — Cuatro paquetes publicados conservan slug en español**:
`relampago-del-catatumbo`, `merida-romantica-para-parejas`,
`merida-tradicional-todo-incluido-3d-2n`,
`isla-margarita-3d-2n-sun-sol-isla-caribe`. No son 404 ni urgente, pero es una
inconsistencia pendiente del flip.

---

## 6. Decisión pendiente de Yeni

**Pareja 11.** Ella pide
`/packages/canaima-y-salto-angel-4d-3n` → `/destinos/en-canaima-national-park`.
En producción está apuntando a
`/packages/canaima-national-park-standard-comfort-package`.

La divergencia es deliberada y por el mismo criterio del §3: mantener el tipo de
contenido (paquete → paquete) en vez de saltar a una ficha de destino. Ambos
destinos devuelven 200, así que si Yeni prefiere su mapeo es solo cambiar el
valor. Es decisión de SEO, no técnica.

**Destino de las parejas 13–14.** Mismo criterio: se propone
`/packages/destino/<en>` en lugar de `/destinos/<en>`.

---

## 7. Ejecución

1. ✅ Editar el array `pairs` en `next.config.mjs` — 6 pares añadidos (17 → 23).
2. ✅ `npx next build` — exit 0.
3. ⬜ Commit en `feat/seo-301-redirects`, push, PR a `dev`.
4. ⬜ Repetir la verificación del §7.1 contra producción tras el despliegue.
5. ⬜ Confirmar a Yeni para que lance la reindexación manual en Bing Webmaster
   (Inspección de URL) y Yandex Webmaster (Reindex pages).

### 7.1 Verificación ejecutada en local (`next start`, servidor de producción)

**0 fallos.** Lo comprobado, no por lectura del config sino sirviendo peticiones
reales contra el build compilado:

| Comprobación | Resultado |
|---|---|
| `routes-manifest.json` | 23 redirects, todos `statusCode: 301`, sin orígenes duplicados ni rutas malformadas |
| 6 reglas nuevas | Origen → 301 al destino exacto; los 6 destinos → 200 |
| 17 reglas previas | Las 17 siguen respondiendo 301 — sin regresión |
| Parámetros de campaña | `/packages/destino/catatumbo?utm_source=yandex&gclid=X1` → destino con `?utm_source=yandex&gclid=X1` intacto |
| Ruta viva no tapada | `/packages/destino/en-canaima-national-park`, `/isla-margarita` y `/merida` siguen devolviendo 200 |

Esta última fila era el riesgo que había que descartar: las reglas usan rutas
exactas, así que no ensombrecen el resto de la familia `/packages/destino/[slug]`,
que sigue sirviéndose con normalidad.

### Nota para Yeni sobre la verificación

Si prueba `https://venezuelavoyages.com/...` (sin `www`) verá **307** antes del
301: es el salto apex → www del dominio, no una regla nuestra. Para comprobar
las reglas hay que probar directamente sobre `https://www.venezuelavoyages.com/`.

Las 301 se aplican en `redirects()` de Next, que Vercel ejecuta en el edge antes
del enrutado y del middleware. No hay ninguna lógica que lea User-Agent en ese
camino, así que Bingbot y YandexBot reciben exactamente la misma respuesta que
un navegador. Se usa `statusCode: 301` explícito y no `permanent: true`, que
emitiría 308.

## 8. Rollback

Quitar los pares añadidos del array y desplegar. No hay estado que revertir: las
reglas son estáticas, no tocan base de datos ni ninguna integración.
