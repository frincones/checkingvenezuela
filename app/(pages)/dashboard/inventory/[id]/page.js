"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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

export default function EditInventoryPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    fetchInventory();
  }, [params.id]);

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
    try {
      const response = await fetch(`/api/inventory/${params.id}`);
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        const item = data.data;
        setFormData({
          name: item.name || "",
          sku: item.sku || "",
          product_type: item.product_type || "tour",
          provider_id: item.provider_id || "",
          description: item.description || "",
          cost_price: item.cost_price || "",
          sale_price: item.sale_price || "",
          currency: item.currency || "USD",
          stock_quantity: item.stock_quantity ?? "",
          min_stock_alert: item.min_stock_alert || "",
          valid_from: item.valid_from ? item.valid_from.split("T")[0] : "",
          valid_until: item.valid_until ? item.valid_until.split("T")[0] : "",
          status: item.status || "available",
        });
      }
    } catch (err) {
      setError("Error al cargar el producto");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/inventory/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          provider_id: formData.provider_id || null,
          cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
          sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
          stock_quantity: formData.stock_quantity !== "" ? parseInt(formData.stock_quantity) : null,
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
      setError("Error al actualizar el producto");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;

    try {
      const response = await fetch(`/api/inventory/${params.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        router.push("/dashboard/inventory");
      }
    } catch (err) {
      setError("Error al eliminar el producto");
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
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
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Editar Producto</h1>
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

        <div className="mt-6 flex justify-between">
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
            <Link
              href="/dashboard/inventory"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </Link>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Eliminar
          </button>
        </div>
      </form>
    </div>
  );
}
