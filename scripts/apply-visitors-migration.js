/**
 * Verifica/aplica la migración 010_chatbot_visitors.sql.
 * Mismo patrón que apply-chatbot-migration.js — la migración real se
 * aplica vía Supabase Dashboard SQL Editor.
 */

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const MIGRATION_PATH = path.join(__dirname, "..", "supabase", "migrations", "010_chatbot_visitors.sql");

async function tableExists(name) {
  const { error } = await sb.from(name).select("id").limit(1);
  if (!error) return true;
  if (error.code === "42P01" || error.code === "PGRST205") return false;
  return true;
}

async function columnExists(table, col) {
  const { error } = await sb.from(table).select(col).limit(1);
  if (error && error.code === "42703") return false;
  return !error;
}

function printInstructions() {
  const dashboardUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(
    ".supabase.co",
    ".supabase.co"
  ).replace("https://", "https://supabase.com/dashboard/project/");
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL
    .replace("https://", "")
    .replace(".supabase.co", "");
  console.log("\n============================================");
  console.log("APLICAR MIGRACIÓN MANUAL");
  console.log("============================================\n");
  console.log("1. Abre: https://supabase.com/dashboard/project/" + projectRef + "/sql/new");
  console.log("2. Pega el contenido de:", MIGRATION_PATH);
  console.log('3. Click "Run"\n');
  if (process.argv.includes("--print")) {
    console.log("============================================");
    console.log("CONTENIDO SQL");
    console.log("============================================\n");
    console.log(fs.readFileSync(MIGRATION_PATH, "utf8"));
  } else {
    console.log("Para ver el SQL: node scripts/apply-visitors-migration.js --print");
  }
}

async function main() {
  console.log("============================================");
  console.log("CHATBOT VISITORS - Verificación migración 010");
  console.log("============================================\n");

  console.log("📋 Tabla chat_visitors:");
  const visitorsOk = await tableExists("chat_visitors");
  console.log(`   ${visitorsOk ? "✅" : "❌"} chat_visitors`);

  console.log("\n📋 Columnas en chat_conversations:");
  const visitorIdOk = await columnExists("chat_conversations", "visitor_id");
  const titleOk = await columnExists("chat_conversations", "title");
  console.log(`   ${visitorIdOk ? "✅" : "❌"} chat_conversations.visitor_id`);
  console.log(`   ${titleOk ? "✅" : "❌"} chat_conversations.title`);

  if (visitorsOk && visitorIdOk) {
    // Verificar migración de datos
    const { data: stats } = await sb
      .from("chat_visitors")
      .select("id", { count: "exact", head: true });
    const { count: visitorCount } = await sb
      .from("chat_visitors")
      .select("*", { count: "exact", head: true });
    const { count: convsCount } = await sb
      .from("chat_conversations")
      .select("*", { count: "exact", head: true });
    const { count: linkedCount } = await sb
      .from("chat_conversations")
      .select("*", { count: "exact", head: true })
      .not("visitor_id", "is", null);
    console.log(
      `\n📊 Visitors: ${visitorCount ?? "?"}, Conversaciones: ${convsCount ?? "?"}, Vinculadas: ${linkedCount ?? "?"}`
    );

    console.log("\n============================================");
    console.log("✅ MIGRACIÓN 010 APLICADA");
    console.log("============================================\n");
    process.exit(0);
  }

  console.log("\n⚠️  MIGRACIÓN PENDIENTE");
  printInstructions();
  process.exit(1);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
