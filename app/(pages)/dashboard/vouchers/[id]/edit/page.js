import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getVoucherById } from "@/lib/vouchers/queries";
import VoucherForm from "../../_components/VoucherForm";

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `Editar Voucher ${id.slice(0, 8)} | Dashboard` };
}

export default async function EditVoucherPage({ params }) {
  const session = await auth();
  if (!session?.user) redirect("/user/login?callbackPath=/dashboard/vouchers");

  const { id } = await params;
  const voucher = await getVoucherById(id);
  if (!voucher) notFound();

  if (voucher.status === "cancelled") {
    redirect(`/dashboard/vouchers/${id}`);
  }

  // Build defaultValues from voucher data
  const defaultValues = {
    title: voucher.title || "",
    subtitle: voucher.subtitle || "",
    locator_code: voucher.locator_code || "",
    issue_date: voucher.issue_date || new Date().toISOString().slice(0, 10),
    lead_id: voucher.lead_id || null,
    quotation_id: voucher.quotation_id || null,
    advisor_id: voucher.advisor_id || null,
    provider_id: voucher.provider_id || null,
    provider_snapshot: voucher.provider_snapshot || null,
    passengers: Array.isArray(voucher.passengers) && voucher.passengers.length > 0
      ? voucher.passengers
      : [{ full_name: "", id_type: "CI", id_number: "" }],
    services: {
      accommodation: voucher.services?.accommodation || {
        hotel_name: "",
        room_description: "",
        check_in: "",
        check_out: "",
        nights: 0,
        days: 0,
        location: "",
      },
      excursions: voucher.services?.excursions || [],
      transfers: voucher.services?.transfers || [],
      meals: voucher.services?.meals || "",
      others: voucher.services?.others || [],
    },
    observations: voucher.observations || "",
    emergency_contact: voucher.emergency_contact || "",
    important_notes: voucher.important_notes || "",
    validity_notes: voucher.validity_notes || "",
    metadata: voucher.metadata || {},
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/vouchers/${id}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; {voucher.voucher_number}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Editar Voucher {voucher.voucher_number}
        </h1>
      </div>

      {voucher.pdf_stale === false && voucher.pdf_url && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
          Al guardar cambios, el PDF se marcará como desactualizado y se regenerará en la próxima descarga.
        </div>
      )}

      <VoucherForm
        defaultValues={defaultValues}
        voucherId={id}
        mode="edit"
      />
    </div>
  );
}
