import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";

/**
 * GET /api/payments/links — listado de cobros para /dashboard/payments.
 *
 * Query: ?status=paid|sent|… &search=… &page=1&limit=25
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "25"));

    const admin = createAdminClient();
    let query = admin
      .from("payment_links")
      .select(
        `*, quotation:quotations(id, quotation_number, status, total, currency)`,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status && status !== "all") {
      // "pending" agrupa todo lo que sigue sin cobrarse: es la vista que
      // responde a "¿quién me debe dinero?"
      if (status === "pending") {
        query = query.in("status", ["created", "sent", "viewed", "partially_paid"]);
      } else {
        query = query.eq("status", status);
      }
    }

    if (search) {
      query = query.or(
        `concept.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`,
      );
    }

    const { data, error, count } = await query;
    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json(
          { error: "Falta aplicar la migración 20260815_payment_links.sql", code: error.code },
          { status: 503 },
        );
      }
      console.error("GET payment links:", error);
      return NextResponse.json({ error: "Error al obtener cobros" }, { status: 500 });
    }

    // Totales para las tarjetas de resumen
    const { data: all } = await admin.from("payment_links").select("status, amount, amount_paid");
    const totals = (all || []).reduce(
      (acc, r) => {
        acc.collected += Number(r.amount_paid || 0);
        if (["created", "sent", "viewed", "partially_paid"].includes(r.status)) {
          acc.pending += Number(r.amount || 0) - Number(r.amount_paid || 0);
          acc.pendingCount += 1;
        }
        return acc;
      },
      { collected: 0, pending: 0, pendingCount: 0 },
    );

    return NextResponse.json({
      data: data || [],
      totals,
      pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) },
    });
  } catch (err) {
    console.error("GET /api/payments/links:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
