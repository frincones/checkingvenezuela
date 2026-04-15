import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listVouchers, getVoucherStats } from "@/lib/vouchers/queries";

const STATUS_BADGE = {
  draft: { label: "Borrador", cls: "bg-gray-100 text-gray-700" },
  issued: { label: "Emitido", cls: "bg-blue-100 text-blue-700" },
  sent: { label: "Enviado", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelado", cls: "bg-red-100 text-red-700" },
};

export const metadata = { title: "Vouchers | Dashboard" };

export default async function VouchersListPage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/user/login?callbackPath=/dashboard/vouchers");

  const sp = await searchParams;
  const status = sp?.status || undefined;
  const search = sp?.search || undefined;
  const page = Math.max(1, Number(sp?.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const [{ data: vouchers, count }, stats] = await Promise.all([
    listVouchers({ status, search, limit, offset }),
    getVoucherStats(),
  ]);

  const totalPages = Math.max(1, Math.ceil(count / limit));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vouchers</h1>
          <p className="text-sm text-gray-500">
            Gestiona los vouchers de servicios pre-pagados
          </p>
        </div>
        <Link
          href="/dashboard/vouchers/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nuevo Voucher
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Object.entries(STATUS_BADGE).map(([key, { label, cls }]) => (
          <div key={key} className="rounded-lg border bg-white p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold">{stats[key] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
          <input
            name="search"
            defaultValue={search || ""}
            placeholder="Número, localizador..."
            className="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
          <select
            name="status"
            defaultValue={status || ""}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="draft">Borrador</option>
            <option value="issued">Emitido</option>
            <option value="sent">Enviado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Filtrar
        </button>
        {(search || status) && (
          <Link
            href="/dashboard/vouchers"
            className="rounded-md px-3 py-2 text-sm text-blue-600 hover:underline"
          >
            Limpiar
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Número</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Fecha emisión</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Cotización</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vouchers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No se encontraron vouchers
                </td>
              </tr>
            ) : (
              vouchers.map((v) => {
                const badge = STATUS_BADGE[v.status] || STATUS_BADGE.draft;
                const clientName =
                  v.lead?.contact_name ||
                  v.passengers?.[0]?.full_name ||
                  "—";
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <Link href={`/dashboard/vouchers/${v.id}`} className="hover:underline">
                        {v.voucher_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {clientName.substring(0, 35)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {v.issue_date
                        ? new Date(`${v.issue_date}T12:00:00`).toLocaleDateString("es-VE", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {v.quotation?.quotation_number ? (
                        <Link
                          href={`/dashboard/quotations/${v.quotation_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {v.quotation.quotation_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link
                        href={`/dashboard/vouchers/${v.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {count} resultado{count !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/dashboard/vouchers?page=${page - 1}${status ? `&status=${status}` : ""}${search ? `&search=${search}` : ""}`}
                className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
              >
                Anterior
              </Link>
            )}
            <span className="rounded border bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/dashboard/vouchers?page=${page + 1}${status ? `&status=${status}` : ""}${search ? `&search=${search}` : ""}`}
                className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
              >
                Siguiente
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
