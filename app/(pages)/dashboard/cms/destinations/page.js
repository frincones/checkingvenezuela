"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterCategory, setFilterCategory] = useState("");

  useEffect(() => {
    fetchCategories();
    fetchDestinations();
  }, []);

  async function fetchCategories() {
    try {
      const response = await fetch("/api/cms/categories");
      const data = await response.json();
      if (!data.error) {
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  }

  async function fetchDestinations() {
    setLoading(true);
    try {
      const response = await fetch("/api/cms/destinations");
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setDestinations(data.data || []);
        setError(null);
      }
    } catch (err) {
      setError("Error al cargar destinos");
    } finally {
      setLoading(false);
    }
  }

  async function toggleFeatured(id, currentValue) {
    try {
      await fetch(`/api/cms/destinations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_featured: !currentValue }),
      });
      fetchDestinations();
    } catch (err) {
      console.error("Error:", err);
    }
  }

  async function toggleActive(id, currentValue) {
    try {
      await fetch(`/api/cms/destinations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentValue }),
      });
      fetchDestinations();
    } catch (err) {
      console.error("Error:", err);
    }
  }

  const filteredDestinations = filterCategory
    ? destinations.filter((d) => d.category_id === filterCategory)
    : destinations;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Destinos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los destinos mostrados en la página principal
          </p>
        </div>
        <Link
          href="/dashboard/cms/destinations/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          + Nuevo Destino
        </Link>
      </div>

      {/* Filtros */}
      <div className="mb-4">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
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
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Destino</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Categoría</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Destacado</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Activo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Cargando...</td>
              </tr>
            ) : filteredDestinations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No hay destinos</td>
              </tr>
            ) : (
              filteredDestinations.map((dest) => (
                <tr key={dest.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {dest.image_url && (
                        <div className="relative h-10 w-14 overflow-hidden rounded">
                          <Image
                            src={dest.image_url}
                            alt={dest.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{dest.name}</div>
                        <div className="text-sm text-gray-500">{dest.country}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {categories.find((c) => c.id === dest.category_id)?.name || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                      {dest.destination_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleFeatured(dest.id, dest.is_featured)}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        dest.is_featured ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {dest.is_featured ? "★ Destacado" : "Normal"}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleActive(dest.id, dest.is_active)}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        dest.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {dest.is_active ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link href={`/dashboard/cms/destinations/${dest.id}`} className="text-primary hover:text-primary/80 font-medium">
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
