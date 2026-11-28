/**
 * Reenvio temporal de correos entrantes a una cuenta de Gmail.
 *
 * POR QUE EXISTE
 * ==============
 * El 2026-11-27 Supabase restringio el proyecto por exceder la cuota de egress
 * (6,65 GB de 5,5 GB; recarga el 2026-12-04). La restriccion devuelve HTTP 402
 * en TODOS los servicios HTTP de Supabase: REST, Auth, Storage, Realtime.
 *
 * El webhook de correo entrante (app/api/webhook/email/route.js) escribe con
 * createAdminClient(), que habla por REST. Por eso los correos que llegan NO se
 * guardan en la tabla `emails` y el buzon del CRM no los muestra.
 *
 * Lo importante: los correos NO se pierden. Resend los almacena integros y son
 * recuperables por su API (verificado: 76 correos disponibles el 2026-11-27).
 * Este script los lista y los reenvia a una cuenta de Gmail para que el equipo
 * pueda leerlos y responderlos mientras la base no responde.
 *
 * NO depende de Supabase en ningun punto. Funciona con la restriccion activa.
 *
 * CADUCIDAD
 * =========
 * Es una medida temporal. A partir de FORWARD_UNTIL el script se niega a correr
 * y hay que borrarlo junto con su cron. La fecha esta en el codigo a proposito:
 * un reenvio automatico olvidado es una fuga de correo de clientes a una cuenta
 * personal.
 *
 * USO
 *   node scripts/email/forward-to-gmail.mjs                  # reenvia lo pendiente
 *   node scripts/email/forward-to-gmail.mjs --desde 2026-11-24
 *   node scripts/email/forward-to-gmail.mjs --dry-run        # no envia nada
 *   node scripts/email/forward-to-gmail.mjs --limite 5
 *
 * VARIABLES
 *   RESEND_API_KEY        obligatoria
 *   FORWARD_TO            destino (por defecto el de abajo)
 *   FORWARD_FROM          remitente verificado del dominio
 */

import { Resend } from "resend";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// --- Configuracion temporal -------------------------------------------------

/** Despues de esta fecha el script no corre. Coincide con la recarga de cuota. */
const FORWARD_UNTIL = "2026-12-05T00:00:00Z";

const FORWARD_TO = process.env.FORWARD_TO || "bolivaryeni388@gmail.com";
const FORWARD_FROM =
  process.env.FORWARD_FROM || "Venezuela Voyages <ventas@venezuelavoyages.com>";

/** Registro de lo ya reenviado, para que un cron cada 10 min no duplique. */
const STATE_FILE = ".observability/forwarded.json";

/** Tope por ejecucion: evita una rafaga si el estado se pierde. */
const DEFAULT_LIMIT = 40;

/**
 * Ventana por defecto, en horas.
 *
 * El registro de lo ya reenviado (STATE_FILE) no sobrevive entre ejecuciones de
 * GitHub Actions: cada una arranca con un repositorio limpio. Sin una ventana,
 * el script reenviaria los 76 correos del historico cada 10 minutos.
 *
 * Con 3 h se cubre de sobra cualquier ejecucion perdida (el cron corre cada 10
 * min) sin arrastrar el historico. Para recuperar algo mas antiguo esta
 * `--desde`, que es explicito y se usa a mano.
 */
const DEFAULT_WINDOW_HOURS = 3;

// --- Argumentos -------------------------------------------------------------

function parseArgs(argv) {
  const out = { dryRun: false, limite: DEFAULT_LIMIT, desde: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--desde") out.desde = argv[++i];
    else if (a === "--limite") out.limite = Math.max(1, parseInt(argv[++i], 10) || DEFAULT_LIMIT);
  }
  return out;
}

// --- Utilidades -------------------------------------------------------------

/**
 * Escapa texto que viene de un correo ajeno antes de meterlo en la cabecera
 * HTML del reenvio. El remitente y el asunto los controla quien envia, no
 * nosotros: sin escapar, un asunto con etiquetas rompe el HTML o inyecta
 * contenido en el mensaje reenviado.
 */
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --- Estado -----------------------------------------------------------------

async function loadState() {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed.forwarded) ? parsed.forwarded : []);
  } catch {
    // Primera ejecucion, o fichero corrupto: se empieza de cero. Un id repetido
    // solo causa un correo duplicado, que es preferible a no reenviar nada.
    return new Set();
  }
}

async function saveState(ids) {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(
    STATE_FILE,
    JSON.stringify(
      { updated_at: new Date().toISOString(), forwarded: [...ids] },
      null,
      2,
    ),
    "utf8",
  );
}

// --- Principal --------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  if (Date.now() >= Date.parse(FORWARD_UNTIL)) {
    console.error(
      `[forward] CADUCADO. Este reenvio temporal expiro el ${FORWARD_UNTIL}.\n` +
        `[forward] Si la base ya responde, borra este script y su cron en vercel.json.\n` +
        `[forward] Si aun hace falta, mueve FORWARD_UNTIL de forma consciente.`,
    );
    process.exit(1);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[forward] Falta RESEND_API_KEY.");
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  const already = await loadState();

  const { data: listed, error: listErr } = await resend.emails.receiving.list({
    limit: 100,
  });
  if (listErr) {
    console.error("[forward] No se pudo listar los recibidos:", listErr.message);
    process.exit(1);
  }

  const all = listed?.data || [];

  // Sin --desde se aplica la ventana por defecto. Es lo que hace seguro correr
  // esto cada 10 minutos sin estado persistente.
  const desdeTs = args.desde
    ? Date.parse(args.desde)
    : Date.now() - DEFAULT_WINDOW_HOURS * 60 * 60 * 1000;

  // Mas antiguos primero: si el tope corta, se reenvia en orden cronologico.
  const pending = all
    .filter((e) => !already.has(e.id))
    .filter((e) => (desdeTs ? Date.parse(e.created_at) >= desdeTs : true))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .slice(0, args.limite);

  console.log(
    `[forward] recibidos en Resend: ${all.length} | ya reenviados: ${already.size} | a reenviar ahora: ${pending.length}`,
  );
  console.log(`[forward] destino: ${FORWARD_TO}${args.dryRun ? " (DRY-RUN, no se envia)" : ""}`);

  if (pending.length === 0) {
    console.log("[forward] nada pendiente.");
    return;
  }

  let ok = 0;
  let fail = 0;

  for (const mail of pending) {
    const etiqueta = `${(mail.created_at || "").slice(0, 16)} ${mail.from} -> ${(mail.to || []).join(", ")}`;

    if (args.dryRun) {
      console.log(`[forward] DRY-RUN  ${etiqueta} | ${mail.subject || "(sin asunto)"}`);
      ok++;
      continue;
    }

    try {
      // POR QUE NO SE USA receiving.forward() NI forwardWrapped()
      // --------------------------------------------------------
      // Ambos metodos del SDK reenvian el mensaje CRUDO (MIME original), y
      // Resend no conserva el raw de todos los correos recibidos: para los mas
      // antiguos responde "Raw email content is not available for this email"
      // (comprobado el 2026-11-27 con 3 de 3 fallos).
      //
      // El cuerpo si esta disponible por separado (`text` y `html` del endpoint
      // get), asi que se reconstruye el correo y se envia con emails.send. Es
      // mas robusto y funciona con todos los correos, con o sin raw.
      const { data: full, error: getErr } = await resend.emails.receiving.get(mail.id);
      if (getErr) throw new Error(`get: ${getErr.message}`);

      const origen = full?.from || mail.from || "(desconocido)";
      const paraOriginal = (full?.to || mail.to || []).join(", ");
      const fecha = full?.created_at || mail.created_at || "";

      // Cabecera con los datos del mensaje original. Sin ella el lector no sabe
      // quien escribio ni a que direccion llego, porque el remitente tecnico es
      // nuestro dominio (el unico que podemos firmar con DKIM).
      const avisoTexto =
        `--- Reenvio automatico temporal (Venezuela Voyages) ---\n` +
        `De:      ${origen}\n` +
        `Para:    ${paraOriginal}\n` +
        `Fecha:   ${fecha}\n` +
        `Asunto:  ${full?.subject || mail.subject || "(sin asunto)"}\n` +
        `\nPara responder, escribe directamente a ${origen}\n` +
        `-------------------------------------------------------\n\n`;

      const avisoHtml =
        `<div style="border-left:3px solid #999;padding:8px 12px;margin-bottom:16px;` +
        `font:13px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#444;background:#f6f6f6">` +
        `<strong>Reenvío automático temporal</strong><br>` +
        `<b>De:</b> ${escapeHtml(origen)}<br>` +
        `<b>Para:</b> ${escapeHtml(paraOriginal)}<br>` +
        `<b>Fecha:</b> ${escapeHtml(fecha)}<br>` +
        `Para responder, escribe directamente a ${escapeHtml(origen)}` +
        `</div>`;

      const payload = {
        from: FORWARD_FROM,
        to: [FORWARD_TO],
        subject: `[Reenvío] ${full?.subject || mail.subject || "(sin asunto)"}`,
        // reply_to apunta al remitente real: responder desde Gmail llega a quien
        // escribio, no a nuestro buzon.
        reply_to: origen,
      };

      if (full?.html) payload.html = avisoHtml + full.html;
      if (full?.text) payload.text = avisoTexto + full.text;
      if (!payload.html && !payload.text) {
        payload.text = avisoTexto + "(el mensaje original no traia cuerpo legible)";
      }

      const { error } = await resend.emails.send(payload);
      if (error) throw new Error(error.message);

      already.add(mail.id);
      ok++;
      console.log(`[forward] OK       ${etiqueta}`);
    } catch (err) {
      fail++;
      console.error(`[forward] FALLO    ${etiqueta} :: ${err?.message || err}`);
      // Sin romper el bucle: un correo problematico no debe frenar el resto.
      // Al no quedar en el estado, se reintenta en la siguiente ejecucion.
    }
  }

  if (!args.dryRun) await saveState(already);
  console.log(`[forward] terminado. reenviados: ${ok} | fallos: ${fail}`);

  if (fail > 0 && ok === 0) process.exit(1);
}

main().catch((err) => {
  console.error("[forward] error no controlado:", err?.message || err);
  process.exit(1);
});
