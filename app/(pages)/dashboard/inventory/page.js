"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const productTypeLabels = {
  flight: "Vuelo",
  hotel: "Hotel",
  package: "Paquete",
  tour: "Tour",
  transfer: "Traslado",
  insurance: "Seguro",
  other: "Otro",
};

const statusLabels = {
  available: "Disponible",
  limited: "Limitado",
  sold_out: "Agotado",
  discontinued: "Descontinuado",
};

const statusColors = {
  available: "bg-green-100 text-green-800",
  limited: "bg-yellow-100 text-yellow-800",
  sold_out: "bg-red-100 text-red-800",
  discontinued: "bg-gray-100 text-gray-800",
};

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProvider, setFilterProvider] = useState("");

  useEffect(() => {
    fetchProviders();
    fetchInventory();
  }, []);

  async function fetchProviders() {
    try {
      const response = await fetch("/api/providers");
      const data = await response.json();
      if (!data.error) {
        setProviders(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching providers:", err);
    }
  }

  async function fetchInventory() {
    setLoading(true);
    try {
      const response = await fetch("/api/inventory");
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setInventory(data.data || []);
        setError(null);
      }
    } catch (err) {
      setError("Error al cargar inventario");
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(id, currentStatus) {
    const statusOrder = ["available", "limited", "sold_out", "discontinued"];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];

    try {
      await fetch(`/api/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchInventory();
    } catch (err) {
      console.error("Error:", err);
    }
  }

  const filteredInventory = inventory.filter((item) => {
    if (filterType && item.product_type !== filterType) return false;
    if (filterStatus && item.status !== filterStatus) return false;
    if (filterProvider && item.provider_id !== filterProvider) return false;
    return true;
  });

  function formatCurrency(amount) {
    if (!amount) return "-";
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  function calculateMargin(cost, sale) {
    if (!cost || !sale) return "-";
    const margin = ((sale - cost) / cost) * 100;
    return `${margin.toFixed(1)}%`;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona productos y servicios turísticos
          </p>
        </div>
        <Link
          href="/dashboard/inventory/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          + Nuevo Producto
        </Link>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(productTypeLabels).map(([key, label]) => (
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
        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">Todos los proveedores</option>
          {providers.map((prov) => (
            <option key={prov.id} value={prov.id}>
              {prov.name}
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
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Producto</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Proveedor</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Costo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Precio</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Margen</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-gray-500">Cargando...</td>
              </tr>
            ) : filteredInventory.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-gray-500">No hay productos</td>
              </tr>
            ) : (
              filteredInventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.sku}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                      {productTypeLabels[item.product_type] || item.product_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {providers.find((p) => p.id === item.provider_id)?.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatCurrency(item.cost_price)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {formatCurrency(item.sale_price)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {calculateMargin(item.cost_price, item.sale_price)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {item.stock_quantity !== null ? item.stock_quantity : "∞"}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleStatus(item.id, item.status)}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[item.status] || "bg-gray-100 text-gray-800"}`}
                    >
                      {statusLabels[item.status] || item.status}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link href={`/dashboard/inventory/${item.id}`} className="text-primary hover:text-primary/80 font-medium">
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
