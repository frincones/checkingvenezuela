"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const ICONS = [
  "Plane", "Building2", "Package", "Compass", "Car", "Shield",
  "CarFront", "Ship", "Briefcase", "Star", "Map", "Globe",
  "Hotel", "Umbrella", "Camera", "Heart"
];

export default function EditServicePage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "Plane",
    status: "active",
    has_online_purchase: false,
    has_quote_request: true,
    href: "",
    display_order: 0,
  });

  useEffect(() => {
    fetchService();
  }, [params.id]);

  async function fetchService() {
    try {
      const response = await fetch(`/api/cms/services/${params.id}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setFormData(data);
    } catch (err) {
      setError("Error al cargar servicio");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/cms/services/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Error al actualizar servicio");
        return;
      }

      router.push("/dashboard/cms/services");
    } catch (err) {
      setError("Error al actualizar servicio");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Estás seguro de eliminar este servicio?")) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/cms/services/${params.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/dashboard/cms/services");
      } else {
        const data = await response.json();
        setError(data.error || "Error al eliminar");
      }
    } catch (err) {
      setError("Error al eliminar servicio");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/cms/services"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Volver a Servicios
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Editar: {formData.name}
          </h1>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
        >
          {deleting ? "Eliminando..." : "Eliminar"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 shadow-md">
        <div className="grid gap-6 md:grid-cols-2">
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
              Slug *
            </label>
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Descripción
            </label>
            <textarea
              name="description"
              value={formData.description || ""}
              onChange={handleChange}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Icono
            </label>
            <select
              name="icon"
              value={formData.icon || "Plane"}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
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
              <option value="coming_soon">Próximamente</option>
              <option value="disabled">Desactivado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              URL de compra
            </label>
            <input
              type="text"
              name="href"
              value={formData.href || ""}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ej: /flights"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Orden de visualización
            </label>
            <input
              type="number"
              name="display_order"
              value={formData.display_order}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-6 md:col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="has_online_purchase"
                checked={formData.has_online_purchase}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">Permite compra online</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="has_quote_request"
                checked={formData.has_quote_request}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">Permite solicitar cotización</span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Link
            href="/dashboard/cms/services"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
