import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getVoucherById } from "@/lib/vouchers/queries";
import VoucherActions from "../_components/VoucherActions";

const STATUS_BADGE = {
  draft: { label: "Borrador", cls: "bg-gray-100 text-gray-700" },
  issued: { label: "Emitido", cls: "bg-blue-100 text-blue-700" },
  sent: { label: "Enviado", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelado", cls: "bg-red-100 text-red-700" },
};

function fmtDate(val) {
  if (!val) return "—";
  try {
    const d = typeof val === "string" ? new Date(`${val}T12:00:00`) : new Date(val);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `Voucher ${id.slice(0, 8)} | Dashboard` };
}

export default async function VoucherDetailPage({ params }) {
  const session = await auth();
  if (!session?.user) redirect("/user/login?callbackPath=/dashboard/vouchers");

  const { id } = await params;
  const voucher = await getVoucherById(id);
  if (!voucher) notFound();

  const badge = STATUS_BADGE[voucher.status] || STATUS_BADGE.draft;
  const pax = Array.isArray(voucher.passengers) ? voucher.passengers : [];
  const svcs = voucher.services || {};
  const acc = svcs.accommodation || {};

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/vouchers" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Vouchers
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{voucher.voucher_number}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* Actions */}
      <VoucherActions voucher={voucher} />

      {/* Cancellation info */}
      {voucher.status === "cancelled" && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm">
          <p className="font-medium text-red-700">Voucher cancelado</p>
          {voucher.cancellation_reason && (
            <p className="mt-1 text-red-600">Razón: {voucher.cancellation_reason}</p>
          )}
          {voucher.cancelled_at && (
            <p className="mt-1 text-red-500 text-xs">Cancelado el {fmtDate(voucher.cancelled_at)}</p>
          )}
        </div>
      )}

      {/* Grid info */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Identification */}
        <div className="rounded-lg border bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase text-gray-400">Identificación</h2>
          <p className="text-base font-medium text-gray-900">{voucher.title}</p>
          {voucher.subtitle && <p className="text-sm text-gray-500">{voucher.subtitle}</p>}
          <div className="text-sm text-gray-500 space-y-1">
            <p>Emitido: {fmtDate(voucher.issue_date)}</p>
            {voucher.locator_code && <p>Localizador: {voucher.locator_code}</p>}
          </div>
          {voucher.quotation_id && (
            <Link
              href={`/dashboard/quotations/${voucher.quotation_id}`}
              className="inline-block text-sm text-blue-600 hover:underline"
            >
              Cotización: {voucher.quotation?.quotation_number || voucher.quotation_id.slice(0, 8)}
            </Link>
          )}
        </div>

        {/* Client */}
        <div className="rounded-lg border bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase text-gray-400">Cliente</h2>
          {voucher.lead ? (
            <>
              <p className="text-base font-medium text-gray-900">{voucher.lead.contact_name}</p>
              {voucher.lead.contact_email && (
                <p className="text-sm text-gray-500">{voucher.lead.contact_email}</p>
              )}
              {voucher.lead.contact_phone && (
                <p className="text-sm text-gray-500">{voucher.lead.contact_phone}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">Sin lead vinculado</p>
          )}
          {voucher.advisor?.profile && (
            <p className="text-xs text-gray-400">
              Asesor: {voucher.advisor.profile.first_name} {voucher.advisor.profile.last_name}
            </p>
          )}
        </div>
      </div>

      {/* Passengers */}
      {pax.length > 0 && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase text-gray-400">Pasajeros</h2>
          {pax.map((p, i) => (
            <div key={i} className="flex items-baseline gap-2 text-sm">
              <span className="font-medium text-gray-900">Pasajero {i + 1}:</span>
              <span className="text-gray-700">{p.full_name}</span>
              <span className="text-gray-400">
                {p.id_type} {p.id_number}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Accommodation */}
      {acc.hotel_name && (
        <div className="rounded-lg border bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase text-gray-400">Alojamiento</h2>
          <p className="font-medium text-gray-900">{acc.hotel_name}</p>
          {acc.room_description && <p className="text-sm text-gray-600">{acc.room_description}</p>}
          {(acc.check_in || acc.check_out) && (
            <p className="text-sm text-gray-500">
              {fmtDate(acc.check_in)} — {fmtDate(acc.check_out)}
              {acc.days ? ` | ${acc.days} día(s)` : ""}
              {acc.nights ? ` / ${acc.nights} noche(s)` : ""}
            </p>
          )}
          {acc.location && <p className="text-sm text-gray-500">{acc.location}</p>}
        </div>
      )}

      {/* Excursions */}
      {svcs.excursions?.length > 0 && (
        <div className="rounded-lg border bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase text-gray-400">Excursiones</h2>
          {svcs.excursions.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className={e.included !== false ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                {e.included !== false ? "+" : "-"}
              </span>
              <div>
                <span className="text-gray-700">{e.title}</span>
                {e.note && <p className="text-xs text-gray-400">{e.note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transfers */}
      {svcs.transfers?.length > 0 && (
        <div className="rounded-lg border bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase text-gray-400">Traslados</h2>
          {svcs.transfers.map((t, i) => (
            <p key={i} className="text-sm text-gray-700">- {t}</p>
          ))}
        </div>
      )}

      {/* Meals */}
      {svcs.meals && (
        <div className="rounded-lg border bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase text-gray-400">Alimentación</h2>
          <p className="text-sm text-gray-700">{svcs.meals}</p>
        </div>
      )}

      {/* Others */}
      {svcs.others?.length > 0 && (
        <div className="rounded-lg border bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase text-gray-400">Otros</h2>
          {svcs.others.map((o, i) => (
            <p key={i} className="text-sm text-gray-700">- {o}</p>
          ))}
        </div>
      )}

      {/* Observations */}
      {(voucher.observations || voucher.important_notes || voucher.validity_notes) && (
        <div className="rounded-lg border bg-yellow-50 p-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase text-yellow-700">Observaciones</h2>
          {voucher.observations && <p className="text-sm text-gray-700">{voucher.observations}</p>}
          {voucher.emergency_contact && (
            <p className="text-sm text-gray-600">
              Contacto emergencia: {voucher.emergency_contact}
            </p>
          )}
          {voucher.important_notes && (
            <p className="text-sm font-medium text-red-600">{voucher.important_notes}</p>
          )}
          {voucher.validity_notes && (
            <p className="text-sm text-gray-500 italic">{voucher.validity_notes}</p>
          )}
        </div>
      )}

      {/* Audit trail */}
      <div className="text-xs text-gray-400 space-y-1">
        {voucher.issued_at && <p>Emitido: {fmtDate(voucher.issued_at)}</p>}
        {voucher.sent_at && <p>Enviado: {fmtDate(voucher.sent_at)} a {voucher.sent_to_email}</p>}
        <p>Creado: {fmtDate(voucher.created_at)}</p>
        <p>Actualizado: {fmtDate(voucher.updated_at)}</p>
      </div>
    </div>
  );
}
