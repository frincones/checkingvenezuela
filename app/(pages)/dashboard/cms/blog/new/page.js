"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ImageUpload } from "@/components/cms/ImageUpload";

const TipTapEditor = dynamic(() => import("@/components/cms/TipTapEditor"), { ssr: false });

const inputCls = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm";

export default function NewBlogPostPage() {
  const router = useRouter();
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
    fetch("/api/cms/destinations").then((r) => r.json()).then((d) => {
      if (d.data) setDestinations(d.data);
    }).catch(() => {});
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "title") {
      const slug = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      setFormData((prev) => ({ ...prev, slug }));
    }
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
      const res = await fetch("/api/cms/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, destination_id: formData.destination_id || null }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else router.push(`/dashboard/cms/blog/${data.data.id}`);
    } catch (err) { setError("Error al crear post"); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard/cms/blog" className="text-sm text-gray-500 hover:text-gray-700">&larr; Volver al Blog</Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Nuevo Post</h1>
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
              <label className="block text-sm font-medium text-gray-700">Slug *</label>
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
              <input type="text" name="author_name" value={formData.author_name} onChange={handleChange} placeholder="Venezuela Voyages" className={inputCls} />
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
                placeholder="Breve resumen del post..."
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Contenido *</label>
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
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">SEO</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Meta titulo</label>
              <input type="text" name="meta_title" value={formData.meta_title} onChange={handleChange} maxLength={70} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Meta descripcion</label>
              <input type="text" name="meta_description" value={formData.meta_description} onChange={handleChange} maxLength={160} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={saving} className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Guardando..." : "Crear Post"}
          </button>
          <Link href="/dashboard/cms/blog" className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
