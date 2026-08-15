# Inventario de español restante en la UI pública

**Fecha**: 2026-08-15 · **Detectado por**: Emma, navegando el sitio
**Herramienta**: `scripts/english-flip/06-audit-ui.mjs`

---

## Por qué se escapó

Mi auditor anterior (`audit-spanish-strings.mjs`) era pattern-matching sobre
"cadenas que parecen españolas". Tenía **tres puntos ciegos estructurales** —
no fue mala suerte, es que no podía verlos:

| # | Punto ciego | Ejemplo que dejó pasar |
|---|---|---|
| 1 | **Texto JSX precedido de emoji o símbolo** — mis patrones exigían que el texto empezara por letra (`>\s*[A-ZÁÉÍÓÚ]`) | `✅ Qué Incluye` · `❌ No Incluye` |
| 2 | **Identificadores de locale** — no hay ninguna cadena española en el código, la produce el runtime | `toLocaleDateString("es-VE")` → *"12 de agosto de 2026"* |
| 3 | **Valores de BD renderizados como etiqueta** — la clave no se traduce (correcto), pero se imprime cruda | `{post.category}` → *"destinos"* |

`06-audit-ui.mjs` cubre los tres explícitamente y además restringe el análisis a
la superficie que el visitante ve de verdad (excluye `/dashboard`, `lib/` de
servidor y componentes de CMS).

---

## A resolver

### A1 · ChatWidget — **una sola línea**

El widget ya está completamente traducido: usa `TXT = { es: {...}, en: {...} }` y
`language === "en" ? … : …` en todas partes. El único fallo es el idioma por
defecto.

```
components/ChatWidget/ChatWidget.jsx:35    useState("es") → useState("en")
```

Arregla de golpe ~28 cadenas: saludo de bienvenida, lista de conversaciones,
diálogo de consentimiento, placeholders y avisos de error.

### A2 · Página de paquete *(en las capturas)*

| Archivo | Línea | Texto |
|---|---:|---|
| `components/pages/packages/sections/PackageIncludes.jsx` | 10, 29 | `✅ Qué Incluye` · `❌ No Incluye` |
| `app/(pages)/packages/[slug]/page.js` | 121, 127 | `Precio por persona` · `Por persona` |
| `components/pages/packages/sections/PackageBookingSummary.jsx` | 68 | `Precio base` |
| `components/pages/packages/sections/FeaturedPackages.jsx` | 44 | `Paquetes Destacados` |

### A3 · Footer — enlaces legales *(nunca traducidos)*

`components/sections/QuickLinks.js` líneas 192–210: `Política de Privacidad`,
`Términos y Condiciones`, `Devolución y Reembolso`, `Políticas de Seguridad`.

*(Traduje `data/routes.json`, pero el footer no lo usa: tiene los textos a pelo.)*

### A4 · Fechas en español *(punto ciego 2)*

| Archivo | Línea |
|---|---:|
| `app/(pages)/blog/page.js` | 57 |
| `app/(pages)/blog/[slug]/page.js` | 76 |
| `components/pages/home/sections/LatestBlogPosts.js` | 23 |

`toLocaleDateString("es-VE", …)` → `"en-US"`.

### A5 · Categoría del blog *(punto ciego 3)*

`{post.category}` imprime el valor crudo de la BD (`destinos`, `tips`,
`noticias`). **La clave no se traduce** — viaja en `/blog?category=…` — pero hay
que mapearla a etiqueta al pintarla.

`LatestBlogPosts.js:32` ya tiene un mapa `{ destinos: "Destinos" }`: basta con
traducir los valores y reutilizarlo en las dos páginas de blog.

### A6 · Fallback estático

`data/popularDestinations.js` líneas 120 y 174: `category: "Todo Incluido"`.

---

## Verificado correcto — no tocar

| Qué | Por qué |
|---|---|
| Nombres de los 20 reseñadores en `Reviews.js` | Nombres propios venezolanos |
| `Cancún`, `Bogotá`, `Mérida`, `Mukumbarí`, `Choroní` | Topónimos |
| `components/cms/*`, `TipTapEditor`, `ImageUpload` | Admin — fuera de alcance por decisión |
| `ServicesSection.js:90` | Es un comentario; el texto ya dice "Coming soon" |
| `/dashboard/**` | Interno, se queda en español |

---

## Fuera de este alcance, sigue pendiente

- **Emails y PDFs al cliente**: plantillas `.hbs` con branding "CHECK-IN
  VENEZUELA", PDF de cotización y voucher en español, `emailDefaultData.js`
  enlazando a `/terms-and-conditions` (ruta inexistente)
- **KB del chatbot**: 59 documentos en español, pendiente el re-sync tras el deploy
- **Breadcrumb**: muestra el slug crudo (`merida-tradicional-todo-incluido-3d-2n`)
  en vez del nombre del paquete. Cosmético, ya estaba así antes del flip
