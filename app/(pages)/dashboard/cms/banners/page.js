"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";

export default function BannersListPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchBanners(); }, []);

  async function fetchBanners() {
    try {
      const res = await fetch("/api/cms/banners");
      const data = await res.json();
      if (!data.error) setBanners(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function deleteBanner(id) {
    if (!confirm("¿Eliminar este banner?")) return;
    await fetch(`/api/cms/banners/${id}`, { method: "DELETE" });
    fetchBanners();
  }

  async function toggleActive(banner) {
    await fetch(`/api/cms/banners/${banner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !banner.is_active }),
    });
    fetchBanners();
  }

  const positionLabels = {
    hero: "Hero",
    section: "Sección",
    sidebar: "Sidebar",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Banners</h1>
        <Link href="/dashboard/cms/banners/new" className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nuevo Banner
        </Link>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-500">Cargando...</div>
      ) : banners.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-center">
          <p className="text-gray-500">No hay banners todavía</p>
          <Link href="/dashboard/cms/banners/new" className="mt-3 text-sm font-medium text-primary hover:underline">Crear el primer banner</Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Título</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Posición</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Orden</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Vigencia</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {banners.map((banner) => (
                <tr key={banner.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {banner.image_url ? (
                        <img src={banner.image_url} alt="" className="h-10 w-16 rounded object-cover" />
                      ) : (
                        <div className="flex h-10 w-16 items-center justify-center rounded text-xs text-white" style={{ backgroundColor: banner.background_color || "#0A1A44" }}>
                          IMG
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{banner.title}</div>
                        {banner.badge_text && (
                          <span className="inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">{banner.badge_text}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{positionLabels[banner.position] || banner.position}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{banner.display_order}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${banner.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {banner.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {banner.starts_at ? new Date(banner.starts_at).toLocaleDateString("es-VE") : "—"}
                    {" → "}
                    {banner.ends_at ? new Date(banner.ends_at).toLocaleDateString("es-VE") : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => toggleActive(banner)} className="rounded p-1.5 text-gray-400 hover:text-primary" title={banner.is_active ? "Desactivar" : "Activar"}>
                        {banner.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <Link href={`/dashboard/cms/banners/${banner.id}`} className="rounded p-1.5 text-gray-400 hover:text-primary"><Edit className="h-4 w-4" /></Link>
                      <button onClick={() => deleteBanner(banner.id)} className="rounded p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
