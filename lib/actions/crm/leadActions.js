"use server";

/**
 * Server Actions para Leads - CHECK-IN VENEZUELA CRM
 *
 * Acciones del servidor para gestión de leads
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Crear un nuevo lead
 */
export async function createLeadAction(leadData) {
  try {
    const adminClient = createAdminClient();

    // Validar campos requeridos
    if (!leadData.contact_name) {
      return { error: "El nombre de contacto es requerido" };
    }

    if (!leadData.source) {
      return { error: "La fuente del lead es requerida" };
    }

    if (!leadData.interest_type) {
      return { error: "El tipo de interés es requerido" };
    }

    // Preparar datos del lead
    const data = {
      source: leadData.source,
      status: "new",
      contact_name: leadData.contact_name,
      contact_email: leadData.contact_email || null,
      contact_phone: leadData.contact_phone || null,
      contact_phone_dial_code: leadData.contact_phone_dial_code || "+58",
      preferred_contact_method: leadData.preferred_contact_method || "whatsapp",
      interest_type: leadData.interest_type,
      interest_details: leadData.interest_details || {},
      profile_id: leadData.profile_id || null,
      anonymous_user_id: leadData.anonymous_user_id || null,
      utm_source: leadData.utm_source || null,
      utm_medium: leadData.utm_medium || null,
      utm_campaign: leadData.utm_campaign || null,
      referrer_url: leadData.referrer_url || null,
      landing_page: leadData.landing_page || null,
    };

    // Insertar lead
    const { data: lead, error } = await adminClient
      .from("leads")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("Error creating lead:", error);
      return { error: "Error al crear el lead" };
    }

    // Crear interacción inicial
    await adminClient.from("lead_interactions").insert({
      lead_id: lead.id,
      type: "system",
      content: `Lead creado desde ${leadData.source}`,
      metadata: {
        source: leadData.source,
        initial_interest: leadData.interest_type,
      },
    });

    revalidatePath("/backoffice/leads");
    return { success: true, lead };
  } catch (error) {
    console.error("Error in createLeadAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Actualizar estado de un lead
 */
export async function updateLeadStatusAction(leadId, newStatus) {
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

    // Obtener lead actual
    const adminClient = createAdminClient();
    const { data: currentLead } = await adminClient
      .from("leads")
      .select("status, advisor_id")
      .eq("id", leadId)
      .single();

    if (!currentLead) {
      return { error: "Lead no encontrado" };
    }

    // Actualizar estado
    const { data: lead, error } = await adminClient
      .from("leads")
      .update({
        status: newStatus,
        last_contacted_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .select()
      .single();

    if (error) {
      console.error("Error updating lead status:", error);
      return { error: "Error al actualizar el estado" };
    }

    // Verificar si el usuario es asesor
    const { data: advisor } = await supabase
      .from("advisors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    // Registrar cambio de estado
    await adminClient.from("lead_interactions").insert({
      lead_id: leadId,
      advisor_id: advisor?.id || null,
      type: "status_change",
      content: `Estado cambiado de "${currentLead.status}" a "${newStatus}"`,
      metadata: {
        previous_status: currentLead.status,
        new_status: newStatus,
      },
    });

    revalidatePath("/backoffice/leads");
    revalidatePath(`/backoffice/leads/${leadId}`);
    return { success: true, lead };
  } catch (error) {
    console.error("Error in updateLeadStatusAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Asignar lead a un asesor
 */
export async function assignLeadAction(leadId, advisorId) {
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

    // Obtener lead actual
    const { data: currentLead } = await adminClient
      .from("leads")
      .select("advisor_id")
      .eq("id", leadId)
      .single();

    if (!currentLead) {
      return { error: "Lead no encontrado" };
    }

    // Actualizar asignación
    const { data: lead, error } = await adminClient
      .from("leads")
      .update({
        advisor_id: advisorId,
        assigned_at: new Date().toISOString(),
        status: currentLead.status === "new" ? "contacted" : currentLead.status,
      })
      .eq("id", leadId)
      .select()
      .single();

    if (error) {
      console.error("Error assigning lead:", error);
      return { error: "Error al asignar el lead" };
    }

    // Registrar asignación
    await adminClient.from("lead_interactions").insert({
      lead_id: leadId,
      advisor_id: advisorId,
      type: "system",
      content: "Lead asignado a asesor",
      metadata: {
        previous_advisor_id: currentLead.advisor_id,
        new_advisor_id: advisorId,
      },
    });

    revalidatePath("/backoffice/leads");
    revalidatePath(`/backoffice/leads/${leadId}`);
    return { success: true, lead };
  } catch (error) {
    console.error("Error in assignLeadAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Agregar interacción a un lead
 */
export async function addLeadInteractionAction(leadId, interactionData) {
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

    const adminClient = createAdminClient();

    // Crear interacción
    const { data: interaction, error } = await adminClient
      .from("lead_interactions")
      .insert({
        lead_id: leadId,
        advisor_id: advisor?.id || null,
        type: interactionData.type,
        content: interactionData.content,
        metadata: interactionData.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding interaction:", error);
      return { error: "Error al agregar la interacción" };
    }

    // Actualizar última fecha de contacto
    await adminClient
      .from("leads")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", leadId);

    revalidatePath(`/backoffice/leads/${leadId}`);
    return { success: true, interaction };
  } catch (error) {
    console.error("Error in addLeadInteractionAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Actualizar seguimiento de lead
 */
export async function updateLeadFollowUpAction(leadId, nextFollowUpDate) {
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

    const { data: lead, error } = await adminClient
      .from("leads")
      .update({
        next_follow_up_at: nextFollowUpDate,
      })
      .eq("id", leadId)
      .select()
      .single();

    if (error) {
      console.error("Error updating follow up:", error);
      return { error: "Error al actualizar el seguimiento" };
    }

    revalidatePath("/backoffice/leads");
    revalidatePath(`/backoffice/leads/${leadId}`);
    return { success: true, lead };
  } catch (error) {
    console.error("Error in updateLeadFollowUpAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Convertir lead a reserva (marcar como ganado)
 */
export async function convertLeadAction(leadId, bookingType, bookingId) {
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

    const { data: lead, error } = await adminClient
      .from("leads")
      .update({
        status: "won",
        converted_at: new Date().toISOString(),
        conversion_booking_type: bookingType,
        conversion_booking_id: bookingId,
      })
      .eq("id", leadId)
      .select()
      .single();

    if (error) {
      console.error("Error converting lead:", error);
      return { error: "Error al convertir el lead" };
    }

    // Verificar si el usuario es asesor
    const { data: advisor } = await supabase
      .from("advisors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    // Registrar conversión
    await adminClient.from("lead_interactions").insert({
      lead_id: leadId,
      advisor_id: advisor?.id || null,
      type: "system",
      content: `Lead convertido a reserva (${bookingType})`,
      metadata: {
        booking_type: bookingType,
        booking_id: bookingId,
      },
    });

    revalidatePath("/backoffice/leads");
    revalidatePath(`/backoffice/leads/${leadId}`);
    return { success: true, lead };
  } catch (error) {
    console.error("Error in convertLeadAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Crear lead desde intención de cotización (WhatsApp)
 * Esta función se llama desde el frontend cuando se hace clic en "Cotizar"
 */
export async function createLeadFromQuoteIntentAction(quoteData) {
  try {
    const supabase = await createClient();

    // Verificar si el usuario está autenticado
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adminClient = createAdminClient();

    // Preparar datos del lead
    const leadData = {
      source: "whatsapp",
      status: "new",
      contact_name: quoteData.contact_name || "Usuario Web",
      contact_email: quoteData.contact_email || null,
      contact_phone: quoteData.contact_phone || null,
      contact_phone_dial_code: "+58",
      preferred_contact_method: "whatsapp",
      interest_type: quoteData.interest_type || "other",
      interest_details: quoteData.interest_details || {},
      profile_id: user?.id || null,
      utm_source: quoteData.utm_source || null,
      utm_medium: quoteData.utm_medium || null,
      utm_campaign: quoteData.utm_campaign || null,
      landing_page: quoteData.landing_page || null,
    };

    // Insertar lead
    const { data: lead, error } = await adminClient
      .from("leads")
      .insert(leadData)
      .select()
      .single();

    if (error) {
      console.error("Error creating lead from quote intent:", error);
      return { error: "Error al registrar la intención de cotización" };
    }

    // Crear interacción inicial
    await adminClient.from("lead_interactions").insert({
      lead_id: lead.id,
      type: "system",
      content: `Lead creado desde intención de cotización WhatsApp`,
      metadata: {
        source: "whatsapp",
        interest_type: quoteData.interest_type,
        interest_details: quoteData.interest_details,
      },
    });

    return { success: true, lead_id: lead.id };
  } catch (error) {
    console.error("Error in createLeadFromQuoteIntentAction:", error);
    return { error: "Error interno del servidor" };
  }
}
