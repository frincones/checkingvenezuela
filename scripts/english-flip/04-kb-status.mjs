/**
 * Estado de la base de conocimiento del chatbot + purga de documentos
 * huérfanos en español.
 *
 * Contexto: ingestDocuments hace upsert por (source_id, content_hash). Al
 * traducir el catálogo cambia el hash, así que un re-sync INSERTA la versión
 * inglesa y deja la española indexada para siempre. La purga automática ya
 * está en ingestKbAction para las fuentes db_*, pero:
 *
 *   - La fuente "Hoteles (sync DB)" quedó registrada con type='manual' y NO
 *     tiene ruta de re-sync (kb/sync solo acepta db_destinations, db_packages,
 *     db_services, web). Sus 4 documentos hay que purgarlos desde aquí.
 *   - Los 4 documentos corporativos (docx) siguen en español y solo se
 *     reemplazan subiendo la versión en inglés por el dashboard.
 *
 * Uso:
 *   node scripts/english-flip/04-kb-status.mjs                → informe
 *   node scripts/english-flip/04-kb-status.mjs --purge-manual → borra los docs de la fuente 'manual'
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const PURGE_MANUAL = process.argv.includes("--purge-manual");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: sources } = await sb.from("kb_sources").select("id,type,name,status,language");
const { data: docs } = await sb.from("kb_documents").select("id,source_id,title,language");
const { count: chunks } = await sb.from("kb_chunks").select("*", { count: "exact", head: true });

const bySrc = {};
for (const d of docs) (bySrc[d.source_id] = bySrc[d.source_id] || []).push(d);

console.log("fuente                                  tipo             docs  idiomas");
console.log("-".repeat(78));
for (const s of sources) {
  const ds = bySrc[s.id] || [];
  const langs = [...new Set(ds.map((d) => d.language))].join(",") || "-";
  const resync =
    String(s.type).startsWith("db_") ? "re-sync OK" : s.type === "manual" ? "SIN RUTA DE SYNC" : "subida manual";
  console.log(
    `${s.name.slice(0, 38).padEnd(40)}${String(s.type).padEnd(17)}${String(ds.length).padStart(4)}  ${langs.padEnd(6)} ${resync}`,
  );
}
console.log("-".repeat(78));
const byLang = docs.reduce((a, d) => ({ ...a, [d.language]: (a[d.language] || 0) + 1 }), {});
console.log(`TOTAL: ${docs.length} documentos · ${chunks} chunks · idiomas ${JSON.stringify(byLang)}`);

if (byLang.es) {
  console.log(`\n⚠️  Quedan ${byLang.es} documentos en español.`);
  console.log("    → db_destinations / db_packages / db_services: re-sincronizar desde");
  console.log("      /dashboard/chatbot/knowledge-base (la purga ya es automática)");
  console.log("    → 'Hoteles (sync DB)': correr este script con --purge-manual");
  console.log("    → docx corporativos: subir la versión en inglés y desactivar la española");
}

if (PURGE_MANUAL) {
  const manual = sources.filter((s) => s.type === "manual");
  for (const s of manual) {
    const { error } = await sb.from("kb_documents").delete().eq("source_id", s.id);
    console.log(
      error ? `  ERROR purgando ${s.name}: ${error.message}` : `  purgado: ${s.name} (${(bySrc[s.id] || []).length} docs)`,
    );
  }
}
