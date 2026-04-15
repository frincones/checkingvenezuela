/**
 * GET    /api/vouchers/[id]   → Get voucher detail
 * PATCH  /api/vouchers/[id]   → Update voucher
 * DELETE /api/vouchers/[id]   → Delete voucher (drafts only)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { getVoucherById } from "@/lib/vouchers/queries";
import {
  updateVoucherAction,
  deleteVoucherAction,
  cancelVoucherAction,
  reactivateVoucherAction,
} from "@/lib/vouchers/actions";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function GET(request, { params }) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const voucher = await getVoucherById(id);
    if (!voucher) {
      return NextResponse.json({ error: "Voucher no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: voucher });
  } catch (err) {
    console.error("GET /api/vouchers/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Handle special actions via _action field
    if (body._action === "cancel") {
      const result = await cancelVoucherAction(id, { reason: body.reason });
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    if (body._action === "reactivate") {
      const result = await reactivateVoucherAction(id);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    // Normal update
    const result = await updateVoucherAction(id, body);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("PATCH /api/vouchers/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const result = await deleteVoucherAction(id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("DELETE /api/vouchers/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
