"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const LEAD_STATUS_LABELS = {
  new: { label: "Nuevo", color: "bg-blue-100 text-blue-800" },
  contacted: { label: "Contactado", color: "bg-indigo-100 text-indigo-800" },
  quoting: { label: "Cotizando", color: "bg-purple-100 text-purple-800" },
  quote_sent: { label: "Cotizacion Enviada", color: "bg-yellow-100 text-yellow-800" },
  awaiting_payment: { label: "Esperando Pago", color: "bg-orange-100 text-orange-800" },
  paid: { label: "Pagado", color: "bg-green-100 text-green-800" },
  fulfilled: { label: "Completado", color: "bg-emerald-100 text-emerald-800" },
  won: { label: "Ganado", color: "bg-teal-100 text-teal-800" },
  lost: { label: "Perdido", color: "bg-red-100 text-red-800" },
};

const LEAD_SOURCE_LABELS = {
  web_form: "Formulario Web",
  whatsapp: "WhatsApp",
  chatbot: "Chatbot",
  registration: "Registro",
  booking_intent: "Intento de Reserva",
  referral: "Referido",
  social_media: "Redes Sociales",
  phone: "Telefono",
  email: "Email",
  other: "Otro",
};

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") || "";

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(statusFilter);

  useEffect(() => {
    fetchLeads();
  }, [selectedStatus]);

  async function fetchLeads() {
    setLoading(true);
    try {
      const url = selectedStatus
        ? `/api/crm/leads?status=${selectedStatus}`
        : "/api/crm/leads";
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setLeads(data.data || []);
      }
    } catch (err) {
      setError("Error al cargar leads");
    } finally {
      setLoading(false);
    }
  }

  async function updateLeadStatus(leadId, newStatus) {
    try {
      const response = await fetch(`/api/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchLeads();
      }
    } catch (err) {
      console.error("Error updating lead:", err);
    }
  }

  if (error?.includes("42P01") || error?.includes("PGRST205") || error?.includes("Tablas CRM no encontradas")) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Tablas CRM no encontradas</h2>
          <p className="text-yellow-700 mb-4">
            Para usar el sistema CRM, ejecuta la migracion SQL en Supabase:
          </p>
          <ol className="list-decimal list-inside text-yellow-700 space-y-2">
            <li>Ve al Dashboard de Supabase &rarr; SQL Editor</li>
            <li>Copia el contenido de: <code className="bg-white px-2 py-1 rounded">supabase/migrations/001_crm_tables.sql</code></li>
            <li>Pega y ejecuta el SQL</li>
            <li>Recarga esta pagina</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <Link
          href="/dashboard/leads/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          Nuevo Lead
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
          Todos
        </button>
        {Object.entries(LEAD_STATUS_LABELS).map(([key, { label }]) => (
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

      {/* Leads Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay leads {selectedStatus ? `con estado "${LEAD_STATUS_LABELS[selectedStatus]?.label}"` : ""}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Contacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Fuente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Fecha
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="font-medium text-gray-900">{lead.contact_name}</div>
                    {lead.interest_type && (
                      <div className="text-sm text-gray-500">{lead.interest_type}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm text-gray-900">{lead.contact_email}</div>
                    <div className="text-sm text-gray-500">{lead.contact_phone}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {LEAD_SOURCE_LABELS[lead.source] || lead.source}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <select
                      value={lead.status}
                      onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${LEAD_STATUS_LABELS[lead.status]?.color || "bg-gray-100"}`}
                    >
                      {Object.entries(LEAD_STATUS_LABELS).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(lead.created_at).toLocaleDateString("es-VE")}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="text-primary hover:text-primary/80"
                    >
                      Ver
                    </Link>
                    {lead.contact_phone && (
                      <a
                        href={`https://wa.me/${lead.contact_phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 text-green-600 hover:text-green-800"
                      >
                        WhatsApp
                      </a>
                    )}
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
