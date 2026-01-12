/**
 * API de Support Tickets - CHECK-IN VENEZUELA CRM
 *
 * GET /api/crm/support - Lista tickets con filtros
 * POST /api/crm/support - Crea un nuevo ticket
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET - Lista tickets con filtros y paginación
 */
export async function GET(request) {
  try {
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
    // TODO: Add proper role-based access control
    const adminClient = createAdminClient();

    // Obtener parámetros de query
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const category = searchParams.get("category");
    const assigned_advisor_id = searchParams.get("assigned_advisor_id");
    const profile_id = searchParams.get("profile_id");
    const booking_type = searchParams.get("booking_type");
    const search = searchParams.get("search");

    const offset = (page - 1) * limit;

    // Construir query using admin client
    let query = adminClient
      .from("support_tickets")
      .select(
        `
        *,
        profile:profiles(first_name, last_name, email, profile_image),
        assigned_advisor:advisors(
          id,
          employee_code,
          profile:profiles(first_name, last_name, email, profile_image)
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Aplicar filtros
    if (status) {
      const statuses = status.split(",");
      query = query.in("status", statuses);
    }

    if (priority) {
      const priorities = priority.split(",");
      query = query.in("priority", priorities);
    }

    if (category) {
      const categories = category.split(",");
      query = query.in("category", categories);
    }

    if (assigned_advisor_id) {
      if (assigned_advisor_id === "unassigned") {
        query = query.is("assigned_advisor_id", null);
      } else {
        query = query.eq("assigned_advisor_id", assigned_advisor_id);
      }
    }

    if (profile_id) {
      query = query.eq("profile_id", profile_id);
    }

    if (booking_type) {
      query = query.eq("booking_type", booking_type);
    }

    if (search) {
      query = query.or(
        `ticket_number.ilike.%${search}%,subject.ilike.%${search}%`
      );
    }

    const { data: tickets, error, count } = await query;

    if (error) {
      console.error("Error fetching tickets:", error);

      // Check if CRM tables don't exist
      if (error.code === "PGRST205" || error.code === "42P01") {
        return NextResponse.json(
          {
            error: "Tablas CRM no encontradas",
            details: "Ejecute la migracion SQL: supabase/migrations/001_crm_tables.sql",
            code: error.code,
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: "Error al obtener tickets" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: tickets,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/crm/support:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST - Crea un nuevo ticket de soporte
 */
export async function POST(request) {
  try {
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

    // Validar campos requeridos
    if (!body.booking_type || !body.booking_id) {
      return NextResponse.json(
        { error: "El tipo y ID de reserva son requeridos" },
        { status: 400 }
      );
    }

    if (!body.subject) {
      return NextResponse.json(
        { error: "El asunto es requerido" },
        { status: 400 }
      );
    }

    if (!body.category) {
      return NextResponse.json(
        { error: "La categoría es requerida" },
        { status: 400 }
      );
    }

    // Preparar datos del ticket
    const ticketData = {
      booking_type: body.booking_type,
      booking_id: body.booking_id,
      profile_id: user.id,
      subject: body.subject,
      description: body.description || null,
      category: body.category,
      priority: body.priority || "medium",
      status: "open",
      metadata: body.metadata || {},
    };

    const adminClient = createAdminClient();

    // Insertar ticket
    const { data: ticket, error } = await adminClient
      .from("support_tickets")
      .insert(ticketData)
      .select(
        `
        *,
        profile:profiles(first_name, last_name, email, profile_image)
      `
      )
      .single();

    if (error) {
      console.error("Error creating ticket:", error);
      return NextResponse.json(
        { error: "Error al crear el ticket" },
        { status: 500 }
      );
    }

    // Crear mensaje inicial si hay descripción
    if (body.description) {
      await adminClient.from("ticket_messages").insert({
        ticket_id: ticket.id,
        author_type: "customer",
        author_id: user.id,
        content: body.description,
        is_internal: false,
      });
    }

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/crm/support:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
