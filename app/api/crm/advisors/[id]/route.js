/**
 * API de Advisor Individual - CHECK-IN VENEZUELA CRM
 *
 * GET /api/crm/advisors/[id] - Obtiene un asesor con estadísticas
 * PATCH /api/crm/advisors/[id] - Actualiza un asesor
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET - Obtiene un asesor específico con estadísticas
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

    // Obtener asesor con perfil
    const { data: advisor, error } = await supabase
      .from("advisors")
      .select(
        `
        *,
        profile:profiles(first_name, last_name, email, profile_image)
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Asesor no encontrado" },
          { status: 404 }
        );
      }
      console.error("Error fetching advisor:", error);
      return NextResponse.json(
        { error: "Error al obtener el asesor" },
        { status: 500 }
      );
    }

    // Obtener estadísticas del asesor
    const adminClient = createAdminClient();

    // Leads asignados
    const { count: leadsAssigned } = await adminClient
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("advisor_id", id);

    // Leads convertidos (won)
    const { count: leadsConverted } = await adminClient
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("advisor_id", id)
      .eq("status", "won");

    // Cotizaciones enviadas
    const { count: quotationsSent } = await adminClient
      .from("quotations")
      .select("*", { count: "exact", head: true })
      .eq("advisor_id", id)
      .in("status", ["sent", "viewed", "accepted", "rejected", "converted"]);

    // Cotizaciones aceptadas/convertidas
    const { count: quotationsAccepted } = await adminClient
      .from("quotations")
      .select("*", { count: "exact", head: true })
      .eq("advisor_id", id)
      .in("status", ["accepted", "converted"]);

    // Total de ventas
    const { data: salesData } = await adminClient
      .from("quotations")
      .select("total")
      .eq("advisor_id", id)
      .eq("status", "converted");

    const totalSales = salesData?.reduce((sum, q) => sum + (q.total || 0), 0) || 0;

    // Tickets resueltos
    const { count: ticketsResolved } = await adminClient
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .eq("assigned_advisor_id", id)
      .in("status", ["resolved", "closed"]);

    // Calcular tasa de conversión
    const conversionRate =
      leadsAssigned > 0
        ? ((leadsConverted / leadsAssigned) * 100).toFixed(2)
        : 0;

    const stats = {
      leads_assigned: leadsAssigned || 0,
      leads_converted: leadsConverted || 0,
      conversion_rate: parseFloat(conversionRate),
      quotations_sent: quotationsSent || 0,
      quotations_accepted: quotationsAccepted || 0,
      total_sales: totalSales,
      tickets_resolved: ticketsResolved || 0,
    };

    return NextResponse.json({ ...advisor, stats });
  } catch (error) {
    console.error("Error in GET /api/crm/advisors/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Actualiza un asesor
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

    // Preparar datos de actualización
    const updateData = {};
    const allowedFields = [
      "employee_code",
      "department",
      "whatsapp_number",
      "is_active",
      "specializations",
      "max_concurrent_leads",
      "commission_rate",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron campos para actualizar" },
        { status: 400 }
      );
    }

    // Actualizar asesor
    const { data: advisor, error } = await supabase
      .from("advisors")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        profile:profiles(first_name, last_name, email, profile_image)
      `
      )
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Asesor no encontrado" },
          { status: 404 }
        );
      }
      console.error("Error updating advisor:", error);
      return NextResponse.json(
        { error: "Error al actualizar el asesor" },
        { status: 500 }
      );
    }

    return NextResponse.json(advisor);
  } catch (error) {
    console.error("Error in PATCH /api/crm/advisors/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
