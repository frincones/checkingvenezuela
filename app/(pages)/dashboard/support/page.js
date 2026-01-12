"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TICKET_STATUS_LABELS = {
  open: { label: "Abierto", color: "bg-blue-100 text-blue-800" },
  in_progress: { label: "En Progreso", color: "bg-yellow-100 text-yellow-800" },
  waiting_customer: { label: "Esperando Cliente", color: "bg-orange-100 text-orange-800" },
  resolved: { label: "Resuelto", color: "bg-green-100 text-green-800" },
  closed: { label: "Cerrado", color: "bg-gray-100 text-gray-800" },
};

const TICKET_TYPE_LABELS = {
  cancellation: "Cancelacion",
  refund: "Reembolso",
  modification: "Modificacion",
  complaint: "Queja",
  inquiry: "Consulta",
  other: "Otro",
};

const TICKET_PRIORITY_LABELS = {
  low: { label: "Baja", color: "text-gray-600" },
  medium: { label: "Media", color: "text-yellow-600" },
  high: { label: "Alta", color: "text-orange-600" },
  urgent: { label: "Urgente", color: "text-red-600" },
};

export default function SupportPage() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") || "";

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(statusFilter);

  useEffect(() => {
    fetchTickets();
  }, [selectedStatus]);

  async function fetchTickets() {
    setLoading(true);
    try {
      const url = selectedStatus
        ? `/api/crm/support?status=${selectedStatus}`
        : "/api/crm/support";
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setTickets(data.data || []);
      }
    } catch (err) {
      setError("Error al cargar tickets");
    } finally {
      setLoading(false);
    }
  }

  async function updateTicketStatus(id, newStatus) {
    try {
      const response = await fetch(`/api/crm/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchTickets();
      }
    } catch (err) {
      console.error("Error updating ticket:", err);
    }
  }

  if (error?.includes("42P01")) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Soporte</h1>
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
        <h1 className="text-2xl font-bold text-gray-900">Tickets de Soporte</h1>
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
        {Object.entries(TICKET_STATUS_LABELS).map(([key, { label }]) => (
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

      {/* Tickets Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay tickets {selectedStatus ? `con estado "${TICKET_STATUS_LABELS[selectedStatus]?.label}"` : ""}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Ticket
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Prioridad
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
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="font-mono text-sm font-medium text-gray-900">
                      {ticket.ticket_number}
                    </div>
                    <div className="text-sm text-gray-500 truncate max-w-[200px]">
                      {ticket.subject}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm text-gray-900">{ticket.customer_name}</div>
                    <div className="text-sm text-gray-500">{ticket.customer_email}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {TICKET_TYPE_LABELS[ticket.ticket_type] || ticket.ticket_type}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`text-sm font-medium ${TICKET_PRIORITY_LABELS[ticket.priority]?.color}`}>
                      {TICKET_PRIORITY_LABELS[ticket.priority]?.label || ticket.priority}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <select
                      value={ticket.status}
                      onChange={(e) => updateTicketStatus(ticket.id, e.target.value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${TICKET_STATUS_LABELS[ticket.status]?.color || "bg-gray-100"}`}
                    >
                      {Object.entries(TICKET_STATUS_LABELS).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(ticket.created_at).toLocaleDateString("es-VE")}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <Link
                      href={`/dashboard/support/${ticket.id}`}
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
