/**
 * Correos de una solicitud de reserva o cotización.
 *
 * Se envían con Resend, no con lib/email/sendEmail.js. Ese helper usa Mailjet
 * y sus credenciales (MAIL_API_TOKEN, MAIL_SECRET_TOKEN, MAIL_SENDER_EMAIL) no
 * están definidas ni en local ni en Vercel, así que detecta que faltan, escribe
 * un warning y retorna sin enviar nada. Resend sí está configurado en
 * producción y es lo que mueve las cotizaciones y el buzón del CRM.
 *
 * Dos destinatarios con contenido distinto a propósito:
 *   · cliente — confirmación de lo que pidió, para que le quede constancia
 *   · equipo  — todo el contexto, para poder responder sin abrir el CRM
 *
 * El del cliente va en el idioma en que rellenó el formulario; el del equipo
 * siempre en español, que es el idioma del CRM.
 */

const BRAND = "#0A1A44";
const ACCENT = "#F2A93B";

/** Escapa texto que viene del formulario antes de meterlo en el HTML. */
function esc(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const COPY = {
  en: {
    subject: (p) => (p ? `We received your request — ${p}` : "We received your request"),
    heading: "Thanks, we have your request",
    intro: (name) =>
      `Hi ${name || "there"}, thanks for getting in touch. One of our travel advisors is reviewing your request and will reply within 24 hours.`,
    summary: "What you asked for",
    labels: {
      product: "Experience",
      period: "Travel dates",
      travelers: "Travelers",
      channel: "We will reply by",
      message: "Your message",
      requirements: "Special requirements",
      flight: "International flight",
    },
    flightYes: "Assistance requested",
    closing:
      "If anything changes, just reply to this email and it reaches your advisor directly.",
    signoff: "Venezuela Voyages",
  },
  es: {
    subject: (p) => (p ? `Recibimos tu solicitud — ${p}` : "Recibimos tu solicitud"),
    heading: "Gracias, ya tenemos tu solicitud",
    intro: (name) =>
      `Hola ${name || ""}, gracias por escribirnos. Un asesor está revisando tu solicitud y te responderá en menos de 24 horas.`,
    summary: "Lo que nos pediste",
    labels: {
      product: "Experiencia",
      period: "Fechas de viaje",
      travelers: "Viajeros",
      channel: "Te responderemos por",
      message: "Tu mensaje",
      requirements: "Requisitos especiales",
      flight: "Vuelo internacional",
    },
    flightYes: "Solicita asistencia",
    closing:
      "Si algo cambia, responde a este correo y le llega directamente a tu asesor.",
    signoff: "Venezuela Voyages",
  },
};

const CHANNEL_LABEL = {
  en: { whatsapp: "WhatsApp", email: "Email", phone: "Phone call" },
  es: { whatsapp: "WhatsApp", email: "Correo", phone: "Llamada" },
};

function row(label, value) {
  if (!value) return "";
  return `<tr>
    <td style="padding:7px 0;color:#6B7280;font-size:13px;width:40%;vertical-align:top">${esc(label)}</td>
    <td style="padding:7px 0;color:${BRAND};font-size:14px;font-weight:600">${esc(value)}</td>
  </tr>`;
}

/**
 * Correo al cliente. Deliberadamente NO lleva datos de identidad: la solicitud
 * web no los recoge, y aunque los recogiera, el correo no es un canal donde
 * deban viajar.
 */
export function buildClientEmail(data) {
  const locale = data.locale === "es" ? "es" : "en";
  const t = COPY[locale];
  const L = t.labels;

  const travelers =
    data.travelers_count ||
    [data.adults && `${data.adults} adults`, data.children && `${data.children} children`]
      .filter(Boolean)
      .join(", ");

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F5F3EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EF;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#FFFFFF;border-radius:12px;overflow:hidden">

        <tr><td style="background:${BRAND};padding:22px 26px">
          <div style="color:${ACCENT};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700">Venezuela Voyages</div>
          <div style="color:#FFFFFF;font-size:21px;font-weight:700;margin-top:5px">${esc(t.heading)}</div>
        </td></tr>

        <tr><td style="padding:24px 26px">
          <p style="margin:0 0 18px;color:#374151;font-size:14px;line-height:1.6">${esc(t.intro(data.contact_name))}</p>

          <div style="border-top:1px solid #E5E7EB;padding-top:14px">
            <div style="color:#9CA3AF;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;margin-bottom:6px">${esc(t.summary)}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${row(L.product, data.product_name)}
              ${row(L.period, data.travel_period)}
              ${row(L.travelers, travelers)}
              ${row(L.flight, data.needs_flight ? t.flightYes : "")}
              ${row(L.message, data.message)}
              ${row(L.requirements, data.special_requirements)}
              ${row(L.channel, CHANNEL_LABEL[locale][data.preferred_channel] || "")}
            </table>
          </div>

          <p style="margin:20px 0 0;color:#6B7280;font-size:13px;line-height:1.6">${esc(t.closing)}</p>
        </td></tr>

        <tr><td style="background:#FAFAF8;padding:16px 26px;border-top:1px solid #E5E7EB">
          <div style="color:${BRAND};font-size:13px;font-weight:700">${esc(t.signoff)}</div>
          <div style="color:#9CA3AF;font-size:12px;margin-top:3px">venezuelavoyages.com</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject: t.subject(data.product_name), html };
}

/** Correo al equipo. Lleva todo el contexto para poder responder sin abrir el CRM. */
export function buildTeamEmail(data) {
  const travelers =
    data.travelers_count ||
    [data.adults && `${data.adults} adultos`, data.children && `${data.children} niños`]
      .filter(Boolean)
      .join(", ");

  const companions = Array.isArray(data.companions) ? data.companions.filter(Boolean) : [];

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F5F3EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EF;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border-radius:12px;overflow:hidden">

        <tr><td style="background:${BRAND};padding:18px 24px">
          <div style="color:${ACCENT};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700">Nueva solicitud del sitio web</div>
          <div style="color:#FFFFFF;font-size:19px;font-weight:700;margin-top:4px">${esc(data.product_name || "Consulta general")}</div>
        </td></tr>

        <tr><td style="padding:20px 24px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${row("Nombre", data.contact_name)}
            ${row("Email", data.contact_email)}
            ${row("Teléfono", [data.contact_phone_dial_code, data.contact_phone].filter(Boolean).join(" "))}
            ${row("Responder por", CHANNEL_LABEL.es[data.preferred_channel] || "")}
            ${row("Fechas", data.travel_period)}
            ${row("Viajeros", travelers)}
            ${row("Acompañantes", companions.join(", "))}
            ${row("Vuelo internacional", data.needs_flight ? "Sí" : "")}
            ${row("Ciudad de salida", data.departure_city)}
            ${row("Mensaje", data.message)}
            ${row("Requisitos", data.special_requirements)}
            ${row("Origen", data.landing_page)}
            ${row("Campaña", [data.utm_source, data.utm_campaign].filter(Boolean).join(" / "))}
          </table>

          ${
            data.lead_id
              ? `<div style="margin-top:18px;padding-top:14px;border-top:1px solid #E5E7EB">
                   <a href="https://www.venezuelavoyages.com/dashboard/leads/${esc(data.lead_id)}"
                      style="display:inline-block;background:${ACCENT};color:${BRAND};text-decoration:none;
                             font-weight:700;font-size:13px;padding:9px 16px;border-radius:7px">
                     Abrir en el CRM
                   </a>
                 </div>`
              : ""
          }
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  const who = data.contact_name || data.contact_email || "sin nombre";
  return {
    subject: `Solicitud web · ${data.product_name || "Consulta general"} · ${who}`,
    html,
  };
}
