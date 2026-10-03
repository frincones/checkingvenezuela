/**
 * POST /api/booking-requests
 *
 * Punto de entrada del modal público de solicitud. Crea el lead y la solicitud,
 * y envía los dos correos (cliente y equipo).
 *
 * Endpoint propio en vez de ampliar /api/crm/leads porque ese lo consumen 11
 * sitios del CRM (listado, alta, detalle, edición, alta de cotizaciones, el
 * formulario de paquete y el modal antiguo). Cambiar su contrato propagaría
 * riesgo a todos ellos; aquí el contrato es nuestro y nadie más depende de él.
 *
 * El lead se crea con la MISMA forma de datos que usa el endpoint existente,
 * para que el CRM lo trate igual que a cualquier otro.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/server";
import { Resend } from "resend";
import {
  buildClientEmail,
  buildTeamEmail,
} from "@/lib/email/bookingRequestEmails";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "ventas@venezuelavoyages.com";
const TEAM_EMAIL = process.env.BOOKING_TEAM_EMAIL || "reservas@venezuelavoyages.com";

let resend = null;
function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

/**
 * Límite por IP, en memoria.
 *
 * Mismo patrón que app/api/chatbot/chat/route.js. El endpoint es público y sin
 * autenticación (tiene que serlo: lo usa un visitante anónimo), así que sin
 * esto cualquiera podría llenar la tabla de leads. No sustituye a un captcha;
 * si llega spam real habrá que añadir uno.
 *
 * En memoria significa por instancia: en serverless cada una tiene su contador,
 * así que el límite efectivo es más alto que el nominal. Suficiente para frenar
 * un script casero, no para un ataque dirigido.
 */
const rateLimits = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQ = 5;

function checkRateLimit(key) {
  const now = Date.now();
  const entry = rateLimits.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count++;
  rateLimits.set(key, entry);
  return entry.count <= RATE_MAX_REQ;
}

function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHANNELS = ["whatsapp", "email", "phone"];

export async function POST(request) {
  try {
    const ip = clientIp(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const body = await request.json();

    // El email es el único campo imprescindible: sin él no hay forma de
    // responder ni de mandar la copia que el cliente espera.
    if (!body.contact_email || !EMAIL_RE.test(String(body.contact_email))) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!body.consent) {
      return NextResponse.json(
        { error: "Consent is required to process your request." },
        { status: 400 }
      );
    }

    const locale = body.locale === "es" ? "es" : "en";
    const channel = CHANNELS.includes(body.preferred_channel)
      ? body.preferred_channel
      : "whatsapp";

    const admin = createAdminClient();

    // ── 1. Lead ───────────────────────────────────────────────────────────
    // Misma forma que /api/crm/leads para que el CRM no distinga su origen.
    // El contexto extra va en interest_details (JSONB): verificado que el CRM
    // lo guarda pero no lo renderiza, así que añadir claves no rompe vistas.
    const leadPayload = {
      source: "web_form",
      status: "new",
      contact_name: body.contact_name || body.contact_email,
      contact_email: body.contact_email,
      contact_phone: body.contact_phone || null,
      contact_phone_dial_code: body.contact_phone_dial_code || "+58",
      preferred_contact_method: channel,
      interest_type: body.product_type === "package" ? "package" : "other",
      interest_details: {
        origin: body.origin || "booking_modal",
        product_name: body.product_name || null,
        product_slug: body.product_slug || null,
        travel_period: body.travel_period || null,
        travelers: body.travelers_count || null,
        message: body.message || null,
      },
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      referrer_url: body.referrer_url || null,
      landing_page: body.landing_page || null,
      consent_accepted_at: new Date().toISOString(),
      consent_text_version: body.consent_version || "v1",
    };

    const { data: lead, error: leadError } = await admin
      .from("leads")
      .insert(leadPayload)
      .select("id")
      .single();

    if (leadError) {
      console.error("[booking-requests] lead insert failed", leadError.message);
      return NextResponse.json(
        { error: "We could not save your request. Please try again." },
        { status: 500 }
      );
    }

    // ── 2. Solicitud ──────────────────────────────────────────────────────
    const requestPayload = {
      lead_id: lead.id,
      request_type: body.request_type === "booking" ? "booking" : "quote",
      product_type: body.product_type || null,
      product_slug: body.product_slug || null,
      product_name: body.product_name || null,
      travel_period: body.travel_period || null,
      travelers_count: body.travelers_count ?? null,
      adults: body.adults ?? null,
      children: body.children ?? null,
      preferred_channel: channel,
      companions: Array.isArray(body.companions) ? body.companions : [],
      needs_flight: !!body.needs_flight,
      departure_city: body.departure_city || null,
      message: body.message || null,
      special_requirements: body.special_requirements || null,
      locale,
    };

    const { data: bookingRequest, error: brError } = await admin
      .from("booking_requests")
      .insert(requestPayload)
      .select("id")
      .single();

    // Si falla la solicitud el lead ya existe, así que el contacto no se pierde
    // y un asesor puede responder igual. Se registra y se sigue.
    if (brError) {
      console.error("[booking-requests] request insert failed", brError.message);
    }

    // ── 3. Correos ────────────────────────────────────────────────────────
    // No bloquean la respuesta: si Resend falla, el lead ya está guardado y el
    // cliente no debe ver un error por algo que puede reintentarse.
    const emailData = { ...requestPayload, ...leadPayload, lead_id: lead.id };
    const sentAt = {};

    try {
      const { subject, html } = buildClientEmail(emailData);
      const { error } = await getResend().emails.send({
        from: `Venezuela Voyages <${FROM_EMAIL}>`,
        to: body.contact_email,
        replyTo: TEAM_EMAIL,
        subject,
        html,
      });
      if (error) console.error("[booking-requests] client email", error);
      else sentAt.client_email_sent_at = new Date().toISOString();
    } catch (e) {
      console.error("[booking-requests] client email threw", e.message);
    }

    try {
      const { subject, html } = buildTeamEmail(emailData);
      const { error } = await getResend().emails.send({
        from: `Venezuela Voyages <${FROM_EMAIL}>`,
        to: TEAM_EMAIL,
        replyTo: body.contact_email,
        subject,
        html,
      });
      if (error) console.error("[booking-requests] team email", error);
      else sentAt.team_email_sent_at = new Date().toISOString();
    } catch (e) {
      console.error("[booking-requests] team email threw", e.message);
    }

    // Deja constancia de qué se envió, para diagnosticar sin revisar logs.
    if (bookingRequest?.id && Object.keys(sentAt).length) {
      await admin.from("booking_requests").update(sentAt).eq("id", bookingRequest.id);
    }

    return NextResponse.json({
      ok: true,
      lead_id: lead.id,
      booking_request_id: bookingRequest?.id || null,
      copy_sent: !!sentAt.client_email_sent_at,
    });
  } catch (error) {
    console.error("[booking-requests] unexpected", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
