"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImageUpload } from "@/components/cms/ImageUpload";

const inputCls = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm";

export default function EditBannerPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    image_url: "",
    link_url: "",
    link_label: "Ver más",
    badge_text: "",
    position: "hero",
    background_color: "#0A1A44",
    display_order: 0,
    is_active: true,
    starts_at: "",
    ends_at: "",
  });

  useEffect(() => {
    async function fetchBanner() {
      try {
        const res = await fetch(`/api/cms/banners/${id}`);
        const data = await res.json();
        if (data.error) { setError(data.error); return; }
        const b = data.data;
        setFormData({
          title: b.title || "",
          subtitle: b.subtitle || "",
          image_url: b.image_url || "",
          link_url: b.link_url || "",
          link_label: b.link_label || "Ver más",
          badge_text: b.badge_text || "",
          position: b.position || "hero",
          background_color: b.background_color || "#0A1A44",
          display_order: b.display_order || 0,
          is_active: b.is_active !== undefined ? b.is_active : true,
          starts_at: b.starts_at ? b.starts_at.slice(0, 16) : "",
          ends_at: b.ends_at ? b.ends_at.slice(0, 16) : "",
        });
      } catch (err) { setError("Error al cargar banner"); }
      finally { setLoading(false); }
    }
    fetchBanner();
  }, [id]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? parseInt(value) || 0 : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...formData,
        starts_at: formData.starts_at || null,
        ends_at: formData.ends_at || null,
        badge_text: formData.badge_text || null,
      };
      const res = await fetch(`/api/cms/banners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setError(null);
    } catch (err) { setError("Error al actualizar banner"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-500">Cargando...</div>;

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/cms/banners" className="text-sm text-gray-500 hover:text-gray-700">← Volver a Banners</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Editar Banner</h1>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Título *</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} required className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Subtítulo</label>
              <input type="text" name="subtitle" value={formData.subtitle} onChange={handleChange} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <ImageUpload value={formData.image_url} onChange={(url) => setFormData((p) => ({ ...p, image_url: url }))} folder="banners" label="Imagen del banner" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">URL del enlace</label>
              <input type="text" name="link_url" value={formData.link_url} onChange={handleChange} placeholder="https://..." className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Texto del botón</label>
              <input type="text" name="link_label" value={formData.link_label} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Badge (etiqueta)</label>
              <input type="text" name="badge_text" value={formData.badge_text} onChange={handleChange} placeholder='Ej: OFERTA, NUEVO' className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Posición</label>
              <select name="position" value={formData.position} onChange={handleChange} className={inputCls}>
                <option value="hero">Hero</option>
                <option value="section">Sección</option>
                <option value="sidebar">Sidebar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Color de fondo</label>
              <div className="mt-1 flex items-center gap-3">
                <input type="color" name="background_color" value={formData.background_color} onChange={handleChange} className="h-10 w-14 cursor-pointer rounded border border-gray-300" />
                <input type="text" value={formData.background_color} onChange={(e) => setFormData((p) => ({ ...p, background_color: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Orden de visualización</label>
              <input type="number" name="display_order" value={formData.display_order} onChange={handleChange} min={0} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Inicio de vigencia</label>
              <input type="datetime-local" name="starts_at" value={formData.starts_at} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Fin de vigencia</label>
              <input type="datetime-local" name="ends_at" value={formData.ends_at} onChange={handleChange} className={inputCls} />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <input type="checkbox" name="is_active" id="is_active" checked={formData.is_active} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Banner activo</label>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={saving} className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
          <Link href="/dashboard/cms/banners" className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
