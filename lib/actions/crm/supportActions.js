"use server";

/**
 * Server Actions para Tickets de Soporte - CHECK-IN VENEZUELA CRM
 *
 * Acciones del servidor para gestión de tickets de soporte post-venta
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Crear un nuevo ticket de soporte
 */
export async function createSupportTicketAction(ticketData) {
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
    if (!ticketData.booking_type || !ticketData.booking_id) {
      return { error: "El tipo y ID de reserva son requeridos" };
    }

    if (!ticketData.subject) {
      return { error: "El asunto es requerido" };
    }

    if (!ticketData.category) {
      return { error: "La categoría es requerida" };
    }

    const adminClient = createAdminClient();

    // Preparar datos del ticket
    const data = {
      booking_type: ticketData.booking_type,
      booking_id: ticketData.booking_id,
      profile_id: user.id,
      subject: ticketData.subject,
      description: ticketData.description || null,
      category: ticketData.category,
      priority: ticketData.priority || "medium",
      status: "open",
      metadata: ticketData.metadata || {},
    };

    // Insertar ticket
    const { data: ticket, error } = await adminClient
      .from("support_tickets")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("Error creating support ticket:", error);
      return { error: "Error al crear el ticket" };
    }

    // Crear mensaje inicial si hay descripción
    if (ticketData.description) {
      await adminClient.from("ticket_messages").insert({
        ticket_id: ticket.id,
        author_type: "customer",
        author_id: user.id,
        content: ticketData.description,
        is_internal: false,
      });
    }

    revalidatePath("/dashboard/support");
    return { success: true, ticket };
  } catch (error) {
    console.error("Error in createSupportTicketAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Agregar mensaje a un ticket
 */
export async function addTicketMessageAction(ticketId, content, isInternal = false) {
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

    if (!content || content.trim() === "") {
      return { error: "El contenido del mensaje es requerido" };
    }

    const adminClient = createAdminClient();

    // Verificar que el ticket existe
    const { data: ticket } = await adminClient
      .from("support_tickets")
      .select("id, profile_id, status")
      .eq("id", ticketId)
      .single();

    if (!ticket) {
      return { error: "Ticket no encontrado" };
    }

    // Verificar si es asesor
    const { data: advisor } = await supabase
      .from("advisors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    // Determinar tipo de autor
    let authorType = "customer";
    let authorId = user.id;

    if (advisor) {
      authorType = "advisor";
      authorId = advisor.id;
    } else {
      // Si no es asesor, verificar que es el dueño del ticket
      if (ticket.profile_id !== user.id) {
        return { error: "No tienes permiso para agregar mensajes a este ticket" };
      }
      // Clientes no pueden crear notas internas
      isInternal = false;
    }

    // Insertar mensaje
    const { data: message, error } = await adminClient
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        author_type: authorType,
        author_id: authorId,
        content,
        is_internal: isInternal,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding message:", error);
      return { error: "Error al agregar el mensaje" };
    }

    // Actualizar estado del ticket si es necesario
    if (ticket.status === "waiting_customer" && authorType === "customer") {
      await adminClient
        .from("support_tickets")
        .update({ status: "in_progress" })
        .eq("id", ticketId);
    }

    revalidatePath(`/dashboard/support/${ticketId}`);
    revalidatePath(`/backoffice/support/${ticketId}`);
    return { success: true, message };
  } catch (error) {
    console.error("Error in addTicketMessageAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Actualizar estado de un ticket
 */
export async function updateTicketStatusAction(ticketId, newStatus, resolutionNotes = null) {
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

    // Verificar si es asesor
    const { data: advisor } = await supabase
      .from("advisors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (!advisor) {
      return { error: "Solo los asesores pueden cambiar el estado de tickets" };
    }

    const adminClient = createAdminClient();

    const updateData = {
      status: newStatus,
    };

    // Si se resuelve, agregar fecha y notas
    if (newStatus === "resolved" || newStatus === "closed") {
      updateData.resolved_at = new Date().toISOString();
      if (resolutionNotes) {
        updateData.resolution_notes = resolutionNotes;
      }
    }

    const { data: ticket, error } = await adminClient
      .from("support_tickets")
      .update(updateData)
      .eq("id", ticketId)
      .select()
      .single();

    if (error) {
      console.error("Error updating ticket status:", error);
      return { error: "Error al actualizar el estado" };
    }

    // Agregar mensaje del sistema
    await adminClient.from("ticket_messages").insert({
      ticket_id: ticketId,
      author_type: "system",
      content: `Estado del ticket cambiado a: ${newStatus}${resolutionNotes ? `. Resolución: ${resolutionNotes}` : ""}`,
      is_internal: false,
    });

    revalidatePath("/backoffice/support");
    revalidatePath(`/backoffice/support/${ticketId}`);
    revalidatePath(`/dashboard/support/${ticketId}`);
    return { success: true, ticket };
  } catch (error) {
    console.error("Error in updateTicketStatusAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Asignar ticket a un asesor
 */
export async function assignTicketAction(ticketId, advisorId) {
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

    const { data: ticket, error } = await adminClient
      .from("support_tickets")
      .update({
        assigned_advisor_id: advisorId,
        status: "in_progress",
      })
      .eq("id", ticketId)
      .select()
      .single();

    if (error) {
      console.error("Error assigning ticket:", error);
      return { error: "Error al asignar el ticket" };
    }

    // Agregar mensaje del sistema
    await adminClient.from("ticket_messages").insert({
      ticket_id: ticketId,
      author_type: "system",
      content: "Ticket asignado a un asesor",
      is_internal: true,
    });

    revalidatePath("/backoffice/support");
    revalidatePath(`/backoffice/support/${ticketId}`);
    return { success: true, ticket };
  } catch (error) {
    console.error("Error in assignTicketAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Calificar satisfacción del ticket
 */
export async function rateTicketSatisfactionAction(ticketId, rating) {
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

    if (rating < 1 || rating > 5) {
      return { error: "La calificación debe ser entre 1 y 5" };
    }

    const adminClient = createAdminClient();

    // Verificar que el usuario es dueño del ticket
    const { data: ticket } = await adminClient
      .from("support_tickets")
      .select("profile_id, status")
      .eq("id", ticketId)
      .single();

    if (!ticket) {
      return { error: "Ticket no encontrado" };
    }

    if (ticket.profile_id !== user.id) {
      return { error: "No tienes permiso para calificar este ticket" };
    }

    if (!["resolved", "closed"].includes(ticket.status)) {
      return { error: "Solo se pueden calificar tickets resueltos o cerrados" };
    }

    const { data: updatedTicket, error } = await adminClient
      .from("support_tickets")
      .update({ satisfaction_rating: rating })
      .eq("id", ticketId)
      .select()
      .single();

    if (error) {
      console.error("Error rating ticket:", error);
      return { error: "Error al calificar el ticket" };
    }

    revalidatePath(`/dashboard/support/${ticketId}`);
    return { success: true, ticket: updatedTicket };
  } catch (error) {
    console.error("Error in rateTicketSatisfactionAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Crear ticket automáticamente desde cancelación de reserva
 * (Llamado internamente desde las acciones de cancelación)
 */
export async function createTicketFromCancellationAction(
  bookingType,
  bookingId,
  profileId,
  reason = null
) {
  try {
    const adminClient = createAdminClient();

    const ticketData = {
      booking_type: bookingType,
      booking_id: bookingId,
      profile_id: profileId,
      subject: `Cancelación de reserva - ${bookingType === "flight" ? "Vuelo" : "Hotel"}`,
      description: reason || "El cliente ha solicitado cancelar su reserva.",
      category: "cancellation",
      priority: "high",
      status: "open",
      metadata: {
        auto_created: true,
        reason,
      },
    };

    const { data: ticket, error } = await adminClient
      .from("support_tickets")
      .insert(ticketData)
      .select()
      .single();

    if (error) {
      console.error("Error creating cancellation ticket:", error);
      return { error: "Error al crear ticket de cancelación" };
    }

    // Crear mensaje inicial
    await adminClient.from("ticket_messages").insert({
      ticket_id: ticket.id,
      author_type: "system",
      content: `Ticket creado automáticamente por solicitud de cancelación.${reason ? ` Motivo: ${reason}` : ""}`,
      is_internal: false,
    });

    return { success: true, ticket };
  } catch (error) {
    console.error("Error in createTicketFromCancellationAction:", error);
    return { error: "Error interno del servidor" };
  }
}

/**
 * Crear ticket automáticamente desde solicitud de reembolso
 * (Llamado internamente desde las acciones de reembolso)
 */
export async function createTicketFromRefundRequestAction(
  bookingType,
  bookingId,
  profileId,
  reason = null,
  amount = null
) {
  try {
    const adminClient = createAdminClient();

    const ticketData = {
      booking_type: bookingType,
      booking_id: bookingId,
      profile_id: profileId,
      subject: `Solicitud de reembolso - ${bookingType === "flight" ? "Vuelo" : "Hotel"}`,
      description:
        reason || "El cliente ha solicitado un reembolso de su reserva.",
      category: "refund",
      priority: "high",
      status: "open",
      metadata: {
        auto_created: true,
        reason,
        refund_amount: amount,
      },
    };

    const { data: ticket, error } = await adminClient
      .from("support_tickets")
      .insert(ticketData)
      .select()
      .single();

    if (error) {
      console.error("Error creating refund ticket:", error);
      return { error: "Error al crear ticket de reembolso" };
    }

    // Crear mensaje inicial
    await adminClient.from("ticket_messages").insert({
      ticket_id: ticket.id,
      author_type: "system",
      content: `Ticket creado automáticamente por solicitud de reembolso.${reason ? ` Motivo: ${reason}` : ""}${amount ? ` Monto solicitado: $${amount}` : ""}`,
      is_internal: false,
    });

    return { success: true, ticket };
  } catch (error) {
    console.error("Error in createTicketFromRefundRequestAction:", error);
    return { error: "Error interno del servidor" };
  }
}
