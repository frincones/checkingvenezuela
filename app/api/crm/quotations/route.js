/**
 * API de Quotations (Cotizaciones) - CHECK-IN VENEZUELA CRM
 *
 * GET /api/crm/quotations - Lista cotizaciones con filtros
 * POST /api/crm/quotations - Crea una nueva cotización
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET - Lista cotizaciones con filtros y paginación
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
    const advisor_id = searchParams.get("advisor_id");
    const lead_id = searchParams.get("lead_id");
    const created_from = searchParams.get("created_from");
    const created_to = searchParams.get("created_to");
    const search = searchParams.get("search");

    const offset = (page - 1) * limit;

    // Construir query using admin client
    let query = adminClient
      .from("quotations")
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

    if (advisor_id) {
      query = query.eq("advisor_id", advisor_id);
    }

    if (lead_id) {
      query = query.eq("lead_id", lead_id);
    }

    if (created_from) {
      query = query.gte("created_at", created_from);
    }

    if (created_to) {
      query = query.lte("created_at", created_to);
    }

    if (search) {
      query = query.ilike("quotation_number", `%${search}%`);
    }

    const { data: quotations, error, count } = await query;

    if (error) {
      console.error("Error fetching quotations:", error);

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
        { error: "Error al obtener cotizaciones" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: quotations,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/crm/quotations:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST - Crea una nueva cotización
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
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "Se requiere al menos un item en la cotización" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Verificar si el usuario es asesor (opcional - no bloquear si no lo es)
    const { data: advisor } = await adminClient
      .from("advisors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    // Procesar items y calcular totales
    const processedItems = body.items.map((item) => ({
      description: item.description,
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      total: (item.quantity || 1) * (item.unit_price || 0),
    }));

    const subtotal = processedItems.reduce((sum, item) => sum + item.total, 0);
    const taxes = body.taxes || 0;
    const fees = body.fees || 0;
    const discount_amount = body.discount_amount || 0;
    const total = subtotal + taxes + fees - discount_amount;

    // Preparar datos de la cotización
    const quotationData = {
      lead_id: body.lead_id || null,
      advisor_id: advisor?.id || null,
      items: processedItems,
      subtotal,
      taxes,
      fees,
      discount_amount,
      discount_reason: body.discount_reason || null,
      total,
      currency: body.currency || "USD",
      status: "draft",
      valid_until: body.valid_until || null,
      internal_notes: body.internal_notes || null,
      customer_notes: body.notes || body.customer_notes || null,
      terms_and_conditions: body.terms_and_conditions || null,
      // Store customer info in metadata for quotations without a lead
      metadata: {
        customer_name: body.customer_name || null,
        customer_email: body.customer_email || null,
        customer_phone: body.customer_phone || null,
        quotation_type: body.quotation_type || "general",
        created_by_user_id: user.id,
      },
    };

    // Insertar cotización
    const { data: quotation, error } = await adminClient
      .from("quotations")
      .insert(quotationData)
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
      console.error("Error creating quotation:", error);
      return NextResponse.json(
        { error: "Error al crear la cotización: " + error.message },
        { status: 500 }
      );
    }

    // Actualizar estado del lead a "quoting" si hay lead_id
    if (body.lead_id) {
      await adminClient
        .from("leads")
        .update({ status: "quoting" })
        .eq("id", body.lead_id)
        .in("status", ["new", "contacted"]);

      // Crear interacción en el lead
      await adminClient.from("lead_interactions").insert({
        lead_id: body.lead_id,
        advisor_id: advisor?.id || null,
        type: "system",
        content: `Cotización ${quotation.quotation_number} creada`,
        metadata: {
          quotation_id: quotation.id,
          quotation_number: quotation.quotation_number,
          total: quotation.total,
          currency: quotation.currency,
        },
      });
    }

    return NextResponse.json({ data: quotation }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/crm/quotations:", error);
    return NextResponse.json(
      { error: "Error interno del servidor: " + error.message },
      { status: 500 }
    );
  }
}
