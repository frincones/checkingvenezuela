/**
 * API de Ticket Messages - CHECK-IN VENEZUELA CRM
 *
 * POST /api/crm/support/[id]/messages - Agrega mensaje a un ticket
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST - Agrega un mensaje a un ticket
 */
export async function POST(request, { params }) {
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

    // Validar contenido
    if (!body.content || body.content.trim() === "") {
      return NextResponse.json(
        { error: "El contenido del mensaje es requerido" },
        { status: 400 }
      );
    }

    // Verificar que el ticket existe
    const adminClient = createAdminClient();
    const { data: ticket } = await adminClient
      .from("support_tickets")
      .select("id, profile_id, status")
      .eq("id", id)
      .single();

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket no encontrado" },
        { status: 404 }
      );
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
        return NextResponse.json(
          { error: "No tienes permiso para agregar mensajes a este ticket" },
          { status: 403 }
        );
      }
    }

    // Preparar datos del mensaje
    const messageData = {
      ticket_id: id,
      author_type: authorType,
      author_id: authorId,
      content: body.content,
      attachments: body.attachments || [],
      is_internal: advisor ? body.is_internal || false : false, // Solo asesores pueden crear notas internas
    };

    // Insertar mensaje
    const { data: message, error } = await adminClient
      .from("ticket_messages")
      .insert(messageData)
      .select()
      .single();

    if (error) {
      console.error("Error creating message:", error);
      return NextResponse.json(
        { error: "Error al agregar el mensaje" },
        { status: 500 }
      );
    }

    // Actualizar estado del ticket si es necesario
    if (ticket.status === "waiting_customer" && authorType === "customer") {
      await adminClient
        .from("support_tickets")
        .update({ status: "in_progress" })
        .eq("id", id);
    } else if (
      ticket.status === "open" &&
      authorType === "advisor" &&
      !body.is_internal
    ) {
      await adminClient
        .from("support_tickets")
        .update({ status: "in_progress" })
        .eq("id", id);
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/crm/support/[id]/messages:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
