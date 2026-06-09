/**
 * GET /api/email/contacts?q=<query>
 *
 * Returns a unified list of email contacts for the composer's recipient
 * autocomplete. Three sources, in priority order:
 *
 *   1. Mailboxes — your own corporate addresses, useful for CC'ing the
 *      team.
 *   2. Leads — anyone we've captured contact info for (CRM).
 *   3. Email history — distinct addresses we've corresponded with in the
 *      last 90 days (both directions). Helps recall regular contacts.
 *
 * Capped at 20 suggestions total, deduped case-insensitively. q is
 * matched against the email local-part or name (ILIKE %q%).
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

    const admin = createAdminClient();
    const suggestions = new Map(); // email lowercased → { email, name, source }
    const add = (addr, name, source) => {
      if (!addr) return;
      const key = addr.toLowerCase().trim();
      if (!key.includes("@")) return;
      if (suggestions.has(key)) {
        const existing = suggestions.get(key);
        if (!existing.name && name) existing.name = name;
        return;
      }
      if (q && !key.includes(q) && !(name || "").toLowerCase().includes(q)) {
        return;
      }
      suggestions.set(key, { email: key, name: name || null, source });
    };

    // 1. Mailboxes
    const { data: mailboxes } = await admin
      .from("mailboxes")
      .select("address, name, is_active")
      .eq("is_active", true);
    (mailboxes || []).forEach((m) => add(m.address, m.name, "mailbox"));

    // 2. Leads
    let leadsQuery = admin
      .from("leads")
      .select("contact_email, contact_name")
      .not("contact_email", "is", null)
      .limit(100);
    if (q) {
      leadsQuery = leadsQuery.or(
        `contact_email.ilike.%${q}%,contact_name.ilike.%${q}%`
      );
    }
    const { data: leads } = await leadsQuery;
    (leads || []).forEach((l) => add(l.contact_email, l.contact_name, "lead"));

    // 3. Email history (last 90 days)
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const { data: history } = await admin
      .from("emails")
      .select("from_email, from_name, to_emails, direction, created_at")
      .gte("created_at", since)
      .limit(500);
    (history || []).forEach((e) => {
      if (e.direction === "inbound") {
        add(e.from_email, e.from_name, "history");
      } else {
        (e.to_emails || []).forEach((t) => {
          const addr = typeof t === "string" ? t : t?.email;
          const name = typeof t === "string" ? null : t?.name;
          add(addr, name, "history");
        });
      }
    });

    const result = Array.from(suggestions.values())
      // Promote mailbox > lead > history
      .sort((a, b) => {
        const score = (s) => (s === "mailbox" ? 0 : s === "lead" ? 1 : 2);
        return score(a.source) - score(b.source);
      })
      .slice(0, limit);

    return NextResponse.json({ contacts: result });
  } catch (err) {
    console.error("GET /api/email/contacts error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
