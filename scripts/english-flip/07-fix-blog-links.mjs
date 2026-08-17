/**
 * Corrige los enlaces internos rotos dentro del HTML de los posts publicados.
 *
 * Por qué existe además de los 301 de next.config.mjs:
 *   Un 301 hace que el enlace FUNCIONE, pero sigue siendo un salto extra que
 *   diluye autoridad y añade latencia. Y sobre todo: estos enlaces están en
 *   posts que se leen HOY, en inglés, apuntando a URLs en español que devuelven
 *   404 hasta que los redirects estén desplegados. Un lector interesado se
 *   choca con la página de error justo cuando iba a comprar.
 *
 * Se detectaron 3 enlaces en 3 posts publicados:
 *   "5 Secretos de Los Roques…"          -> /packages/los-roques-2d-1n
 *   "secrets-of-los-roques"              -> /packages/los-roques-2d-1n
 *   "angel-falls-luxury-eco-expedition"  -> /destinos/canaima
 *
 * Uso:
 *   node scripts/english-flip/07-fix-blog-links.mjs           dry-run
 *   node scripts/english-flip/07-fix-blog-links.mjs --apply
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

/**
 * Mismos destinos que las reglas 301, para que el contenido y las
 * redirecciones no puedan divergir.
 */
const REPLACEMENTS = [
  ["/packages/los-roques-2d-1n", "/packages/los-roques-express-getaway-2d-1n"],
  [
    "/packages/canaima-salto-angel-campamento-categoria-standard",
    "/packages/canaima-national-park-standard-comfort-package",
  ],
  [
    "/packages/parque-nacional-canaima-y-salto-angel-categoria-superior",
    "/packages/canaima-national-park-angel-falls-premium-category",
  ],
  ["/destinos/canaima", "/destinos/en-canaima-national-park"],
  ["/destinos/los-roques", "/destinos/los-roques-archipelago"],
  ["/destinos/roraima", "/destinos/mount-roraima"],
  ["/destinos/isla-la-tortuga", "/destinos/la-tortuga-island"],
  ["/destinos/catatumbo", "/destinos/catatumbo-lightning-venezuela"],
  // http y dominio sin www: normalizados al canónico
  ["http://venezuelavoyages.com", "https://www.venezuelavoyages.com"],
  ["https://venezuelavoyages.com", "https://www.venezuelavoyages.com"],
];

const { data: posts, error } = await sb
  .from("blog_posts")
  .select("id, slug, title, content, status");

if (error) {
  console.error("Error leyendo posts:", error.message);
  process.exit(1);
}

const ops = [];

for (const post of posts) {
  let content = post.content || "";
  const before = content;
  const hits = [];

  for (const [from, to] of REPLACEMENTS) {
    if (!content.includes(from)) continue;
    // Se evita reemplazar un slug que ya es el correcto: /destinos/los-roques
    // es prefijo de /destinos/los-roques-archipelago, así que solo se sustituye
    // cuando el carácter siguiente cierra la URL.
    // La barra invertida entra en el conjunto porque el HTML guardado en la BD
    // trae las comillas escapadas (href=\"...\"). Sin ella, el enlace del post
    // "5 Secretos de Los Roques" se quedaba sin corregir.
    const re = new RegExp(
      from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '(?=["\'\\\\\\s<)?#]|$)',
      "g",
    );
    const n = (content.match(re) || []).length;
    if (n > 0) {
      content = content.replace(re, to);
      hits.push(`${n}× ${from}`);
    }
  }

  if (content !== before) {
    ops.push({ id: post.id, slug: post.slug, status: post.status, content, hits });
  }
}

console.log(`posts revisados: ${posts.length} · con enlaces a corregir: ${ops.length}\n`);
for (const o of ops) {
  console.log(`  [${o.status}] ${o.slug.slice(0, 56)}`);
  o.hits.forEach((h) => console.log(`      ${h}`));
}

if (ops.length === 0) {
  console.log("\nNada que corregir.");
  process.exit(0);
}

if (!APPLY) {
  console.log("\nDry-run. Repite con --apply para escribir.");
  process.exit(0);
}

let ok = 0;
for (const o of ops) {
  const { error: e } = await sb
    .from("blog_posts")
    .update({ content: o.content })
    .eq("id", o.id);
  if (e) console.log(`  ERROR ${o.slug}: ${e.message}`);
  else ok++;
}
console.log(`\n${ok}/${ops.length} posts actualizados.`);
