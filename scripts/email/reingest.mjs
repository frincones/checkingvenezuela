/**
 * Re-ingesta de correos entrantes desde Resend hacia la tabla `emails`.
 *
 * POR QUE EXISTE
 * ==============
 * Mientras Supabase estuvo restringido por egress (desde el 2026-11-24), el
 * webhook de correo entrante no pudo escribir en la base: createAdminClient()
 * hablaba por PostgREST, que devolvia 402. Los correos siguieron llegando a
 * Resend, pero no quedaron en la tabla `emails`, asi que el buzon del CRM tiene
 * un hueco en ese periodo.
 *
 * Resend almacena los recibidos integros y los expone por API (verificado el
 * 2026-11-27: 76 correos disponibles). Este script los lee y los inserta por
 * conexion directa a Postgres, que si funciona.
 *
 * IDEMPOTENTE
 * ===========
 * Inserta con ON CONFLICT (resend_id) DO NOTHING. Ejecutarlo dos veces no
 * duplica nada, y los correos que el webhook si logro guardar se respetan tal
 * como estan.
 *
 * ADJUNTOS
 * ========
 * No se recuperan los ficheros: viven en Supabase Storage, que sigue
 * restringido. Se guardan los metadatos con storage_path:null y un
 * ingest_error, igual que hace el webhook cuando la subida falla. Los ficheros
 * siguen en Resend y se pueden recuperar despues del 2026-12-04.
 *
 * USO
 *   node scripts/email/reingest.mjs --dry-run
 *   node scripts/email/reingest.mjs --desde 2026-11-24
 *   node scripts/email/reingest.mjs
 */

import { Resend } from "resend";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg;

function parseArgs(argv) {
  const out = { dryRun: false, desde: null, limite: 200 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--dry-run") out.dryRun = true;
    else if (argv[i] === "--desde") out.desde = argv[++i];
    else if (argv[i] === "--limite") out.limite = parseInt(argv[++i], 10) || 200;
  }
  return out;
}

function buildConnString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const pw = process.env.SUPABASE_DB_PASSWORD;
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(
    /https:\/\/([a-z0-9]+)\.supabase\.co/i,
  )?.[1];
  if (!pw || !ref) {
    throw new Error("Falta SUPABASE_DB_PASSWORD o NEXT_PUBLIC_SUPABASE_URL");
  }
  const host = process.env.SUPABASE_DB_HOST || "aws-1-us-east-1.pooler.supabase.com";
  const port = process.env.SUPABASE_DB_PORT || "6543";
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@${host}:${port}/postgres`;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!process.env.RESEND_API_KEY) {
    console.error("[reingest] Falta RESEND_API_KEY.");
    process.exit(1);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: listed, error: listErr } = await resend.emails.receiving.list({ limit: 100 });
  if (listErr) {
    console.error("[reingest] No se pudo listar:", listErr.message);
    process.exit(1);
  }

  const desdeTs = args.desde ? Date.parse(args.desde) : null;
  const candidatos = (listed?.data || [])
    .filter((e) => (desdeTs ? Date.parse(e.created_at) >= desdeTs : true))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .slice(0, args.limite);

  console.log(`[reingest] correos en Resend: ${(listed?.data || []).length} | a procesar: ${candidatos.length}`);

  const client = new Client({
    connectionString: buildConnString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let insertados = 0;
  let yaExistian = 0;
  let fallos = 0;

  try {
    for (const item of candidatos) {
      try {
        const { data: full, error: getErr } = await resend.emails.receiving.get(item.id);
        if (getErr) throw new Error(`get: ${getErr.message}`);

        const toEmails = (full?.to || item.to || []).map((e) =>
          typeof e === "string" ? { email: e } : e,
        );

        // Metadatos de adjuntos sin fichero: Storage sigue restringido.
        const attachments = (full?.attachments || []).map((a) => ({
          filename: a.filename || a.name || "adjunto",
          content_type: a.content_type || a.contentType || "application/octet-stream",
          size: a.size ?? null,
          storage_path: null,
          ingest_error: "storage_restringido_egress_2026-11",
        }));

        if (args.dryRun) {
          console.log(`[reingest] DRY-RUN ${(item.created_at || "").slice(0, 16)} ${item.from} | ${item.subject || "(sin asunto)"}`);
          insertados++;
          continue;
        }

        const res = await client.query(
          `INSERT INTO emails
             (id, resend_id, direction, folder, from_email, to_emails, cc,
              subject, body_html, body_text, attachments, status, is_read,
              message_id, in_reply_to, created_at)
           VALUES ($1,$2,'inbound','inbox',$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9::jsonb,
                   'delivered',false,$10,$11,$12)
           ON CONFLICT (resend_id) DO NOTHING
           RETURNING id`,
          [
            randomUUID(),
            item.id,
            full?.from || item.from || null,
            JSON.stringify(toEmails),
            JSON.stringify(full?.cc || []),
            full?.subject || item.subject || null,
            full?.html || null,
            full?.text || null,
            JSON.stringify(attachments),
            full?.message_id || null,
            full?.reply_to || null,
            item.created_at || new Date().toISOString(),
          ],
        );

        if (res.rowCount === 1) {
          insertados++;
          console.log(`[reingest] NUEVO   ${(item.created_at || "").slice(0, 16)} ${item.from}`);
        } else {
          yaExistian++;
        }
      } catch (err) {
        fallos++;
        console.error(`[reingest] FALLO   ${item.id} :: ${err?.message || err}`);
      }
    }
  } finally {
    await client.end();
  }

  console.log(`[reingest] terminado. nuevos: ${insertados} | ya existian: ${yaExistian} | fallos: ${fallos}`);
}

main().catch((err) => {
  console.error("[reingest] error no controlado:", err?.message || err);
  process.exit(1);
});
