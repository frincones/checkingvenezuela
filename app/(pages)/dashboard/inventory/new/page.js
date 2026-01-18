"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const productTypes = [
  { value: "flight", label: "Vuelo" },
  { value: "hotel", label: "Hotel" },
  { value: "package", label: "Paquete" },
  { value: "tour", label: "Tour" },
  { value: "transfer", label: "Traslado" },
  { value: "insurance", label: "Seguro" },
  { value: "other", label: "Otro" },
];

export default function NewInventoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [providers, setProviders] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    product_type: "tour",
    provider_id: "",
    description: "",
    cost_price: "",
    sale_price: "",
    currency: "USD",
    stock_quantity: "",
    min_stock_alert: "",
    valid_from: "",
    valid_until: "",
    status: "available",
  });

  useEffect(() => {
    fetchProviders();
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

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Auto-generate SKU from name and type
    if (name === "name" || name === "product_type") {
      const baseName = name === "name" ? value : formData.name;
      const baseType = name === "product_type" ? value : formData.product_type;
      const sku = `${baseType.substring(0, 3).toUpperCase()}-${baseName
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]+/g, "")
        .slice(0, 6)}-${Date.now().toString().slice(-4)}`;
      setFormData((prev) => ({ ...prev, sku }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          provider_id: formData.provider_id || null,
          cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
          sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
          stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity) : null,
          min_stock_alert: formData.min_stock_alert ? parseInt(formData.min_stock_alert) : null,
          valid_from: formData.valid_from || null,
          valid_until: formData.valid_until || null,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        router.push("/dashboard/inventory");
      }
    } catch (err) {
      setError("Error al crear el producto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/inventory"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Volver a Inventario
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Nuevo Producto</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 shadow-md">
        {/* Información básica */}
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Información Básica</h3>
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              SKU *
            </label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tipo *
            </label>
            <select
              name="product_type"
              value={formData.product_type}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {productTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Proveedor
            </label>
            <select
              name="provider_id"
              value={formData.provider_id}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Sin proveedor</option>
              {providers.map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Descripción
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Precios */}
        <h3 className="text-sm font-semibold text-gray-700 mb-4 mt-6 pt-4 border-t">Precios</h3>
        <div className="grid gap-6 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Precio de costo
            </label>
            <input
              type="number"
              name="cost_price"
              value={formData.cost_price}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Precio de venta
            </label>
            <input
              type="number"
              name="sale_price"
              value={formData.sale_price}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Moneda
            </label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="VES">VES</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Margen
            </label>
            <div className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500">
              {formData.cost_price && formData.sale_price
                ? `${(((parseFloat(formData.sale_price) - parseFloat(formData.cost_price)) / parseFloat(formData.cost_price)) * 100).toFixed(1)}%`
                : "-"}
            </div>
          </div>
        </div>

        {/* Stock y validez */}
        <h3 className="text-sm font-semibold text-gray-700 mb-4 mt-6 pt-4 border-t">Stock y Validez</h3>
        <div className="grid gap-6 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Cantidad en stock
            </label>
            <input
              type="number"
              name="stock_quantity"
              value={formData.stock_quantity}
              onChange={handleChange}
              min="0"
              placeholder="Vacío = ilimitado"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Alerta stock mínimo
            </label>
            <input
              type="number"
              name="min_stock_alert"
              value={formData.min_stock_alert}
              onChange={handleChange}
              min="0"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Válido desde
            </label>
            <input
              type="date"
              name="valid_from"
              value={formData.valid_from}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Válido hasta
            </label>
            <input
              type="date"
              name="valid_until"
              value={formData.valid_until}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Estado
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="available">Disponible</option>
              <option value="limited">Limitado</option>
              <option value="sold_out">Agotado</option>
              <option value="discontinued">Descontinuado</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Crear Producto"}
          </button>
          <Link
            href="/dashboard/inventory"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
