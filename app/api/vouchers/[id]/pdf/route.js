/**
 * GET /api/vouchers/[id]/pdf
 *
 * Generates (or returns cached) voucher PDF.
 *
 * Logic:
 *  - Authenticate
 *  - Load voucher
 *  - If pdf_stale=false AND pdf_url exists → download from storage
 *  - Otherwise → generate fresh → upload → update row → respond
 *  - If voucher was draft → transition to "issued"
 */

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { getVoucherById } from "@/lib/vouchers/queries";
import { generateVoucherPDF } from "@/lib/pdf/voucher-generator";
import { uploadVoucherPDF, downloadVoucherPDF, pathFromPublicUrl } from "@/lib/vouchers/storage";

export async function GET(request, { params }) {
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

    // Load voucher
    const voucher = await getVoucherById(id);
    if (!voucher) {
      return NextResponse.json({ error: "Voucher no encontrado" }, { status: 404 });
    }

    if (voucher.status === "cancelled") {
      return NextResponse.json(
        { error: "No se puede generar PDF de un voucher cancelado" },
        { status: 400 },
      );
    }

    // Try cached version
    if (!voucher.pdf_stale && voucher.pdf_url) {
      const storagePath = pathFromPublicUrl(voucher.pdf_url);
      if (storagePath) {
        const cached = await downloadVoucherPDF(storagePath);
        if (cached) {
          return new NextResponse(cached, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `inline; filename="voucher-${voucher.voucher_number}.pdf"`,
            },
          });
        }
      }
    }

    // Generate
    const pdfBytes = await generateVoucherPDF(voucher);

    // Upload to storage
    const { publicUrl } = await uploadVoucherPDF(voucher.voucher_number, pdfBytes);

    // Update voucher record
    const admin = createAdminClient();
    const updates = {
      pdf_url: publicUrl,
      pdf_generated_at: new Date().toISOString(),
      pdf_stale: false,
    };

    // Transition draft → issued on first PDF generation
    if (voucher.status === "draft") {
      updates.status = "issued";
      updates.issued_at = new Date().toISOString();
    }

    await admin.from("vouchers").update(updates).eq("id", id);

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="voucher-${voucher.voucher_number}.pdf"`,
        "X-PDF-URL": publicUrl || "",
      },
    });
  } catch (error) {
    console.error("Voucher PDF error:", error);
    return NextResponse.json(
      { error: `Error al generar el PDF: ${error.message}` },
      { status: 500 },
    );
  }
}
