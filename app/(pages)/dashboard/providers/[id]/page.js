"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ImageUpload } from "@/components/cms/ImageUpload";

const providerTypes = [
  { value: "airline", label: "Aerolínea" },
  { value: "hotel_chain", label: "Cadena Hotelera" },
  { value: "tour_operator", label: "Operador Turístico" },
  { value: "car_rental", label: "Alquiler de Autos" },
  { value: "insurance", label: "Seguros" },
  { value: "transfer", label: "Traslados" },
  { value: "other", label: "Otro" },
];

export default function EditProviderPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    provider_type: "tour_operator",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    address: "",
    city: "",
    country: "",
    tax_id: "",
    commission_rate: "",
    payment_terms: "",
    notes: "",
    status: "active",
    logo_url: "",
  });

  useEffect(() => {
    fetchProvider();
  }, [params.id]);

  async function fetchProvider() {
    try {
      const response = await fetch(`/api/providers/${params.id}`);
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        const p = data.data;
        setFormData({
          name: p.name || "",
          code: p.code || "",
          provider_type: p.provider_type || "tour_operator",
          contact_name: p.contact_name || "",
          contact_email: p.contact_email || "",
          contact_phone: p.contact_phone || "",
          address: p.address || "",
          city: p.city || "",
          country: p.country || "",
          tax_id: p.tax_id || "",
          commission_rate: p.commission_rate || "",
          payment_terms: p.payment_terms || "",
          notes: p.notes || "",
          status: p.status || "active",
          logo_url: p.logo_url || "",
        });
      }
    } catch (err) {
      setError("Error al cargar el proveedor");
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
      const response = await fetch(`/api/providers/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          commission_rate: formData.commission_rate ? parseFloat(formData.commission_rate) : null,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        router.push("/dashboard/providers");
      }
    } catch (err) {
      setError("Error al actualizar el proveedor");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Estás seguro de eliminar este proveedor?")) return;

    try {
      const response = await fetch(`/api/providers/${params.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        router.push("/dashboard/providers");
      }
    } catch (err) {
      setError("Error al eliminar el proveedor");
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
          href="/dashboard/providers"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Volver a Proveedores
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Editar Proveedor</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 shadow-md">
        {/* Logo */}
        <div className="mb-6">
          <ImageUpload
            value={formData.logo_url}
            onChange={(url) => setFormData((prev) => ({ ...prev, logo_url: url }))}
            folder="providers"
            label="Logo del proveedor"
            placeholder="Sube el logo del proveedor"
          />
        </div>

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
              Código *
            </label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              required
              maxLength={10}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tipo *
            </label>
            <select
              name="provider_type"
              value={formData.provider_type}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {providerTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Contacto */}
        <h3 className="text-sm font-semibold text-gray-700 mb-4 mt-6 pt-4 border-t">Contacto</h3>
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre de contacto
            </label>
            <input
              type="text"
              name="contact_name"
              value={formData.contact_name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              name="contact_email"
              value={formData.contact_email}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Teléfono
            </label>
            <input
              type="tel"
              name="contact_phone"
              value={formData.contact_phone}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Dirección
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ciudad
            </label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              País
            </label>
            <input
              type="text"
              name="country"
              value={formData.country}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              RIF / Tax ID
            </label>
            <input
              type="text"
              name="tax_id"
              value={formData.tax_id}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Comercial */}
        <h3 className="text-sm font-semibold text-gray-700 mb-4 mt-6 pt-4 border-t">Información Comercial</h3>
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Comisión (%)
            </label>
            <input
              type="number"
              name="commission_rate"
              value={formData.commission_rate}
              onChange={handleChange}
              min="0"
              max="100"
              step="0.01"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Términos de pago
            </label>
            <input
              type="text"
              name="payment_terms"
              value={formData.payment_terms}
              onChange={handleChange}
              placeholder="Ej: 30 días"
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
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="suspended">Suspendido</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700">
              Notas
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
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
              href="/dashboard/providers"
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
