/**
 * GET  /api/vouchers        → List vouchers with optional filters
 * POST /api/vouchers        → Create a new voucher
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { listVouchers } from "@/lib/vouchers/queries";
import { createVoucherAction } from "@/lib/vouchers/actions";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listVouchers({
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      quotationId: searchParams.get("quotation_id") || undefined,
      limit: Number(searchParams.get("limit")) || 50,
      offset: Number(searchParams.get("offset")) || 0,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/vouchers error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await createVoucherAction(body);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("POST /api/vouchers error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
