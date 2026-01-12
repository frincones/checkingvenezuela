/**
 * API de Lead Individual - CHECK-IN VENEZUELA CRM
 *
 * GET /api/crm/leads/[id] - Obtiene un lead por ID
 * PATCH /api/crm/leads/[id] - Actualiza un lead
 * DELETE /api/crm/leads/[id] - Elimina un lead
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET - Obtiene un lead por ID
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();

    // Verificar autenticacion
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const adminClient = createAdminClient();

    const { data: lead, error } = await adminClient
      .from("leads")
      .select(
        `
        *,
        advisor:advisors(
          id,
          employee_code,
          profile:profiles(first_name, last_name, email, profile_image)
        ),
        profile:profiles(first_name, last_name, email, profile_image),
        interactions:lead_interactions(
          id,
          type,
          content,
          metadata,
          created_at,
          advisor:advisors(
            id,
            employee_code,
            profile:profiles(first_name, last_name)
          )
        ),
        quotations:quotations(
          id,
          quotation_number,
          status,
          total,
          currency,
          created_at
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching lead:", error);
      return NextResponse.json(
        { error: "Lead no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Error in GET /api/crm/leads/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Actualiza un lead
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();

    // Verificar autenticacion
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const adminClient = createAdminClient();

    // Campos permitidos para actualizar
    const allowedFields = [
      "status",
      "advisor_id",
      "contact_name",
      "contact_email",
      "contact_phone",
      "contact_phone_dial_code",
      "preferred_contact_method",
      "interest_type",
      "interest_details",
      "next_follow_up_at",
      "last_contacted_at",
    ];

    // Filtrar solo campos permitidos
    const updateData = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Si se actualiza el estado, registrar el cambio
    const previousLead = await adminClient
      .from("leads")
      .select("status")
      .eq("id", id)
      .single();

    const { data: lead, error } = await adminClient
      .from("leads")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        advisor:advisors(
          id,
          employee_code,
          profile:profiles(first_name, last_name, email, profile_image)
        ),
        profile:profiles(first_name, last_name, email, profile_image)
      `
      )
      .single();

    if (error) {
      console.error("Error updating lead:", error);
      return NextResponse.json(
        { error: "Error al actualizar el lead" },
        { status: 500 }
      );
    }

    // Si el estado cambio, crear interaccion
    if (body.status && previousLead.data?.status !== body.status) {
      // Obtener advisor_id del usuario actual si es asesor
      const { data: advisor } = await adminClient
        .from("advisors")
        .select("id")
        .eq("profile_id", user.id)
        .single();

      await adminClient.from("lead_interactions").insert({
        lead_id: id,
        advisor_id: advisor?.id || null,
        type: "status_change",
        content: `Estado cambiado de ${previousLead.data?.status} a ${body.status}`,
        metadata: {
          previous_status: previousLead.data?.status,
          new_status: body.status,
        },
      });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Error in PATCH /api/crm/leads/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Elimina un lead
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();

    // Verificar autenticacion
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("leads")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting lead:", error);
      return NextResponse.json(
        { error: "Error al eliminar el lead" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/crm/leads/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
