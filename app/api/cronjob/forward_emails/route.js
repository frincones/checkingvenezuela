/**
 * CRON TEMPORAL — REENVIO DE CORREOS ENTRANTES A GMAIL
 * CADUCA EL 2026-12-04
 *
 * POR QUE EXISTE
 * ==============
 * Supabase restringio el proyecto por egress el 2026-11-27 y el buzon del CRM
 * dejo de ser accesible (Auth en 402). Mientras tanto, los correos entrantes se
 * reenvian a una cuenta de Gmail para que el equipo pueda leerlos y responder.
 *
 * Los correos NO se pierden: Resend los almacena y los expone por API. Esta
 * ruta los lista y reenvia lo que aun no se haya reenviado.
 *
 * NO depende de Supabase en ningun punto, asi que funciona con la restriccion
 * activa.
 *
 * SE RETIRA quitando la entrada de vercel.json y borrando esta carpeta.
 * Ver REVERTIR.md.
 */

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/db/supabase/server";

/** Pasada esta fecha la ruta se niega a actuar, aunque el cron siga llamando. */
const FORWARD_UNTIL = "2026-12-05T00:00:00Z";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(request) {
  if (
    request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (Date.now() >= Date.parse(FORWARD_UNTIL)) {
    return NextResponse.json({
      skipped: true,
      reason: `El reenvio temporal caduco el ${FORWARD_UNTIL}. Retirar el cron de vercel.json.`,
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const forwardTo = process.env.FORWARD_TO;
  if (!apiKey || !forwardTo) {
    return NextResponse.json(
      { error: "Falta RESEND_API_KEY o FORWARD_TO" },
      { status: 500 },
    );
  }

  const resend = new Resend(apiKey);

  // Ventana: solo lo recibido en las ultimas horas. El cron corre cada 10 min,
  // asi que una ventana de 2 h cubre de sobra cualquier ejecucion perdida sin
  // arrastrar el historico completo en cada llamada.
  const sinceTs = Date.now() - 2 * 60 * 60 * 1000;

  try {
    const { data: listed, error: listErr } = await resend.emails.receiving.list({
      limit: 50,
    });
    if (listErr) throw new Error(listErr.message);

    const enVentana = (listed?.data || [])
      .filter((e) => Date.parse(e.created_at) >= sinceTs)
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

    // ESTADO: que se ha reenviado ya.
    //
    // No puede vivir en un fichero local: en Vercel cada invocacion arranca con
    // un sistema de ficheros limpio, asi que el cron reenviaria los mismos
    // correos cada 10 minutos. Se marca en la tabla `emails`, que es accesible
    // por la conexion directa a Postgres.
    //
    // La columna `forwarded_at` no existe en el esquema y crearla durante una
    // contingencia es mas riesgo del necesario, asi que se usa `metadata`, que
    // ya es jsonb y no la consume ninguna otra logica del buzon.
    const db = createAdminClient();
    const idsResend = enVentana.map((e) => e.id);

    let yaReenviados = new Set();
    if (idsResend.length) {
      const { data: filas, error: qErr } = await db
        .from("emails")
        .select("resend_id, metadata")
        .in("resend_id", idsResend);

      if (qErr) {
        // Sin estado se reenvia de todas formas: un correo duplicado en la
        // bandeja es molesto; uno no entregado puede costar un cliente.
        console.warn(
          "[cron/forward] no se pudo leer el estado, se reenvia sin deduplicar:",
          qErr.message,
        );
      } else {
        yaReenviados = new Set(
          (filas || [])
            .filter((f) => f?.metadata?.forwarded_to_gmail_at)
            .map((f) => f.resend_id),
        );
      }
    }

    const candidatos = enVentana.filter((e) => !yaReenviados.has(e.id));

    let reenviados = 0;
    let fallos = 0;
    const procesados = [];

    for (const mail of candidatos) {
      try {
        const { data: full, error: getErr } = await resend.emails.receiving.get(
          mail.id,
        );
        if (getErr) throw new Error(getErr.message);

        const origen = full?.from || mail.from || "(desconocido)";
        const aviso =
          `<div style="border-left:3px solid #999;padding:8px 12px;margin-bottom:16px;` +
          `font:13px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#444;background:#f6f6f6">` +
          `<strong>Reenvío automático temporal</strong><br>` +
          `<b>De:</b> ${escapeHtml(origen)}<br>` +
          `<b>Para:</b> ${escapeHtml((full?.to || []).join(", "))}<br>` +
          `Responde directamente a ${escapeHtml(origen)}</div>`;

        const payload = {
          from:
            process.env.RESEND_FROM_EMAIL
              ? `Venezuela Voyages <${process.env.RESEND_FROM_EMAIL}>`
              : "Venezuela Voyages <ventas@venezuelavoyages.com>",
          to: [forwardTo],
          subject: `[Reenvío] ${full?.subject || mail.subject || "(sin asunto)"}`,
          reply_to: origen,
        };
        if (full?.html) payload.html = aviso + full.html;
        if (full?.text) payload.text = full.text;
        if (!payload.html && !payload.text) payload.text = "(sin cuerpo legible)";

        const { error: sendErr } = await resend.emails.send(payload);
        if (sendErr) throw new Error(sendErr.message);

        reenviados++;
        procesados.push(mail.id);

        // Se marca despues de enviar, no antes: si el envio falla, el correo
        // sigue pendiente y se reintenta en la siguiente pasada.
        const { error: markErr } = await db
          .from("emails")
          .update({
            metadata: {
              ...(full?.metadata || {}),
              forwarded_to_gmail_at: new Date().toISOString(),
            },
          })
          .eq("resend_id", mail.id);

        if (markErr) {
          // El correo ya se entrego; no poder marcarlo solo implica un posible
          // duplicado en la siguiente pasada. Se registra y se sigue.
          console.warn(
            `[cron/forward] reenviado pero no se pudo marcar ${mail.id}:`,
            markErr.message,
          );
        }
      } catch (err) {
        fallos++;
        console.error(`[cron/forward] fallo ${mail.id}:`, err?.message || err);
      }
    }

    return NextResponse.json({
      ok: true,
      ventana_horas: 2,
      candidatos: candidatos.length,
      reenviados,
      fallos,
    });
  } catch (err) {
    console.error("[cron/forward] error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Error interno" },
      { status: 500 },
    );
  }
}
