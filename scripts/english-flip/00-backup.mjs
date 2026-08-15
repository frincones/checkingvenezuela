/**
 * Respaldo previo al flip a inglés.
 * Exporta a JSON todas las tablas que van a mutar. Es el rollback de datos.
 *
 * Uso: node scripts/english-flip/00-backup.mjs
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const TABLES = [
  "destinations",
  "destination_categories",
  "catalog_services",
  "service_inventory",
  "tourism_providers",
  "blog_posts",
  "hotels",
  "website_reviews",
  "kb_sources",
  "kb_documents",
];

const stamp = process.argv[2] || "manual";
const dir = path.join("backups", `english-flip-${stamp}`);
fs.mkdirSync(dir, { recursive: true });

let total = 0;
for (const t of TABLES) {
  const { data, error } = await sb.from(t).select("*");
  if (error) {
    console.log(`  ERROR ${t}: ${error.message}`);
    continue;
  }
  fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(data, null, 2), "utf8");
  total += data.length;
  console.log(`  ${String(data.length).padStart(4)} filas  ${t}.json`);
}
console.log(`\nRespaldo completo en ${dir}/  (${total} filas)`);
