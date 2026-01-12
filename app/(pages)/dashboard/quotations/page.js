"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const QUOTATION_STATUS_LABELS = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-800" },
  sent: { label: "Enviada", color: "bg-blue-100 text-blue-800" },
  viewed: { label: "Vista", color: "bg-indigo-100 text-indigo-800" },
  accepted: { label: "Aceptada", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rechazada", color: "bg-red-100 text-red-800" },
  expired: { label: "Expirada", color: "bg-yellow-100 text-yellow-800" },
  converted: { label: "Convertida", color: "bg-emerald-100 text-emerald-800" },
};

export default function QuotationsPage() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") || "";

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(statusFilter);

  useEffect(() => {
    fetchQuotations();
  }, [selectedStatus]);

  async function fetchQuotations() {
    setLoading(true);
    try {
      const url = selectedStatus
        ? `/api/crm/quotations?status=${selectedStatus}`
        : "/api/crm/quotations";
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setQuotations(data.data || []);
      }
    } catch (err) {
      setError("Error al cargar cotizaciones");
    } finally {
      setLoading(false);
    }
  }

  async function updateQuotationStatus(id, newStatus) {
    try {
      const response = await fetch(`/api/crm/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchQuotations();
      }
    } catch (err) {
      console.error("Error updating quotation:", err);
    }
  }

  function formatCurrency(amount, currency = "USD") {
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: currency,
    }).format(amount);
  }

  if (error?.includes("42P01")) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Tablas no encontradas</h2>
          <p className="text-yellow-700">
            Ejecuta la migracion SQL en Supabase: <code className="bg-white px-2 py-1 rounded">supabase/migrations/001_crm_tables.sql</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
        <Link
          href="/dashboard/quotations/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          Nueva Cotizacion
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedStatus("")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            selectedStatus === ""
              ? "bg-primary text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Todas
        </button>
        {Object.entries(QUOTATION_STATUS_LABELS).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setSelectedStatus(key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              selectedStatus === key
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Quotations Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : quotations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay cotizaciones {selectedStatus ? `con estado "${QUOTATION_STATUS_LABELS[selectedStatus]?.label}"` : ""}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Numero
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Valida hasta
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {quotations.map((quotation) => (
                <tr key={quotation.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="font-mono text-sm font-medium text-gray-900">
                      {quotation.quotation_number}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm text-gray-900">{quotation.customer_name}</div>
                    <div className="text-sm text-gray-500">{quotation.customer_email}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 capitalize">
                    {quotation.quotation_type === "flight" && "Vuelo"}
                    {quotation.quotation_type === "hotel" && "Hotel"}
                    {quotation.quotation_type === "package" && "Paquete"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {formatCurrency(quotation.total_amount, quotation.currency)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <select
                      value={quotation.status}
                      onChange={(e) => updateQuotationStatus(quotation.id, e.target.value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${QUOTATION_STATUS_LABELS[quotation.status]?.color || "bg-gray-100"}`}
                    >
                      {Object.entries(QUOTATION_STATUS_LABELS).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {quotation.valid_until
                      ? new Date(quotation.valid_until).toLocaleDateString("es-VE")
                      : "N/A"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <Link
                      href={`/dashboard/quotations/${quotation.id}`}
                      className="text-primary hover:text-primary/80"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
