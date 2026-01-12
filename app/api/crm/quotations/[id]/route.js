/**
 * API de Quotation Individual - CHECK-IN VENEZUELA CRM
 *
 * GET /api/crm/quotations/[id] - Obtiene una cotización específica
 * PATCH /api/crm/quotations/[id] - Actualiza una cotización
 * POST /api/crm/quotations/[id]/send - Envía cotización (en otro archivo)
 * POST /api/crm/quotations/[id]/convert - Convierte a reserva (en otro archivo)
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET - Obtiene una cotización específica
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Use admin client to bypass RLS for CRM operations
    const adminClient = createAdminClient();

    // Obtener cotización con relaciones
    const { data: quotation, error } = await adminClient
      .from("quotations")
      .select(
        `
        *,
        lead:leads(
          id,
          contact_name,
          contact_email,
          contact_phone,
          interest_type,
          interest_details,
          status
        ),
        advisor:advisors(
          id,
          employee_code,
          department,
          whatsapp_number,
          profile:profiles(first_name, last_name, email, profile_image)
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Cotización no encontrada" },
          { status: 404 }
        );
      }
      console.error("Error fetching quotation:", error);
      return NextResponse.json(
        { error: "Error al obtener la cotización" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: quotation });
  } catch (error) {
    console.error("Error in GET /api/crm/quotations/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Actualiza una cotización
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Use admin client to bypass RLS for CRM operations
    const adminClient = createAdminClient();

    // Obtener cotización actual
    const { data: currentQuotation } = await adminClient
      .from("quotations")
      .select("status, subtotal, taxes, fees, discount_amount")
      .eq("id", id)
      .single();

    if (!currentQuotation) {
      return NextResponse.json(
        { error: "Cotización no encontrada" },
        { status: 404 }
      );
    }

    // No permitir editar cotizaciones convertidas
    if (currentQuotation.status === "converted") {
      return NextResponse.json(
        { error: "No se puede editar una cotización ya convertida" },
        { status: 400 }
      );
    }

    // Preparar datos de actualización
    const updateData = {};

    if (body.items) {
      updateData.items = body.items;
      // Recalcular totales
      const subtotal = body.items.reduce(
        (sum, item) => sum + (item.total || 0),
        0
      );
      updateData.subtotal = subtotal;
      updateData.total =
        subtotal +
        (body.taxes ?? currentQuotation.taxes ?? 0) +
        (body.fees ?? currentQuotation.fees ?? 0) -
        (body.discount_amount ?? currentQuotation.discount_amount ?? 0);
    }

    const allowedFields = [
      "status",
      "sent_at",
      "taxes",
      "fees",
      "discount_amount",
      "discount_reason",
      "currency",
      "valid_until",
      "internal_notes",
      "customer_notes",
      "terms_and_conditions",
      "pdf_url",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Si se actualizan taxes, fees o discount, recalcular total
    if (
      body.taxes !== undefined ||
      body.fees !== undefined ||
      body.discount_amount !== undefined
    ) {
      const subtotal = updateData.subtotal ?? currentQuotation.subtotal;
      const taxes = body.taxes ?? currentQuotation.taxes;
      const fees = body.fees ?? currentQuotation.fees;
      const discount = body.discount_amount ?? currentQuotation.discount_amount;

      updateData.total = subtotal + taxes + fees - discount;
    }

    // Actualizar cotización
    const { data: quotation, error } = await adminClient
      .from("quotations")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        lead:leads(
          id,
          contact_name,
          contact_email,
          contact_phone,
          interest_type
        ),
        advisor:advisors(
          id,
          employee_code,
          profile:profiles(first_name, last_name, email, profile_image)
        )
      `
      )
      .single();

    if (error) {
      console.error("Error updating quotation:", error);
      return NextResponse.json(
        { error: "Error al actualizar la cotización" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: quotation });
  } catch (error) {
    console.error("Error in PATCH /api/crm/quotations/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Elimina una cotización (solo borradores)
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Use admin client to bypass RLS for CRM operations
    const adminClient = createAdminClient();

    // Verificar que es un borrador
    const { data: quotation } = await adminClient
      .from("quotations")
      .select("status")
      .eq("id", id)
      .single();

    if (!quotation) {
      return NextResponse.json(
        { error: "Cotización no encontrada" },
        { status: 404 }
      );
    }

    if (quotation.status !== "draft") {
      return NextResponse.json(
        { error: "Solo se pueden eliminar cotizaciones en borrador" },
        { status: 400 }
      );
    }

    // Eliminar cotización
    const { error } = await adminClient.from("quotations").delete().eq("id", id);

    if (error) {
      console.error("Error deleting quotation:", error);
      return NextResponse.json(
        { error: "Error al eliminar la cotización" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Cotización eliminada correctamente" });
  } catch (error) {
    console.error("Error in DELETE /api/crm/quotations/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
