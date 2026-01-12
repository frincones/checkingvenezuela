"use server";

/**
 * Server Actions para Cotizaciones - CHECK-IN VENEZUELA CRM
 *
 * Acciones del servidor para gestión de cotizaciones
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Crear una nueva cotización
 */
export async function createQuotationAction(quotationData) {
  try {
    const supabase = await createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "No autorizado" };
    }

    // Validar campos requeridos
    if (!quotationData.lead_id) {
      return { error: "El lead_id es requerido" };
    }

    if (
      !quotationData.items ||
      !Array.isArray(quotationData.items) ||
      quotationData.items.length === 0
    ) {
      return { error: "Se requiere al menos un item en la cotización" };
    }

    // Verificar si el usuario es asesor
    const { data: advisor } = await supabase
      .from("advisors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (!advisor) {
      return { error: "Solo los asesores pueden crear cotizaciones" };
    }

    // Calcular totales
    const subtotal = quotationData.items.reduce(
      (sum, item) => sum + (item.total || 0),
      0
    );
    const taxes = quotationData.taxes || 0;
    const fees = quotationData.fees || 0;
    const discount_amount = quotationData.discount_amount || 0;
    const total = subtotal + taxes + fees - discount_amount;

    // Preparar datos
    const data = {
      lead_id: quotationData.lead_id,
      advisor_id: advisor.id,
      items: quotationData.items,
      subtotal,
      taxes,
      fees,
      discount_amount,
      discount_reason: quotationData.discount_reason || null,
      total,
      currency: quotationData.currency || "USD",
      status: "draft",
      valid_until: quotationData.valid_until || null,
      internal_notes: quotationData.internal_notes || null,
      customer_notes: quotationData.customer_notes || null,
      terms_and_conditions: quotationData.terms_and_conditions || null,
    };

    const adminClient = createAdminClient();

    // Insertar cotización
    const { data: quotation, error } = await adminClient
      .from("quotations")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("Error creating quotation:", error);
      return { error: "Error al crear la cotización" };
    }

    // Actualizar estado del lead
    await adminClient
      .from("leads")
      .update({ status: "quoting" })
      .eq("id", quotationData.lead_id)
      .in("status", ["new", "contacted"]);

    // Crear interacción
    await adminClient.from("lead_interactions").insert({
      lead_id: quotationData.lead_id,
      advisor_id: advisor.id,
      type: "system",
      content: `Cotización ${quotation.quotation_number} creada`,
      metadata: {
        quotation_id: quotation.id,
        quotation_number: quotation.quotation_number,
        total: quotation.total,
      },
    });

    revalidatePath("/backoffice/quotations");
    revalidatePath(`/backoffice/leads/${quotationData.lead_id}`);
    return { success: true, quotation };
  } catch (error) {
    console.error("Error in createQuotationAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Enviar cotización (cambiar estado a "sent")
 */
export async function sendQuotationAction(quotationId, via = "whatsapp") {
  try {
    const supabase = await createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "No autorizado" };
    }

    // Verificar si el usuario es asesor
    const { data: advisor } = await supabase
      .from("advisors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (!advisor) {
      return { error: "Solo los asesores pueden enviar cotizaciones" };
    }

    const adminClient = createAdminClient();

    // Obtener cotización actual
    const { data: currentQuotation } = await adminClient
      .from("quotations")
      .select("status, lead_id, quotation_number")
      .eq("id", quotationId)
      .single();

    if (!currentQuotation) {
      return { error: "Cotización no encontrada" };
    }

    if (!["draft", "sent"].includes(currentQuotation.status)) {
      return { error: "Esta cotización no puede ser enviada nuevamente" };
    }

    // Actualizar cotización
    const { data: quotation, error } = await adminClient
      .from("quotations")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_via: via,
      })
      .eq("id", quotationId)
      .select()
      .single();

    if (error) {
      console.error("Error sending quotation:", error);
      return { error: "Error al enviar la cotización" };
    }

    // Actualizar estado del lead
    await adminClient
      .from("leads")
      .update({ status: "quote_sent" })
      .eq("id", currentQuotation.lead_id);

    // Crear interacción
    await adminClient.from("lead_interactions").insert({
      lead_id: currentQuotation.lead_id,
      advisor_id: advisor.id,
      type: "quote_sent",
      content: `Cotización ${currentQuotation.quotation_number} enviada por ${via}`,
      metadata: {
        quotation_id: quotationId,
        sent_via: via,
      },
    });

    revalidatePath("/backoffice/quotations");
    revalidatePath(`/backoffice/quotations/${quotationId}`);
    revalidatePath(`/backoffice/leads/${currentQuotation.lead_id}`);
    return { success: true, quotation };
  } catch (error) {
    console.error("Error in sendQuotationAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Marcar cotización como vista
 */
export async function markQuotationViewedAction(quotationId) {
  try {
    const adminClient = createAdminClient();

    const { data: quotation, error } = await adminClient
      .from("quotations")
      .update({
        status: "viewed",
        viewed_at: new Date().toISOString(),
      })
      .eq("id", quotationId)
      .eq("status", "sent") // Solo si está en estado "sent"
      .select()
      .single();

    if (error) {
      console.error("Error marking quotation as viewed:", error);
      return { error: "Error al actualizar la cotización" };
    }

    return { success: true, quotation };
  } catch (error) {
    console.error("Error in markQuotationViewedAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Aceptar cotización
 */
export async function acceptQuotationAction(quotationId) {
  try {
    const adminClient = createAdminClient();

    // Obtener cotización actual
    const { data: currentQuotation } = await adminClient
      .from("quotations")
      .select("status, lead_id, advisor_id, quotation_number")
      .eq("id", quotationId)
      .single();

    if (!currentQuotation) {
      return { error: "Cotización no encontrada" };
    }

    if (!["sent", "viewed"].includes(currentQuotation.status)) {
      return { error: "Esta cotización no puede ser aceptada" };
    }

    // Actualizar cotización
    const { data: quotation, error } = await adminClient
      .from("quotations")
      .update({ status: "accepted" })
      .eq("id", quotationId)
      .select()
      .single();

    if (error) {
      console.error("Error accepting quotation:", error);
      return { error: "Error al aceptar la cotización" };
    }

    // Actualizar estado del lead
    await adminClient
      .from("leads")
      .update({ status: "awaiting_payment" })
      .eq("id", currentQuotation.lead_id);

    // Crear interacción
    await adminClient.from("lead_interactions").insert({
      lead_id: currentQuotation.lead_id,
      advisor_id: currentQuotation.advisor_id,
      type: "system",
      content: `Cotización ${currentQuotation.quotation_number} aceptada por el cliente`,
      metadata: {
        quotation_id: quotationId,
        status: "accepted",
      },
    });

    revalidatePath("/backoffice/quotations");
    revalidatePath(`/backoffice/quotations/${quotationId}`);
    revalidatePath(`/backoffice/leads/${currentQuotation.lead_id}`);
    return { success: true, quotation };
  } catch (error) {
    console.error("Error in acceptQuotationAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Rechazar cotización
 */
export async function rejectQuotationAction(quotationId, reason = null) {
  try {
    const adminClient = createAdminClient();

    // Obtener cotización actual
    const { data: currentQuotation } = await adminClient
      .from("quotations")
      .select("status, lead_id, advisor_id, quotation_number")
      .eq("id", quotationId)
      .single();

    if (!currentQuotation) {
      return { error: "Cotización no encontrada" };
    }

    if (!["sent", "viewed", "accepted"].includes(currentQuotation.status)) {
      return { error: "Esta cotización no puede ser rechazada" };
    }

    // Actualizar cotización
    const { data: quotation, error } = await adminClient
      .from("quotations")
      .update({
        status: "rejected",
        internal_notes: reason
          ? `Rechazada: ${reason}`
          : currentQuotation.internal_notes,
      })
      .eq("id", quotationId)
      .select()
      .single();

    if (error) {
      console.error("Error rejecting quotation:", error);
      return { error: "Error al rechazar la cotización" };
    }

    // Crear interacción
    await adminClient.from("lead_interactions").insert({
      lead_id: currentQuotation.lead_id,
      advisor_id: currentQuotation.advisor_id,
      type: "system",
      content: `Cotización ${currentQuotation.quotation_number} rechazada${reason ? `: ${reason}` : ""}`,
      metadata: {
        quotation_id: quotationId,
        status: "rejected",
        reason,
      },
    });

    revalidatePath("/backoffice/quotations");
    revalidatePath(`/backoffice/quotations/${quotationId}`);
    revalidatePath(`/backoffice/leads/${currentQuotation.lead_id}`);
    return { success: true, quotation };
  } catch (error) {
    console.error("Error in rejectQuotationAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Convertir cotización a reserva
 */
export async function convertQuotationToBookingAction(
  quotationId,
  bookingType,
  bookingId
) {
  try {
    const supabase = await createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "No autorizado" };
    }

    const adminClient = createAdminClient();

    // Obtener cotización actual
    const { data: currentQuotation } = await adminClient
      .from("quotations")
      .select("status, lead_id, advisor_id, quotation_number")
      .eq("id", quotationId)
      .single();

    if (!currentQuotation) {
      return { error: "Cotización no encontrada" };
    }

    if (!["accepted", "viewed", "sent"].includes(currentQuotation.status)) {
      return { error: "Esta cotización no puede ser convertida" };
    }

    // Actualizar cotización
    const { data: quotation, error } = await adminClient
      .from("quotations")
      .update({
        status: "converted",
        converted_at: new Date().toISOString(),
        converted_booking_type: bookingType,
        converted_booking_id: bookingId,
      })
      .eq("id", quotationId)
      .select()
      .single();

    if (error) {
      console.error("Error converting quotation:", error);
      return { error: "Error al convertir la cotización" };
    }

    // Actualizar lead
    await adminClient
      .from("leads")
      .update({
        status: "paid",
        converted_at: new Date().toISOString(),
        conversion_booking_type: bookingType,
        conversion_booking_id: bookingId,
      })
      .eq("id", currentQuotation.lead_id);

    // Crear interacción
    await adminClient.from("lead_interactions").insert({
      lead_id: currentQuotation.lead_id,
      advisor_id: currentQuotation.advisor_id,
      type: "system",
      content: `Cotización ${currentQuotation.quotation_number} convertida a reserva`,
      metadata: {
        quotation_id: quotationId,
        booking_type: bookingType,
        booking_id: bookingId,
      },
    });

    revalidatePath("/backoffice/quotations");
    revalidatePath(`/backoffice/quotations/${quotationId}`);
    revalidatePath(`/backoffice/leads/${currentQuotation.lead_id}`);
    return { success: true, quotation };
  } catch (error) {
    console.error("Error in convertQuotationToBookingAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Actualizar items de cotización
 */
export async function updateQuotationItemsAction(quotationId, items) {
  try {
    const supabase = await createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "No autorizado" };
    }

    // Verificar cotización actual
    const { data: currentQuotation } = await supabase
      .from("quotations")
      .select("status, taxes, fees, discount_amount")
      .eq("id", quotationId)
      .single();

    if (!currentQuotation) {
      return { error: "Cotización no encontrada" };
    }

    if (currentQuotation.status === "converted") {
      return { error: "No se puede editar una cotización convertida" };
    }

    // Calcular nuevos totales
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const total =
      subtotal +
      currentQuotation.taxes +
      currentQuotation.fees -
      currentQuotation.discount_amount;

    // Actualizar
    const { data: quotation, error } = await supabase
      .from("quotations")
      .update({
        items,
        subtotal,
        total,
      })
      .eq("id", quotationId)
      .select()
      .single();

    if (error) {
      console.error("Error updating quotation items:", error);
      return { error: "Error al actualizar los items" };
    }

    revalidatePath(`/backoffice/quotations/${quotationId}`);
    return { success: true, quotation };
  } catch (error) {
    console.error("Error in updateQuotationItemsAction:", error);
    return { error: "Error interno del servidor" };
  }
}
