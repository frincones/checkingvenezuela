/**
 * Backfill de service_inventory.slug.
 *
 * Se hace desde Node —y no en SQL con unaccent()— para reutilizar el
 * generateSlug REAL de lib/packages/slug.js. La normalización NFD de
 * JavaScript no es idéntica a la de Postgres, y una diferencia de un solo
 * carácter cambia una URL viva.
 *
 * Requisito previo: aplicar supabase/migrations/20260814_inventory_slug.sql
 *
 * Uso:
 *   node scripts/english-flip/01-backfill-slugs.mjs            → dry-run
 *   node scripts/english-flip/01-backfill-slugs.mjs --apply    → escribe
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// Copia literal de lib/packages/slug.js:generateSlug (el script es .mjs y el
// módulo usa alias "@/", que no resuelve fuera de Next).
function generateSlug(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+-\s+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/\/+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const { data, error } = await sb
  .from("service_inventory")
  .select("id, name, slug");

if (error) {
  console.error("No se pudo leer service_inventory:", error.message);
  if (String(error.message).includes("slug")) {
    console.error("\n→ Falta aplicar supabase/migrations/20260814_inventory_slug.sql");
  }
  process.exit(1);
}

const plan = [];
const seen = new Map();
let collisions = 0;

for (const row of data) {
  const slug = generateSlug(row.name);
  if (!slug) {
    console.log(`  !! SIN SLUG DERIVABLE: ${row.name}`);
    collisions++;
    continue;
  }
  if (seen.has(slug)) {
    console.log(`  !! COLISION "${slug}": ${seen.get(slug)}  <->  ${row.name}`);
    collisions++;
  }
  seen.set(slug, row.name);
  if (row.slug !== slug) plan.push({ id: row.id, name: row.name, from: row.slug, to: slug });
}

console.log(`\n${data.length} productos · ${plan.length} a actualizar · ${collisions} problemas\n`);
for (const p of plan) {
  console.log(`  ${String(p.from ?? "(null)").padEnd(22)} -> ${p.to}`);
}

if (collisions > 0) {
  console.error("\nABORTADO: resolver las colisiones antes de escribir.");
  process.exit(1);
}

if (!APPLY) {
  console.log("\nDry-run. Repetir con --apply para escribir.");
  process.exit(0);
}

let ok = 0;
for (const p of plan) {
  const { error: e } = await sb
    .from("service_inventory")
    .update({ slug: p.to })
    .eq("id", p.id);
  if (e) console.log(`  ERROR ${p.to}: ${e.message}`);
  else ok++;
}
console.log(`\n${ok}/${plan.length} slugs escritos.`);

// Verificación posterior
const { data: after } = await sb.from("service_inventory").select("slug");
const nulls = after.filter((r) => !r.slug).length;
const dups = after.length - new Set(after.map((r) => r.slug)).size;
console.log(`Verificación → slug NULL: ${nulls} (debe ser 0) · duplicados: ${dups} (debe ser 0)`);
