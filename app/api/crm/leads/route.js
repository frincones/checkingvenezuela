/**
 * API de Leads - CHECK-IN VENEZUELA CRM
 *
 * GET /api/crm/leads - Lista leads con filtros y paginación
 * POST /api/crm/leads - Crea un nuevo lead
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET - Lista leads con filtros y paginación
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
    const source = searchParams.get("source");
    const interest_type = searchParams.get("interest_type");
    const advisor_id = searchParams.get("advisor_id");
    const search = searchParams.get("search");
    const created_from = searchParams.get("created_from");
    const created_to = searchParams.get("created_to");

    const offset = (page - 1) * limit;

    // Construir query using admin client
    let query = adminClient
      .from("leads")
      .select(
        `
        *,
        advisor:advisors(
          id,
          employee_code,
          profile:profiles(first_name, last_name, email, profile_image)
        ),
        profile:profiles(first_name, last_name, email, profile_image)
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

    if (source) {
      const sources = source.split(",");
      query = query.in("source", sources);
    }

    if (interest_type) {
      const types = interest_type.split(",");
      query = query.in("interest_type", types);
    }

    if (advisor_id) {
      if (advisor_id === "unassigned") {
        query = query.is("advisor_id", null);
      } else {
        query = query.eq("advisor_id", advisor_id);
      }
    }

    if (search) {
      query = query.or(
        `contact_name.ilike.%${search}%,contact_email.ilike.%${search}%,contact_phone.ilike.%${search}%`
      );
    }

    if (created_from) {
      query = query.gte("created_at", created_from);
    }

    if (created_to) {
      query = query.lte("created_at", created_to);
    }

    const { data: leads, error, count } = await query;

    if (error) {
      console.error("Error fetching leads:", error);

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
        { error: "Error al obtener leads" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: leads,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/crm/leads:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST - Crea un nuevo lead
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const adminClient = createAdminClient();

    // Validar campos requeridos
    if (!body.contact_name) {
      return NextResponse.json(
        { error: "El nombre de contacto es requerido" },
        { status: 400 }
      );
    }

    if (!body.source) {
      return NextResponse.json(
        { error: "La fuente del lead es requerida" },
        { status: 400 }
      );
    }

    if (!body.interest_type) {
      return NextResponse.json(
        { error: "El tipo de interés es requerido" },
        { status: 400 }
      );
    }

    // Preparar datos del lead
    const leadData = {
      source: body.source,
      status: "new",
      contact_name: body.contact_name,
      contact_email: body.contact_email || null,
      contact_phone: body.contact_phone || null,
      contact_phone_dial_code: body.contact_phone_dial_code || "+58",
      preferred_contact_method: body.preferred_contact_method || "whatsapp",
      interest_type: body.interest_type,
      interest_details: body.interest_details || {},
      profile_id: body.profile_id || null,
      anonymous_user_id: body.anonymous_user_id || null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      referrer_url: body.referrer_url || null,
      landing_page: body.landing_page || null,
    };

    // Insertar lead
    const { data: lead, error } = await adminClient
      .from("leads")
      .insert(leadData)
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
      console.error("Error creating lead:", error);
      return NextResponse.json(
        { error: "Error al crear el lead" },
        { status: 500 }
      );
    }

    // Crear interacción inicial
    await adminClient.from("lead_interactions").insert({
      lead_id: lead.id,
      type: "system",
      content: `Lead creado desde ${body.source}`,
      metadata: {
        source: body.source,
        initial_interest: body.interest_type,
      },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/crm/leads:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
