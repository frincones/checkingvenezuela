/**
 * API de Ticket Individual - CHECK-IN VENEZUELA CRM
 *
 * GET /api/crm/support/[id] - Obtiene un ticket específico
 * PATCH /api/crm/support/[id] - Actualiza un ticket
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET - Obtiene un ticket específico con mensajes
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

    // Obtener ticket con relaciones
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .select(
        `
        *,
        profile:profiles(first_name, last_name, email, profile_image),
        assigned_advisor:advisors(
          id,
          employee_code,
          department,
          whatsapp_number,
          profile:profiles(first_name, last_name, email, profile_image)
        ),
        messages:ticket_messages(
          id,
          author_type,
          author_id,
          content,
          attachments,
          is_internal,
          created_at
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Ticket no encontrado" },
          { status: 404 }
        );
      }
      console.error("Error fetching ticket:", error);
      return NextResponse.json(
        { error: "Error al obtener el ticket" },
        { status: 500 }
      );
    }

    // Ordenar mensajes por fecha
    if (ticket.messages) {
      ticket.messages.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
    }

    // Filtrar mensajes internos si el usuario no es asesor
    const { data: advisor } = await supabase
      .from("advisors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (!advisor && ticket.messages) {
      ticket.messages = ticket.messages.filter((m) => !m.is_internal);
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("Error in GET /api/crm/support/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Actualiza un ticket
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

    // Verificar si es asesor
    const { data: advisor } = await supabase
      .from("advisors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    // Preparar datos de actualización
    const updateData = {};

    // Campos que puede actualizar el cliente
    const customerFields = ["satisfaction_rating"];

    // Campos que puede actualizar el asesor
    const advisorFields = [
      "assigned_advisor_id",
      "subject",
      "category",
      "priority",
      "status",
      "resolution_notes",
    ];

    // Si es cliente, solo puede actualizar campos permitidos
    if (!advisor) {
      for (const field of customerFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }
    } else {
      // Si es asesor, puede actualizar más campos
      for (const field of [...customerFields, ...advisorFields]) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }
    }

    // Si se resuelve el ticket, agregar fecha de resolución
    if (body.status === "resolved" || body.status === "closed") {
      updateData.resolved_at = new Date().toISOString();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron campos para actualizar" },
        { status: 400 }
      );
    }

    // Actualizar ticket
    const adminClient = createAdminClient();

    const { data: ticket, error } = await adminClient
      .from("support_tickets")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        profile:profiles(first_name, last_name, email, profile_image),
        assigned_advisor:advisors(
          id,
          employee_code,
          profile:profiles(first_name, last_name, email, profile_image)
        )
      `
      )
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Ticket no encontrado" },
          { status: 404 }
        );
      }
      console.error("Error updating ticket:", error);
      return NextResponse.json(
        { error: "Error al actualizar el ticket" },
        { status: 500 }
      );
    }

    // Si se cambió el estado, agregar mensaje del sistema
    if (body.status) {
      await adminClient.from("ticket_messages").insert({
        ticket_id: id,
        author_type: "system",
        content: `Estado del ticket cambiado a: ${body.status}`,
        is_internal: false,
      });
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("Error in PATCH /api/crm/support/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
