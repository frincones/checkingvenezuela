"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ImageUpload } from "@/components/cms/ImageUpload";

const TipTapEditor = dynamic(() => import("@/components/cms/TipTapEditor"), { ssr: false });

const inputCls = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm";

export default function EditBlogPostPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [tagInput, setTagInput] = useState("");
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

  function handleAddTag(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,/g, "");
      if (tag && !formData.tags.includes(tag)) {
        setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
      }
      setTagInput("");
    }
  }

  function handleRemoveTag(tag) {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard/cms/blog" className="text-sm text-gray-500 hover:text-gray-700">&larr; Volver al Blog</Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Editar Post</h1>
        </div>
        {formData.slug && (
          <button
            type="button"
            onClick={() => window.open(`/blog/${formData.slug}`, "_blank")}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Vista previa
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Titulo *</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug</label>
              <input type="text" name="slug" value={formData.slug} onChange={handleChange} required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Categoria</label>
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

            {/* Excerpt with character counter */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Extracto</label>
              <textarea
                name="excerpt"
                value={formData.excerpt}
                onChange={(e) => {
                  if (e.target.value.length <= 300) handleChange(e);
                }}
                rows={2}
                maxLength={300}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-400 text-right">
                {formData.excerpt.length}/300 caracteres
              </p>
            </div>

            {/* Tags */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Tags</label>
              <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-gray-300 px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                {formData.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-0.5 text-primary/60 hover:text-primary">&times;</button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder={formData.tags.length === 0 ? "Escribe un tag y presiona Enter..." : ""}
                  className="flex-1 min-w-[120px] border-0 p-0 text-sm focus:outline-none focus:ring-0"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">Presiona Enter o coma para agregar un tag</p>
            </div>

            {/* TipTap rich editor */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Contenido</label>
              <TipTapEditor
                content={formData.content}
                onChange={(html) => setFormData((prev) => ({ ...prev, content: html }))}
              />
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
            <div><label className="block text-sm font-medium text-gray-700">Meta titulo</label><input type="text" name="meta_title" value={formData.meta_title} onChange={handleChange} maxLength={70} className={inputCls} /></div>
            <div><label className="block text-sm font-medium text-gray-700">Meta descripcion</label><input type="text" name="meta_description" value={formData.meta_description} onChange={handleChange} maxLength={160} className={inputCls} /></div>
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
