"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STATUS_LABELS = {
  active: { label: "Activo", color: "bg-green-100 text-green-800" },
  coming_soon: { label: "Próximamente", color: "bg-yellow-100 text-yellow-800" },
  disabled: { label: "Desactivado", color: "bg-gray-100 text-gray-800" },
};

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");

  useEffect(() => {
    fetchServices();
  }, [selectedStatus]);

  async function fetchServices() {
    setLoading(true);
    try {
      const url = selectedStatus
        ? `/api/cms/services?status=${selectedStatus}`
        : "/api/cms/services";
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setServices(data.data || []);
        setError(null);
      }
    } catch (err) {
      setError("Error al cargar servicios");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, newStatus) {
    try {
      const response = await fetch(`/api/cms/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        fetchServices();
      }
    } catch (err) {
      console.error("Error updating:", err);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los servicios que aparecen en la página principal
          </p>
        </div>
        <Link
          href="/dashboard/cms/services/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          + Nuevo Servicio
        </Link>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setSelectedStatus("")}
          className={`rounded-full px-3 py-1 text-sm ${
            selectedStatus === "" ? "bg-primary text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          Todos
        </button>
        {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setSelectedStatus(key)}
            className={`rounded-full px-3 py-1 text-sm ${
              selectedStatus === key ? "bg-primary text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-md bg-yellow-50 p-4 text-yellow-700">
          <p className="font-medium">Atención</p>
          <p className="text-sm">{error}</p>
          {error.includes("migración") && (
            <p className="mt-2 text-xs">
              Ejecute el archivo: <code className="bg-yellow-100 px-1">supabase/migrations/003_cms_providers_inventory.sql</code>
            </p>
          )}
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-lg bg-white shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Orden
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Servicio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Compra Online
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Cotización
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  <div className="flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  </div>
                  <p className="mt-2">Cargando servicios...</p>
                </td>
              </tr>
            ) : services.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No hay servicios registrados
                </td>
              </tr>
            ) : (
              services.map((service) => (
                <tr key={service.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {service.display_order}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {service.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {service.slug}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={service.status}
                      onChange={(e) => updateStatus(service.id, e.target.value)}
                      className={`rounded-full px-2 py-1 text-xs font-medium border-0 cursor-pointer ${
                        STATUS_LABELS[service.status]?.color || "bg-gray-100"
                      }`}
                    >
                      {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {service.has_online_purchase ? (
                      <span className="text-green-600">✓ Sí</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {service.has_quote_request ? (
                      <span className="text-green-600">✓ Sí</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link
                      href={`/dashboard/cms/services/${service.id}`}
                      className="text-primary hover:text-primary/80 font-medium"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
