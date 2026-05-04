/**
 * Script para verificar/aplicar la migración 009_chatbot_rag.sql
 *
 * Uso:
 *   node scripts/apply-chatbot-migration.js          → diagnóstico
 *   node scripts/apply-chatbot-migration.js --print  → imprime el SQL para copiar al Dashboard
 *
 * El SQL debe aplicarse manualmente en Supabase Dashboard → SQL Editor
 * (mismo patrón que apply-crm-migration.js)
 */

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MIGRATION_PATH = path.join(__dirname, "..", "supabase", "migrations", "009_chatbot_rag.sql");
const REQUIRED_TABLES = [
  "chat_conversations",
  "chat_messages",
  "kb_sources",
  "kb_documents",
  "kb_chunks",
  "kb_usage_log",
];
const REQUIRED_LEADS_COLUMNS = [
  "consent_accepted_at",
  "consent_text_version",
  "chatbot_conversation_id",
];

async function tableExists(name) {
  const { error } = await sb.from(name).select("id").limit(1);
  if (!error) return true;
  if (error.code === "42P01" || error.code === "PGRST205") return false;
  return true; // otro error → asumimos existe
}

async function leadsHasColumn(col) {
  const { data, error } = await sb.from("leads").select(col).limit(1);
  if (error && error.code === "42703") return false; // undefined_column
  return !error;
}

async function pgvectorEnabled() {
  // Probamos crear y consultar la columna vector indirectamente: si kb_chunks existe la podemos consultar
  const exists = await tableExists("kb_chunks");
  return exists;
}

async function bucketExists(id) {
  const { data, error } = await sb.storage.getBucket(id);
  return !error && !!data;
}

function printInstructions() {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  const dashboardUrl = supabaseUrl.replace(".supabase.co", ".supabase.co/project/_/sql/new");
  console.log("\n============================================");
  console.log("APLICAR MIGRACIÓN MANUAL");
  console.log("============================================\n");
  console.log("Opción 1 — Supabase Dashboard (recomendado):");
  console.log(`  1. Abrir: ${dashboardUrl.replace('/project/_/', '/dashboard/project/')}`);
  console.log(`  2. Pegar el contenido de: ${MIGRATION_PATH}`);
  console.log(`  3. Click "Run"\n`);
  console.log("Opción 2 — Supabase CLI:");
  console.log("  npx supabase db push\n");
  console.log("Tras aplicar, vuelve a ejecutar este script para verificar.\n");
  if (process.argv.includes("--print")) {
    console.log("============================================");
    console.log("CONTENIDO SQL DE LA MIGRACIÓN");
    console.log("============================================\n");
    console.log(sql);
  } else {
    console.log("Para imprimir el SQL completo: node scripts/apply-chatbot-migration.js --print");
  }
}

async function main() {
  console.log("============================================");
  console.log("CHATBOT RAG - Verificación de migración 009");
  console.log("============================================\n");
  console.log(`URL: ${supabaseUrl}\n`);

  // 1. Verificar tablas
  console.log("📋 Tablas requeridas:");
  const tableStatus = {};
  for (const t of REQUIRED_TABLES) {
    const ok = await tableExists(t);
    tableStatus[t] = ok;
    console.log(`   ${ok ? "✅" : "❌"} ${t}`);
  }

  // 2. Verificar columnas en leads
  console.log("\n📋 Columnas agregadas a leads:");
  const colStatus = {};
  for (const c of REQUIRED_LEADS_COLUMNS) {
    const ok = await leadsHasColumn(c);
    colStatus[c] = ok;
    console.log(`   ${ok ? "✅" : "❌"} leads.${c}`);
  }

  // 3. Verificar bucket
  console.log("\n📋 Storage bucket:");
  const bucketOk = await bucketExists("chatbot-kb");
  console.log(`   ${bucketOk ? "✅" : "❌"} chatbot-kb`);

  // 4. Verificar pgvector (indirecto)
  console.log("\n📋 pgvector extension:");
  const vectorOk = await pgvectorEnabled();
  console.log(`   ${vectorOk ? "✅" : "❌"} vector extension (verificado vía kb_chunks)`);

  // 5. Resumen
  const allTables = Object.values(tableStatus).every(Boolean);
  const allCols = Object.values(colStatus).every(Boolean);
  const allOk = allTables && allCols && bucketOk && vectorOk;

  console.log("\n============================================");
  if (allOk) {
    console.log("✅ MIGRACIÓN APLICADA CORRECTAMENTE");
    console.log("Puedes proceder con la Fase 1 (capa LLM).");
    console.log("============================================\n");
  } else {
    console.log("⚠️  MIGRACIÓN PENDIENTE O INCOMPLETA");
    console.log("============================================");
    printInstructions();
  }

  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
