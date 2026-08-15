/**
 * Etiquetas de categoría del blog.
 *
 * ⚠️ Las CLAVES son los valores literales de `blog_posts.category` y NO se
 * traducen: viajan en la URL (`/blog?category=destinos`) y se comparan crudas
 * contra la BD. Traducirlas dejaría la página vacía sin dar ningún error y
 * rompería los enlaces ya indexados.
 *
 * Lo que se traduce es la ETIQUETA que se pinta. Este módulo existe porque el
 * valor crudo se estaba renderizando en tres sitios distintos, y por eso seguía
 * apareciendo "destinos" en el sitio ya traducido al inglés.
 */

export const CATEGORY_LABELS = {
  todos: "All",
  general: "General",
  destinos: "Destinations",
  tips: "Travel Tips",
  consejos: "Advice",
  itinerarios: "Itineraries",
  ofertas: "Deals",
  noticias: "News",
};

/** Etiqueta legible para una categoría; si es desconocida, la capitaliza. */
export function categoryLabel(key) {
  if (!key) return "";
  return (
    CATEGORY_LABELS[key] || String(key).charAt(0).toUpperCase() + String(key).slice(1)
  );
}
