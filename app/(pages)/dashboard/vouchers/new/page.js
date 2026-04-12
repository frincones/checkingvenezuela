import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import VoucherForm from "../_components/VoucherForm";

export const metadata = { title: "Nuevo Voucher | Dashboard" };

export default async function NewVoucherPage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/user/login?callbackPath=/dashboard/vouchers/new");

  // Support prefilling from a quotation
  const sp = await searchParams;
  let prefill = null;
  const fromQuotationId = sp?.from_quotation;

  if (fromQuotationId) {
    try {
      const { quotationToVoucherPrefill } = await import(
        "@/lib/vouchers/fromQuotation"
      );
      const { createAdminClient } = await import("@/lib/db/supabase/server");
      const admin = createAdminClient();
      const { data: q } = await admin
        .from("quotations")
        .select(
          "*, lead:leads(id, contact_name, contact_email, contact_phone, interest_type)",
        )
        .eq("id", fromQuotationId)
        .single();
      if (q) prefill = quotationToVoucherPrefill(q);
    } catch (e) {
      console.error("Could not prefill from quotation:", e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/vouchers"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Vouchers
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Voucher</h1>
      </div>

      {fromQuotationId && prefill && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          Datos prellenados desde cotización. Revisa y completa la información antes de guardar.
        </div>
      )}

      <VoucherForm defaultValues={prefill} mode="create" />
    </div>
  );
}
