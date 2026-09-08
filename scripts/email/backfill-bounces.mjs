/**
 * Rellena metadata.bounce en los correos que ya rebotaron antes de que el
 * webhook guardara el motivo.
 *
 * Contexto: hasta hoy el handler de `email.bounced` solo escribia
 * status='bounced' y descartaba el objeto `bounce` de Resend. Resultado: en el
 * CRM se veia "Rebotado" sin ninguna explicacion, y no habia forma de saber si
 * la direccion estaba muerta o si el servidor nos habia diferido ese dia.
 *
 * Resend conserva el detalle en GET /emails/{id}, asi que las filas viejas se
 * pueden reconstruir. Solo toca filas con status='bounced' que aun no tengan
 * metadata.bounce, y MEZCLA sobre el metadata existente para no borrar el
 * quotation_id de los correos enviados desde una cotizacion.
 *
 * Uso:
 *   node scripts/email/backfill-bounces.mjs           dry-run
 *   node scripts/email/backfill-bounces.mjs --apply
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// Misma normalizacion que app/api/webhook/email/route.js. Si una cambia, la
// otra tiene que cambiar igual: el CRM lee un solo formato.
function buildBounceMeta(bounce) {
  if (!bounce) return null;
  const codes = Array.isArray(bounce.diagnosticCode)
    ? bounce.diagnosticCode
    : bounce.diagnosticCode
      ? [bounce.diagnosticCode]
      : [];
  const smtp = codes.join(" ").match(/\b[45]\d{2}(?:\s+\d\.\d\.\d+)?/);
  return {
    type: bounce.type || "Undetermined",
    sub_type: bounce.subType || bounce.sub_type || null,
    message: bounce.message || null,
    diagnostic_code: codes,
    smtp_code: smtp ? smtp[0] : null,
    permanent: bounce.type === "Permanent",
    recorded_at: new Date().toISOString(),
    backfilled: true,
  };
}

const { data: rows, error } = await sb
  .from("emails")
  .select("id, resend_id, to_emails, subject, metadata, created_at")
  .eq("status", "bounced")
  .not("resend_id", "is", null)
  .order("created_at");

if (error) {
  console.error("Error leyendo emails:", error.message);
  process.exit(1);
}

const pending = rows.filter((r) => !r.metadata?.bounce);
console.log(
  `rebotados: ${rows.length} - sin motivo guardado: ${pending.length}\n`,
);

const ops = [];
for (const row of pending) {
  const res = await fetch(`https://api.resend.com/emails/${row.resend_id}`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!res.ok) {
    console.log(`  ${row.resend_id} -> Resend devolvio ${res.status}, se omite`);
    continue;
  }
  const full = await res.json();
  const meta = buildBounceMeta(full.bounce);
  if (!meta) {
    console.log(`  ${row.resend_id} -> sin objeto bounce, se omite`);
    continue;
  }

  const to = (row.to_emails || []).map((t) => t.email || t).join(", ");
  console.log(
    `  ${row.created_at.slice(0, 10)}  ${meta.type.padEnd(11)} ${meta.smtp_code || "-"}  ${to}`,
  );

  ops.push({
    id: row.id,
    metadata: { ...(row.metadata || {}), bounce: meta },
  });
}

if (ops.length === 0) {
  console.log("\nNada que rellenar.");
  process.exit(0);
}

if (!APPLY) {
  console.log(`\nDry-run. ${ops.length} filas listas. Repite con --apply.`);
  process.exit(0);
}

let ok = 0;
for (const op of ops) {
  const { error: e } = await sb
    .from("emails")
    .update({ metadata: op.metadata })
    .eq("id", op.id);
  if (e) console.log(`  ERROR ${op.id}: ${e.message}`);
  else ok++;
}
console.log(`\n${ok}/${ops.length} filas actualizadas.`);
