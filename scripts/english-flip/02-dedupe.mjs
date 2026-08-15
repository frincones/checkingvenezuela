/**
 * Deduplicación ES/EN previa a la traducción.
 *
 * El sitio ya tiene contenido en inglés creado a mano que convive con su
 * gemelo español. Traducir el español "en su sitio" produciría dos filas
 * idénticas. Aquí se conserva la fila EN y se archiva la ES.
 *
 * NUNCA borra: 11 paquetes están referenciados por cotizaciones emitidas
 * (quotations.items[].inventory_id). Solo despublica / desactiva.
 *
 * ORDEN CRÍTICO (verificado contra producción):
 *   1. Los 5 destinos EN tienen category_id = NULL, así que HOY NO APARECEN
 *      en el home (lib/cms.js agrupa por category_id). Hay que heredarles la
 *      categoría del gemelo ES antes de desactivarlo, o la sección "Discover
 *      Venezuela" pierde esos destinos.
 *   2. 9 paquetes y 8 posts apuntan con destination_id a la fila ES. Hay que
 *      repuntarlos al EN antes de desactivar, o las páginas de destino en
 *      inglés se quedan sin paquetes.
 *   3. Recién entonces se archiva la fila ES.
 *
 * Uso:
 *   node scripts/english-flip/02-dedupe.mjs            → dry-run
 *   node scripts/english-flip/02-dedupe.mjs --apply
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// ─── Pares ES → EN, verificados uno a uno contra producción ───

const DESTINATION_PAIRS = [
  { es: "canaima", en: "en-canaima-national-park" },
  { es: "los-roques", en: "los-roques-archipelago" },
  { es: "roraima", en: "mount-roraima" },
  { es: "isla-la-tortuga", en: "la-tortuga-island" },
  { es: "catatumbo", en: "catatumbo-lightning-venezuela" },
];

// Pares con precio IDÉNTICO (duplicados evidentes) + los 2 resueltos por Emma
// (B2: se conserva la versión en inglés).
const PACKAGE_PAIRS = [
  { es: "Trekking al Tepuy Roraima. El Mundo Perdido 10 D / 9 N", en: "Mount Roraima Tepuy Trekking: The Lost World (10 Days / 9 Nights)" },
  { es: "Glamping Premium en Isla de La Tortuga", en: "Premium Geodesic Glamping: La Tortuga Island" },
  { es: "CANAIMA & CATATUMBO: EXPEDICIÓN FENÓMENOS NATURALES", en: "CANAIMA & CATATUMBO: NATURAL PHENOMENA EXPEDITION" },
  { es: "Los Roques 2D/1N", en: "Los Roques Express Getaway (2D/1N)" },
  // B2 — decisión de Emma: se conserva el inglés
  { es: "Parque Nacional Canaima y Salto Ángel | Categoría Superior", en: "Canaima National Park & Angel Falls | Premium Category" },
  { es: "Canaima - Salto Ángel | Campamento Categoría Standard", en: "Canaima National Park / Standard Comfort Package" },
];

const BLOG_PAIRS = [
  { es: "viajes-seguros-venezuela", en: "safe-travel-venezuela" },
  { es: "salto-angel-guia-maestra-para-tocar-el-cielo-en-el-corazon-de-venezuela", en: "angel-falls-luxury-eco-expedition" },
  { es: "blog-enigmas-misterios-los-roques-2026", en: "secrets-of-los-roques" },
  { es: "los-roques-la-tortuga-2026-guia-vip", en: "los-roques-archipelago-la-tortuga-island-2026-vip-guide" },
  { es: "los-roques-sin-palmeras", en: "los-roques-the-secret-behind-the-paradise-without-palm-trees" },
];

const log = [];
const act = (msg) => { log.push(msg); console.log(msg); };

// ─── Cargar estado ───
const { data: dests } = await sb.from("destinations").select("*");
const { data: inv } = await sb.from("service_inventory").select("id,name,is_published,status,destination_id");
const { data: posts } = await sb.from("blog_posts").select("id,slug,title,status,destination_id");

const bySlug = Object.fromEntries(dests.map((d) => [d.slug, d]));
const findPost = (slug) =>
  posts.find((p) => p.slug === slug) || posts.find((p) => p.slug.startsWith(slug.slice(0, 40)));
const findPkg = (name) =>
  inv.find((p) => p.name === name) || inv.find((p) => p.name.trim() === name.trim());

const ops = [];
let fatal = 0;

// ─── PASO 1: heredar categoría y orden al destino EN ───
act("\n== PASO 1: heredar category_id / display_order / is_featured al destino EN ==");
for (const { es, en } of DESTINATION_PAIRS) {
  const rEs = bySlug[es], rEn = bySlug[en];
  if (!rEs || !rEn) { act(`  !! FALTA par ${es} -> ${en}`); fatal++; continue; }
  const patch = {};
  if (rEn.category_id == null && rEs.category_id != null) patch.category_id = rEs.category_id;
  if (!rEn.display_order && rEs.display_order) patch.display_order = rEs.display_order;
  if (!rEn.is_featured && rEs.is_featured) patch.is_featured = rEs.is_featured;
  if (!rEn.image_url && rEs.image_url) patch.image_url = rEs.image_url;
  if (Object.keys(patch).length) {
    act(`  ${en.padEnd(32)} <- ${JSON.stringify(patch)}`);
    ops.push({ table: "destinations", id: rEn.id, patch });
  } else {
    act(`  ${en.padEnd(32)} (ya completo)`);
  }
}

// ─── PASO 2: repuntar destination_id de paquetes ES -> EN ───
act("\n== PASO 2: repuntar service_inventory.destination_id ==");
for (const { es, en } of DESTINATION_PAIRS) {
  const rEs = bySlug[es], rEn = bySlug[en];
  if (!rEs || !rEn) continue;
  for (const p of inv.filter((x) => x.destination_id === rEs.id)) {
    act(`  ${es} -> ${en}   ${p.name.slice(0, 50)}`);
    ops.push({ table: "service_inventory", id: p.id, patch: { destination_id: rEn.id } });
  }
}

// ─── PASO 3: repuntar destination_id de posts ES -> EN ───
act("\n== PASO 3: repuntar blog_posts.destination_id ==");
for (const { es, en } of DESTINATION_PAIRS) {
  const rEs = bySlug[es], rEn = bySlug[en];
  if (!rEs || !rEn) continue;
  for (const p of posts.filter((x) => x.destination_id === rEs.id)) {
    act(`  ${es} -> ${en}   ${p.slug.slice(0, 50)}`);
    ops.push({ table: "blog_posts", id: p.id, patch: { destination_id: rEn.id } });
  }
}

// ─── PASO 4: archivar destinos ES ───
act("\n== PASO 4: desactivar destinos ES duplicados ==");
for (const { es, en } of DESTINATION_PAIRS) {
  const rEs = bySlug[es];
  if (!rEs) continue;
  act(`  is_active=false  ${es.padEnd(22)} "${rEs.name}"  (se conserva ${en})`);
  ops.push({ table: "destinations", id: rEs.id, patch: { is_active: false } });
}

// ─── PASO 5: descontinuar paquetes ES ───
act("\n== PASO 5: descontinuar paquetes ES duplicados ==");
for (const { es, en } of PACKAGE_PAIRS) {
  const pEs = findPkg(es), pEn = findPkg(en);
  if (!pEs) { act(`  !! no encontrado ES: "${es}"`); fatal++; continue; }
  if (!pEn) { act(`  !! no encontrado EN: "${en}"`); fatal++; continue; }
  act(`  discontinued   ${es.slice(0, 52).padEnd(54)} (se conserva "${en.slice(0, 40)}")`);
  ops.push({ table: "service_inventory", id: pEs.id, patch: { is_published: false, status: "discontinued" } });
}

// ─── PASO 6: pasar posts ES a borrador ───
act("\n== PASO 6: pasar posts ES duplicados a borrador ==");
for (const { es, en } of BLOG_PAIRS) {
  const pEs = findPost(es), pEn = findPost(en);
  if (!pEs) { act(`  !! no encontrado ES: ${es}`); fatal++; continue; }
  if (!pEn) { act(`  !! no encontrado EN: ${en}`); fatal++; continue; }
  act(`  draft          ${pEs.slug.slice(0, 52).padEnd(54)} (se conserva ${pEn.slug.slice(0, 40)})`);
  ops.push({ table: "blog_posts", id: pEs.id, patch: { status: "draft" } });
}

console.log(`\n${ops.length} operaciones · ${fatal} problemas`);
if (fatal > 0) { console.error("ABORTADO: resolver los problemas antes de escribir."); process.exit(1); }
if (!APPLY) { console.log("\nDry-run. Repetir con --apply para escribir."); process.exit(0); }

let ok = 0;
for (const o of ops) {
  const { error } = await sb.from(o.table).update(o.patch).eq("id", o.id);
  if (error) console.log(`  ERROR ${o.table}/${o.id}: ${error.message}`);
  else ok++;
}
console.log(`\n${ok}/${ops.length} operaciones aplicadas.`);
