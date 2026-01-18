"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const providerTypeLabels = {
  airline: "Aerolínea",
  hotel_chain: "Cadena Hotelera",
  tour_operator: "Operador Turístico",
  car_rental: "Alquiler de Autos",
  insurance: "Seguros",
  transfer: "Traslados",
  other: "Otro",
};

const statusLabels = {
  active: "Activo",
  inactive: "Inactivo",
  suspended: "Suspendido",
};

const statusColors = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  suspended: "bg-red-100 text-red-800",
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    fetchProviders();
  }, []);

  async function fetchProviders() {
    setLoading(true);
    try {
      const response = await fetch("/api/providers");
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setProviders(data.data || []);
        setError(null);
      }
    } catch (err) {
      setError("Error al cargar proveedores");
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      await fetch(`/api/providers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchProviders();
    } catch (err) {
      console.error("Error:", err);
    }
  }

  const filteredProviders = providers.filter((p) => {
    if (filterType && p.provider_type !== filterType) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los proveedores de servicios turísticos
          </p>
        </div>
        <Link
          href="/dashboard/providers/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          + Nuevo Proveedor
        </Link>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex gap-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(providerTypeLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-yellow-50 p-4 text-yellow-700">{error}</div>
      )}

      <div className="rounded-lg bg-white shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Proveedor</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Contacto</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Comisión</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Cargando...</td>
              </tr>
            ) : filteredProviders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No hay proveedores</td>
              </tr>
            ) : (
              filteredProviders.map((provider) => (
                <tr key={provider.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{provider.name}</div>
                    <div className="text-sm text-gray-500">{provider.code}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                      {providerTypeLabels[provider.provider_type] || provider.provider_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {provider.contact_email && (
                      <div>{provider.contact_email}</div>
                    )}
                    {provider.contact_phone && (
                      <div>{provider.contact_phone}</div>
                    )}
                    {!provider.contact_email && !provider.contact_phone && "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {provider.commission_rate ? `${provider.commission_rate}%` : "-"}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleStatus(provider.id, provider.status)}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[provider.status] || "bg-gray-100 text-gray-800"}`}
                    >
                      {statusLabels[provider.status] || provider.status}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link href={`/dashboard/providers/${provider.id}`} className="text-primary hover:text-primary/80 font-medium">
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
