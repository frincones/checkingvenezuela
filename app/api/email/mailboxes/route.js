/**
 * Mailboxes API
 * GET /api/email/mailboxes — list all mailboxes
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data: mailboxes, error } = await adminClient
      .from("mailboxes")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ mailboxes: mailboxes || [] });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
