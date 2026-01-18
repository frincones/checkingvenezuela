"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setLoading(true);
    try {
      const response = await fetch("/api/cms/categories");
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setCategories(data.data || []);
        setError(null);
      }
    } catch (err) {
      setError("Error al cargar categorías");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id, currentValue) {
    try {
      await fetch(`/api/cms/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentValue }),
      });
      fetchCategories();
    } catch (err) {
      console.error("Error:", err);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías de Destinos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Organiza los destinos en categorías
          </p>
        </div>
        <Link
          href="/dashboard/cms/categories/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          + Nueva Categoría
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-yellow-50 p-4 text-yellow-700">{error}</div>
      )}

      <div className="rounded-lg bg-white shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Orden</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Categoría</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Subtítulo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Activa</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Cargando...</td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No hay categorías</td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">{cat.display_order}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{cat.name}</div>
                    <div className="text-sm text-gray-500">{cat.slug}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{cat.subtitle || "-"}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleActive(cat.id, cat.is_active)}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        cat.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {cat.is_active ? "Activa" : "Inactiva"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link href={`/dashboard/cms/categories/${cat.id}`} className="text-primary hover:text-primary/80 font-medium">
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
