"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STATUS_BADGE = {
  active: "bg-green-100 text-green-800",
  idle: "bg-yellow-100 text-yellow-800",
  closed: "bg-gray-200 text-gray-700",
};

const LANG_BADGE = {
  es: "bg-blue-50 text-blue-700",
  en: "bg-purple-50 text-purple-700",
};

export default function ChatbotConversationsPage() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    language: "",
    status: "",
    has_lead: "",
    search: "",
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 });

  useEffect(() => {
    fetchConversations();
  }, [page, filters.language, filters.status, filters.has_lead]);

  async function fetchConversations() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "20" });
      if (filters.language) qs.set("language", filters.language);
      if (filters.status) qs.set("status", filters.status);
      if (filters.has_lead) qs.set("has_lead", filters.has_lead);
      if (filters.search) qs.set("search", filters.search);

      const res = await fetch(`/api/crm/chatbot/conversations?${qs}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setConversations([]);
      } else {
        setError(null);
        setConversations(data.data || []);
        setPagination(data.pagination || { total: 0, total_pages: 1 });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function applySearch(e) {
    e.preventDefault();
    setPage(1);
    fetchConversations();
  }

  return (
    <div className="ml-64 min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Conversaciones del Chatbot</h1>
          <p className="text-sm text-gray-600">
            Conversaciones automáticas con clientes y leads generados por el agente IA.
          </p>
        </div>

        {/* Filtros */}
        <div className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
          <form onSubmit={applySearch} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Buscar en mensajes
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Texto a buscar..."
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Idioma</label>
              <select
                value={filters.language}
                onChange={(e) => setFilters({ ...filters, language: e.target.value })}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">Todos</option>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Estado</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">Todos</option>
                <option value="active">Activo</option>
                <option value="idle">Inactivo</option>
                <option value="closed">Cerrado</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Lead</label>
              <select
                value={filters.has_lead}
                onChange={(e) => setFilters({ ...filters, has_lead: e.target.value })}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">Todos</option>
                <option value="true">Con lead</option>
                <option value="false">Sin lead</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Buscar
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Tabla */}
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Sesión</th>
                <th className="px-4 py-3 text-left">Iniciada</th>
                <th className="px-4 py-3 text-left">Idioma</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Mensajes</th>
                <th className="px-4 py-3 text-left">Cliente capturado</th>
                <th className="px-4 py-3 text-left">Lead</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : conversations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No hay conversaciones que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                conversations.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {c.session_id?.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {new Date(c.started_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LANG_BADGE[c.language] || "bg-gray-100 text-gray-700"}`}
                      >
                        {c.language === "en" ? "English" : "Español"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status] || "bg-gray-100"}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{c.message_count || 0}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.contact_captured?.name || (
                        <span className="text-gray-400">—</span>
                      )}
                      {c.contact_captured?.email && (
                        <div className="text-xs text-gray-500">{c.contact_captured.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.lead_id ? (
                        <Link
                          href={`/dashboard/leads/${c.lead_id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {c.lead?.contact_name || "Ver lead"}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/chatbot/conversations/${c.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pagination.total_pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <div>
              Página {page} de {pagination.total_pages} • {pagination.total} total
            </div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border px-3 py-1 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                disabled={page >= pagination.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border px-3 py-1 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
