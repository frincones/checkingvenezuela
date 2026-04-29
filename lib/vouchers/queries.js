/**
 * Voucher read queries.
 *
 * All reads go through the admin client (service role) because the server
 * actions and API routes already authenticate the user upstream. Using the
 * admin client keeps the query logic identical regardless of RLS changes.
 */

import { createAdminClient } from "@/lib/db/supabase/server";

const VOUCHER_SELECT = `
  *,
  lead:leads(id, contact_name, contact_email, contact_phone),
  quotation:quotations(id, quotation_number, status),
  advisor:advisors(id, employee_code, profile:profiles(id, first_name, last_name, email)),
  provider:tourism_providers(id, name, contact_email, contact_phone)
`;

/**
 * List vouchers with optional filters.
 *
 * @param {object} options
 * @param {string} [options.status]
 * @param {string} [options.search] matches voucher_number / lead name / locator
 * @param {string} [options.from] issue_date >= ISO date
 * @param {string} [options.to] issue_date <= ISO date
 * @param {string} [options.quotationId]
 * @param {number} [options.limit]
 * @param {number} [options.offset]
 * @returns {Promise<{ data: object[], count: number }>}
 */
export async function listVouchers(options = {}) {
  const { status, search, from, to, quotationId, limit = 50, offset = 0 } = options;
  const admin = createAdminClient();

  let query = admin
    .from("vouchers")
    .select(VOUCHER_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (from) query = query.gte("issue_date", from);
  if (to) query = query.lte("issue_date", to);
  if (quotationId) query = query.eq("quotation_id", quotationId);

  if (search) {
    const needle = search.trim();
    if (needle.length > 0) {
      query = query.or(
        `voucher_number.ilike.%${needle}%,locator_code.ilike.%${needle}%`,
      );
    }
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

/**
 * Fetch a single voucher by id (with related entities).
 */
export async function getVoucherById(id) {
  if (!id) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vouchers")
    .select(VOUCHER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Fetch a voucher by its human-readable number.
 */
export async function getVoucherByNumber(voucherNumber) {
  if (!voucherNumber) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vouchers")
    .select(VOUCHER_SELECT)
    .eq("voucher_number", voucherNumber)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * All vouchers linked to a quotation (used in the quotation detail page).
 */
export async function listVouchersByQuotation(quotationId) {
  if (!quotationId) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vouchers")
    .select("id, voucher_number, status, issue_date, created_at, pdf_url")
    .eq("quotation_id", quotationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Dashboard counters.
 */
export async function getVoucherStats() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("vouchers").select("status");
  if (error) throw error;

  const stats = { total: 0, draft: 0, issued: 0, sent: 0, cancelled: 0 };
  for (const row of data || []) {
    stats.total += 1;
    if (stats[row.status] !== undefined) stats[row.status] += 1;
  }
  return stats;
}
