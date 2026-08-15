"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";

/**
 * Cobros — la pantalla que responde "¿quién me debe dinero?".
 *
 * Antes de este módulo el CRM no tenía forma de saberlo: los pagos ocurrían
 * fuera del sistema y nadie perseguía los pendientes.
 */

const STATUS = {
  created:        { label: "Creado",       color: "bg-gray-100 text-gray-700" },
  sent:           { label: "Enviado",      color: "bg-blue-100 text-blue-800" },
  viewed:         { label: "Visto",        color: "bg-indigo-100 text-indigo-800" },
  partially_paid: { label: "Pago parcial", color: "bg-amber-100 text-amber-800" },
  paid:           { label: "Pagado",       color: "bg-green-100 text-green-800" },
  cancelled:      { label: "Cancelado",    color: "bg-gray-100 text-gray-500" },
  refunded:       { label: "Reembolsado",  color: "bg-red-100 text-red-800" },
  expired:        { label: "Expirado",     color: "bg-gray-100 text-gray-500" },
};

const FILTERS = [
  { key: "pending", label: "Pendientes" },
  { key: "paid", label: "Pagados" },
  { key: "all", label: "Todos" },
  { key: "cancelled", label: "Cancelados" },
];

const money = (v, c = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD" }).format(Number(v || 0));

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function PaymentsPage() {
  const [links, setLinks] = useState([]);
  const [totals, setTotals] = useState({ collected: 0, pending: 0, pendingCount: 0 });
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status });
      if (search) params.set("search", search);
      const res = await fetch(`/api/payments/links?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al cargar los cobros");
      setLinks(json.data || []);
      setTotals(json.totals || { collected: 0, pending: 0, pendingCount: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  async function copy(url) {
    await navigator.clipboard.writeText(url);
    toast.success("Enlace copiado");
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cobros</h1>
        <p className="mt-1 text-sm text-gray-600">
          Enlaces de pago generados desde las cotizaciones
        </p>
      </div>

      {/* Resumen */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <p className="text-sm text-gray-600">Cobrado</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{money(totals.collected)}</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-md">
          <p className="text-sm text-gray-600">Pendiente de cobro</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{money(totals.pending)}</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-md">
          <p className="text-sm text-gray-600">Cobros abiertos</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totals.pendingCount}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                status === f.key
                  ? "bg-primary text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente o concepto…"
          className="ml-auto w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
          {error.includes("migración") && (
            <p className="mt-1 text-xs">
              Aplica <code>supabase/migrations/20260815_payment_links.sql</code> en el
              SQL Editor de Supabase.
            </p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow-md">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">Cargando…</div>
        ) : links.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-600">No hay cobros con este filtro</p>
            <Link
              href="/dashboard/quotations"
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Ir a cotizaciones para generar uno
            </Link>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Cliente", "Concepto", "Importe", "Estado", "Creado", ""].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {links.map((l) => {
                const s = STATUS[l.status] || STATUS.created;
                const pending = Number(l.amount) - Number(l.amount_paid || 0);
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">
                        {l.customer_name || "—"}
                      </p>
                      <p className="text-xs text-gray-500">{l.customer_email}</p>
                    </td>
                    <td className="px-6 py-4">
                      {l.quotation ? (
                        <Link
                          href={`/dashboard/quotations/${l.quotation.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {l.concept}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-700">{l.concept}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {money(l.amount, l.currency)}
                      </p>
                      {l.status === "partially_paid" && (
                        <p className="text-xs text-amber-700">
                          faltan {money(pending, l.currency)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${s.color}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{fmtDate(l.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => copy(l.url)}
                        className="text-xs text-primary hover:underline"
                      >
                        Copiar enlace
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
