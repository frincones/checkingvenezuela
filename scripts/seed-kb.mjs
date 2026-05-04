/**
 * Sembrado inicial del knowledge base:
 *  1. Los 4 .docx en el root (políticas, T&C, quienes somos)
 *  2. Destinos desde la tabla destinations
 *  3. Servicios catálogo desde catalog_services
 *  4. Paquetes desde packages (si existe)
 *
 * Uso: node scripts/seed-kb.mjs
 *
 * Requiere migración 009 aplicada en Supabase.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const aiPath = (rel) => path.join(ROOT, "lib", "ai", rel);
const toUrl = (p) => `file:///${p.replace(/\\/g, "/")}`;

const { parseDocx } = await import(toUrl(aiPath("ingestion/parsers/docx.js")));
const { upsertKbSource, ingestDocuments } = await import(
  toUrl(aiPath("ingestion/pipeline.js"))
);
const { extractDestinations, extractCatalogServices, extractPackages } = await import(
  toUrl(aiPath("ingestion/parsers/db.js"))
);

const DOCX_FILES = [
  { file: "Quienes somos..docx", title: "Quiénes somos - Venezuela Voyages", lang: "es" },
  { file: "Términos y condiciones venezuela voyages.docx", title: "Términos y Condiciones", lang: "es" },
  { file: "Política de Devolución y Reembolso de Venezuela Voyages.docx", title: "Política de Devolución y Reembolso", lang: "es" },
  { file: "Políticas de Seguridad de Venezuela Voyages.docx", title: "Políticas de Seguridad", lang: "es" },
];

async function seedDocxFiles() {
  console.log("\n📄 Sembrando documentos .docx ...");
  for (const entry of DOCX_FILES) {
    const fullPath = path.join(ROOT, entry.file);
    try {
      await fs.access(fullPath);
    } catch {
      console.log(`   ⚠️  No encontrado: ${entry.file} (saltando)`);
      continue;
    }

    try {
      const buf = await fs.readFile(fullPath);
      const { text } = await parseDocx(buf);
      console.log(`   📖 ${entry.file}: ${text.length} chars`);

      const sourceId = await upsertKbSource({
        type: "docx",
        name: entry.title,
        description: `Documento corporativo: ${entry.file}`,
        language: entry.lang,
        metadata: { original_filename: entry.file },
      });

      const result = await ingestDocuments({
        sourceId,
        documents: [{ title: entry.title, content: text }],
        language: entry.lang,
      });
      console.log(
        `   ✅ ${entry.title} → ${result.totalChunks} chunks, ${result.totalTokens} tokens`
      );
    } catch (err) {
      console.error(`   ❌ ${entry.file}: ${err.message}`);
    }
  }
}

async function seedDestinations() {
  console.log("\n🌴 Sembrando destinos desde tabla destinations ...");
  const docs = await extractDestinations();
  if (docs.length === 0) {
    console.log("   ⚠️  No hay destinos (tabla vacía o no existe)");
    return;
  }
  console.log(`   📖 ${docs.length} destinos extraídos`);

  const sourceId = await upsertKbSource({
    type: "db_destinations",
    name: "Destinos (sync DB)",
    description: "Destinos turísticos del catálogo",
    language: "es",
  });
  const result = await ingestDocuments({
    sourceId,
    documents: docs,
    language: "es",
  });
  console.log(
    `   ✅ ${result.totalDocs} docs → ${result.totalChunks} chunks, ${result.totalTokens} tokens`
  );
}

async function seedServices() {
  console.log("\n✈️  Sembrando servicios desde catalog_services ...");
  const docs = await extractCatalogServices();
  if (docs.length === 0) {
    console.log("   ⚠️  No hay servicios (tabla vacía o no existe)");
    return;
  }
  console.log(`   📖 ${docs.length} servicios extraídos`);

  const sourceId = await upsertKbSource({
    type: "db_services",
    name: "Servicios catálogo (sync DB)",
    description: "Servicios disponibles en el catálogo",
    language: "es",
  });
  const result = await ingestDocuments({ sourceId, documents: docs, language: "es" });
  console.log(`   ✅ ${result.totalChunks} chunks, ${result.totalTokens} tokens`);
}

async function seedPackages() {
  console.log("\n📦 Sembrando paquetes desde packages ...");
  const docs = await extractPackages();
  if (docs.length === 0) {
    console.log("   ⚠️  No hay paquetes (tabla vacía o no existe)");
    return;
  }
  console.log(`   📖 ${docs.length} paquetes extraídos`);

  const sourceId = await upsertKbSource({
    type: "db_packages",
    name: "Paquetes turísticos (sync DB)",
    description: "Paquetes turísticos completos",
    language: "es",
  });
  const result = await ingestDocuments({ sourceId, documents: docs, language: "es" });
  console.log(`   ✅ ${result.totalChunks} chunks, ${result.totalTokens} tokens`);
}

async function main() {
  console.log("🌱 Seed Knowledge Base - Venezuela Voyages Chatbot");
  console.log("============================================");

  if (!process.env.JINA_API_KEY) {
    console.error("❌ Falta JINA_API_KEY en .env");
    process.exit(1);
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Faltan credenciales de Supabase en .env");
    process.exit(1);
  }

  // Verificar que las tablas existen ANTES de hacer cualquier cosa
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error: tableErr } = await sb.from("kb_sources").select("id").limit(1);
  if (tableErr && (tableErr.code === "42P01" || tableErr.code === "PGRST205")) {
    console.error("\n❌ La tabla kb_sources NO existe.");
    console.error("   Aplica primero la migración:");
    console.error("   node scripts/apply-chatbot-migration.js --print\n");
    process.exit(1);
  }

  await seedDocxFiles();
  await seedDestinations();
  await seedServices();
  await seedPackages();

  console.log("\n============================================");
  console.log("✅ Seed completo");
  console.log("============================================\n");
}

main().catch((err) => {
  console.error("\n❌ Error fatal:");
  console.error(err);
  process.exit(1);
});
