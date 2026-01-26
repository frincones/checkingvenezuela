"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Eye, EyeOff, Star } from "lucide-react";

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

export default function PackagesPage() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPackages();
  }, []);

  async function fetchPackages() {
    setLoading(true);
    try {
      const response = await fetch("/api/inventory?product_type=package&limit=100");
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setPackages(data.data || []);
        setError(null);
      }
    } catch (err) {
      setError("Error al cargar paquetes");
    } finally {
      setLoading(false);
    }
  }

  async function togglePublished(id, currentStatus) {
    try {
      await fetch(`/api/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: !currentStatus }),
      });
      fetchPackages();
    } catch (err) {
      console.error("Error:", err);
    }
  }

  async function toggleFeatured(id, currentStatus) {
    try {
      await fetch(`/api/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_featured: !currentStatus }),
      });
      fetchPackages();
    } catch (err) {
      console.error("Error:", err);
    }
  }

  async function deletePackage(id) {
    if (!confirm("¿Estás seguro de eliminar este paquete?")) return;

    try {
      await fetch(`/api/inventory/${id}`, {
        method: "DELETE",
      });
      fetchPackages();
    } catch (err) {
      console.error("Error:", err);
    }
  }

  function formatCurrency(amount) {
    if (!amount) return "-";
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando paquetes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <p className="text-red-800">{error}</p>
        <Button onClick={fetchPackages} className="mt-4">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Paquetes Turísticos</h1>
          <p className="text-gray-600 mt-1">
            Gestiona los paquetes turísticos de tu plataforma
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/cms/packages/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Paquete
          </Link>
        </Button>
      </div>

      {packages.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            No hay paquetes registrados
          </h3>
          <p className="mt-2 text-gray-600">
            Comienza creando tu primer paquete turístico
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/cms/packages/new">
              <Plus className="mr-2 h-4 w-4" />
              Crear Paquete
            </Link>
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paquete
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destino
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proveedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {pkg.images?.[0] && (
                          <img
                            src={pkg.images[0]}
                            alt={pkg.name}
                            className="h-12 w-16 object-cover rounded mr-3"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            {pkg.name}
                            {pkg.is_featured && (
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {pkg.sku}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {pkg.destination?.name || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {pkg.provider?.name || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(pkg.sale_price)}
                      </div>
                      {pkg.cost_price && (
                        <div className="text-xs text-gray-500">
                          Costo: {formatCurrency(pkg.cost_price)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            statusColors[pkg.status]
                          }`}
                        >
                          {statusLabels[pkg.status]}
                        </span>
                        {pkg.is_published ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            Publicado
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            Borrador
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePublished(pkg.id, pkg.is_published)}
                          title={pkg.is_published ? "Despublicar" : "Publicar"}
                        >
                          {pkg.is_published ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFeatured(pkg.id, pkg.is_featured)}
                          title={pkg.is_featured ? "Quitar destacado" : "Destacar"}
                        >
                          <Star
                            className={`h-4 w-4 ${
                              pkg.is_featured
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-gray-400"
                            }`}
                          />
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/cms/packages/${pkg.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePackage(pkg.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          Total de paquetes: <span className="font-semibold">{packages.length}</span>
        </div>
        <div>
          Publicados:{" "}
          <span className="font-semibold">
            {packages.filter((p) => p.is_published).length}
          </span>
          {" | "}
          Destacados:{" "}
          <span className="font-semibold">
            {packages.filter((p) => p.is_featured).length}
          </span>
        </div>
      </div>
    </div>
  );
}
