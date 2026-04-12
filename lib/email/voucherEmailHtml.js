/**
 * Generates the HTML body for a voucher delivery email.
 *
 * This is a simple inline HTML builder (not a Handlebars template) because
 * the voucher email is straightforward: a summary block + the PDF attached.
 * It follows the same visual style as the other transactional emails
 * (primary color, centered card, footer).
 */

const PRIMARY_COLOR = "#0A1A44";
const SECONDARY_COLOR = "#F2A93B";
const BG_COLOR = "#f9fafb";
const CARD_BG = "#ffffff";

function esc(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {object} opts
 * @param {string} opts.voucherNumber
 * @param {string} opts.title
 * @param {string} opts.clientName
 * @param {string} opts.issueDate
 * @param {string} [opts.locatorCode]
 * @param {string} [opts.accommodationName]
 * @param {string} [opts.dates]
 * @param {number} [opts.passengerCount]
 * @param {string} [opts.pdfUrl]  - Download link (fallback if attachment not supported)
 * @param {string} [opts.customMessage]
 * @returns {string} HTML
 */
export function buildVoucherEmailHtml(opts) {
  const {
    voucherNumber = "",
    title = "Voucher de Servicios Pre-pagados",
    clientName = "Cliente",
    issueDate = "",
    locatorCode = "",
    accommodationName = "",
    dates = "",
    passengerCount = 0,
    pdfUrl = "",
    customMessage = "",
  } = opts;

  const rows = [];
  if (locatorCode) rows.push(["Localizador", locatorCode]);
  if (accommodationName) rows.push(["Alojamiento", accommodationName]);
  if (dates) rows.push(["Fechas", dates]);
  if (passengerCount) rows.push(["Pasajeros", String(passengerCount)]);

  const summaryRows = rows
    .map(
      ([l, v]) =>
        `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px;">${esc(l)}</td><td style="padding:6px 12px;font-weight:600;font-size:13px;color:${PRIMARY_COLOR}">${esc(v)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="ltr" lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:ui-sans-serif,system-ui,sans-serif;">
<table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:24px;">
<tr><td>

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${PRIMARY_COLOR};border-radius:8px 8px 0 0;padding:24px;">
  <tr><td style="text-align:center;padding:24px;">
    <h1 style="margin:0;color:${SECONDARY_COLOR};font-size:20px;font-weight:700;">VENEZUELA VOYAGES</h1>
    <p style="margin:4px 0 0;color:#b4b4c3;font-size:13px;">Tu viaje comienza aqui</p>
  </td></tr>
  </table>

  <!-- Body -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${CARD_BG};padding:32px;border:1px solid #e5e7eb;">
  <tr><td>
    <p style="margin:0 0 8px;font-size:14px;color:#374151;">Hola <strong>${esc(clientName)}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      Su voucher <strong style="color:${PRIMARY_COLOR}">${esc(voucherNumber)}</strong> ha sido emitido.
      ${customMessage ? `<br/><br/>${esc(customMessage)}` : ""}
    </p>

    <h2 style="margin:0 0 12px;font-size:16px;color:${PRIMARY_COLOR};">${esc(title)}</h2>

    ${
      summaryRows
        ? `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;border-radius:6px;margin-bottom:20px;">${summaryRows}</table>`
        : ""
    }

    <p style="font-size:13px;color:#6b7280;margin:16px 0 8px;">
      El documento PDF del voucher se encuentra <strong>adjunto a este correo</strong>.
    </p>

    ${
      pdfUrl
        ? `<p style="margin:0 0 20px;">
        <a href="${esc(pdfUrl)}" target="_blank" rel="noopener"
           style="display:inline-block;background-color:${SECONDARY_COLOR};color:#fff;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
          Descargar Voucher
        </a>
      </p>`
        : ""
    }

    <p style="font-size:12px;color:#9ca3af;margin:20px 0 0;">
      Presentar este voucher al momento del check-in. Para cualquier consulta, contacte a
      <strong>info@venezuelavoyages.com</strong> o al <strong>+58 426 403 4052</strong>.
    </p>
  </td></tr>
  </table>

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:16px;text-align:center;">
  <tr><td>
    <p style="margin:0;font-size:11px;color:#9ca3af;">
      VENEZUELA VOYAGES | www.venezuelavoyages.com | +58 426 403 4052
    </p>
    <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">
      &copy; ${new Date().getFullYear()} Venezuela Voyages. Todos los derechos reservados.
    </p>
  </td></tr>
  </table>

</td></tr>
</table>
</body>
</html>`;
}
