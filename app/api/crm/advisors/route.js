/**
 * API de Advisors (Asesores) - CHECK-IN VENEZUELA CRM
 *
 * GET /api/crm/advisors - Lista asesores activos
 * POST /api/crm/advisors - Crea un nuevo asesor
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET - Lista asesores con filtros
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

    // Obtener parámetros de query
    const { searchParams } = new URL(request.url);
    const active_only = searchParams.get("active_only") !== "false";
    const department = searchParams.get("department");
    const search = searchParams.get("search");

    // Construir query
    let query = supabase
      .from("advisors")
      .select(
        `
        *,
        profile:profiles(first_name, last_name, email, profile_image)
      `
      )
      .order("created_at", { ascending: false });

    // Aplicar filtros
    if (active_only) {
      query = query.eq("is_active", true);
    }

    if (department) {
      query = query.eq("department", department);
    }

    const { data: advisors, error } = await query;

    if (error) {
      console.error("Error fetching advisors:", error);
      return NextResponse.json(
        { error: "Error al obtener asesores" },
        { status: 500 }
      );
    }

    // Filtrar por búsqueda si es necesario (nombre o email)
    let filteredAdvisors = advisors;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredAdvisors = advisors.filter(
        (advisor) =>
          advisor.profile?.first_name?.toLowerCase().includes(searchLower) ||
          advisor.profile?.last_name?.toLowerCase().includes(searchLower) ||
          advisor.profile?.email?.toLowerCase().includes(searchLower) ||
          advisor.employee_code?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json(filteredAdvisors);
  } catch (error) {
    console.error("Error in GET /api/crm/advisors:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST - Crea un nuevo asesor
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
    if (!body.profile_id) {
      return NextResponse.json(
        { error: "El profile_id es requerido" },
        { status: 400 }
      );
    }

    // Verificar que el perfil existe
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", body.profile_id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "El perfil especificado no existe" },
        { status: 400 }
      );
    }

    // Verificar que no existe ya un asesor para ese perfil
    const { data: existingAdvisor } = await supabase
      .from("advisors")
      .select("id")
      .eq("profile_id", body.profile_id)
      .single();

    if (existingAdvisor) {
      return NextResponse.json(
        { error: "Ya existe un asesor para este perfil" },
        { status: 400 }
      );
    }

    // Preparar datos del asesor
    const advisorData = {
      profile_id: body.profile_id,
      employee_code: body.employee_code || null,
      department: body.department || "sales",
      whatsapp_number: body.whatsapp_number || null,
      is_active: true,
      specializations: body.specializations || [],
      max_concurrent_leads: body.max_concurrent_leads || 50,
      commission_rate: body.commission_rate || 0,
    };

    // Usar admin client para bypasear RLS en la creación
    const adminClient = createAdminClient();

    const { data: advisor, error } = await adminClient
      .from("advisors")
      .insert(advisorData)
      .select(
        `
        *,
        profile:profiles(first_name, last_name, email, profile_image)
      `
      )
      .single();

    if (error) {
      console.error("Error creating advisor:", error);
      return NextResponse.json(
        { error: "Error al crear el asesor" },
        { status: 500 }
      );
    }

    return NextResponse.json(advisor, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/crm/advisors:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
