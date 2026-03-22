"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ImageUpload } from "@/components/cms/ImageUpload";

const inputCls = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm";

export default function EditBlogPostPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [formData, setFormData] = useState({
    title: "", slug: "", excerpt: "", content: "", cover_image: "",
    category: "general", tags: [], author_name: "", destination_id: "",
    status: "draft", meta_title: "", meta_description: "",
  });

  useEffect(() => {
    fetchPost();
    fetch("/api/cms/destinations").then((r) => r.json()).then((d) => {
      if (d.data) setDestinations(d.data);
    }).catch(() => {});
  }, [params.id]);

  async function fetchPost() {
    try {
      const res = await fetch(`/api/cms/blog/${params.id}`);
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else {
        const p = data.data;
        setFormData({
          title: p.title || "", slug: p.slug || "", excerpt: p.excerpt || "",
          content: p.content || "", cover_image: p.cover_image || "",
          category: p.category || "general", tags: p.tags || [],
          author_name: p.author_name || "", destination_id: p.destination_id || "",
          status: p.status || "draft", meta_title: p.meta_title || "",
          meta_description: p.meta_description || "",
        });
      }
    } catch (err) { setError("Error al cargar el post"); }
    finally { setLoading(false); }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/cms/blog/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, destination_id: formData.destination_id || null }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else router.push("/dashboard/cms/blog");
    } catch (err) { setError("Error al actualizar"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este post?")) return;
    await fetch(`/api/cms/blog/${params.id}`, { method: "DELETE" });
    router.push("/dashboard/cms/blog");
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-500">Cargando...</div>;

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/cms/blog" className="text-sm text-gray-500 hover:text-gray-700">← Volver al Blog</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Editar Post</h1>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Título *</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug</label>
              <input type="text" name="slug" value={formData.slug} onChange={handleChange} required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Categoría</label>
              <select name="category" value={formData.category} onChange={handleChange} className={inputCls}>
                <option value="general">General</option>
                <option value="destinos">Destinos</option>
                <option value="recomendaciones">Recomendaciones</option>
                <option value="tips">Tips de viaje</option>
                <option value="noticias">Noticias</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Autor</label>
              <input type="text" name="author_name" value={formData.author_name} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Destino relacionado</label>
              <select name="destination_id" value={formData.destination_id} onChange={handleChange} className={inputCls}>
                <option value="">Ninguno</option>
                {destinations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <ImageUpload value={formData.cover_image} onChange={(url) => setFormData((p) => ({ ...p, cover_image: url }))} folder="blog" label="Imagen de portada" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Extracto</label>
              <textarea name="excerpt" value={formData.excerpt} onChange={handleChange} rows={2} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Contenido</label>
              <textarea name="content" value={formData.content} onChange={handleChange} rows={15} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Estado</label>
              <select name="status" value={formData.status} onChange={handleChange} className={inputCls}>
                <option value="draft">Borrador</option>
                <option value="published">Publicado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">SEO</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="block text-sm font-medium text-gray-700">Meta título</label><input type="text" name="meta_title" value={formData.meta_title} onChange={handleChange} maxLength={70} className={inputCls} /></div>
            <div><label className="block text-sm font-medium text-gray-700">Meta descripción</label><input type="text" name="meta_description" value={formData.meta_description} onChange={handleChange} maxLength={160} className={inputCls} /></div>
          </div>
        </div>

        <div className="flex justify-between">
          <div className="flex gap-4">
            <button type="submit" disabled={saving} className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
            <Link href="/dashboard/cms/blog" className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</Link>
          </div>
          <button type="button" onClick={handleDelete} className="rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700">Eliminar</button>
        </div>
      </form>
    </div>
  );
}
