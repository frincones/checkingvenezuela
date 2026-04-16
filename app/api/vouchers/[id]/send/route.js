/**
 * POST /api/vouchers/[id]/send
 *
 * Sends the voucher PDF via email (as attachment + download link).
 *
 * Body: { recipient_email, recipient_name?, custom_message? }
 *
 * Flow:
 *  1. Auth check
 *  2. Load voucher + ensure PDF is up-to-date
 *  3. Download PDF bytes → base64
 *  4. Build email HTML + attach PDF
 *  5. Send via Mailjet
 *  6. Update voucher: status=sent, sent_at, sent_to_email
 */

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { getVoucherById } from "@/lib/vouchers/queries";
import { voucherSendSchema } from "@/lib/vouchers/schema";
import { generateVoucherPDF } from "@/lib/pdf/voucher-generator";
import { uploadVoucherPDF } from "@/lib/vouchers/storage";
import { buildVoucherEmailHtml } from "@/lib/email/voucherEmailHtml";
import sendEmail from "@/lib/email/sendEmail";
import { validateAttachmentSize, formatBytes } from "@/lib/email/attachmentLimits";

function fmtDateEs(val) {
  if (!val) return "";
  try {
    return new Date(`${val}T12:00:00`).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;

    // Auth
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Validate body
    const body = await request.json();
    const parsed = voucherSendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Datos inválidos",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // Load voucher
    const voucher = await getVoucherById(id);
    if (!voucher) {
      return NextResponse.json({ error: "Voucher no encontrado" }, { status: 404 });
    }
    if (voucher.status === "cancelled") {
      return NextResponse.json(
        { error: "No se puede enviar un voucher cancelado" },
        { status: 400 },
      );
    }

    // Ensure fresh PDF
    let pdfBytes;
    if (voucher.pdf_stale || !voucher.pdf_url) {
      pdfBytes = await generateVoucherPDF(voucher);
      const { publicUrl } = await uploadVoucherPDF(voucher.voucher_number, pdfBytes);

      const admin = createAdminClient();
      await admin
        .from("vouchers")
        .update({
          pdf_url: publicUrl,
          pdf_generated_at: new Date().toISOString(),
          pdf_stale: false,
          ...(voucher.status === "draft"
            ? { status: "issued", issued_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", id);

      voucher.pdf_url = publicUrl;
    } else {
      pdfBytes = await generateVoucherPDF(voucher);
    }

    // Build email
    const acc = voucher.services?.accommodation || {};
    const dates = [fmtDateEs(acc.check_in), fmtDateEs(acc.check_out)]
      .filter(Boolean)
      .join(" al ");

    const clientName =
      parsed.data.recipient_name ||
      voucher.lead?.contact_name ||
      voucher.passengers?.[0]?.full_name ||
      "Cliente";

    const html = buildVoucherEmailHtml({
      voucherNumber: voucher.voucher_number,
      title: voucher.title,
      clientName,
      issueDate: fmtDateEs(voucher.issue_date),
      locatorCode: voucher.locator_code || "",
      accommodationName: acc.hotel_name || "",
      dates,
      passengerCount: voucher.passengers?.length || 0,
      pdfUrl: voucher.pdf_url || "",
      customMessage: parsed.data.custom_message || "",
    });

    // Validate PDF size before sending
    const sizeCheck = validateAttachmentSize(
      [{ size: pdfBytes.byteLength || pdfBytes.length }],
      "mailjet"
    );
    if (!sizeCheck.ok) {
      return NextResponse.json(
        {
          error: `El PDF del voucher (${formatBytes(pdfBytes.byteLength || pdfBytes.length)}) excede el límite de envío por email. ${sizeCheck.error}`,
        },
        { status: 413 }
      );
    }

    // Send
    const attachments = [
      {
        ContentType: "application/pdf",
        Filename: `voucher-${voucher.voucher_number}.pdf`,
        Base64Content: Buffer.from(pdfBytes).toString("base64"),
      },
    ];

    await sendEmail(
      [{ Email: parsed.data.recipient_email, Name: clientName }],
      `Voucher ${voucher.voucher_number} — Venezuela Voyages`,
      html,
      attachments,
    );

    // Update voucher status
    const admin = createAdminClient();
    await admin
      .from("vouchers")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_to_email: parsed.data.recipient_email,
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      sent_to: parsed.data.recipient_email,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Voucher send error:", error);
    const msg = error.message || "";
    const isSize = /size|too large|payload|limit|413/i.test(msg);
    return NextResponse.json(
      {
        error: isSize
          ? "El voucher PDF es demasiado grande para enviarse por email. Intenta reducir las imágenes del voucher."
          : `Error al enviar el voucher: ${msg}`,
      },
      { status: isSize ? 413 : 500 },
    );
  }
}
