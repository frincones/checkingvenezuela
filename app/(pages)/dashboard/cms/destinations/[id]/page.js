"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ImageUpload } from "@/components/cms/ImageUpload";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

const inputCls = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm";
const labelCls = "block text-sm font-medium text-gray-700";
const sectionCls = "md:col-span-2 border-t pt-6 mt-4";
const addBtnCls = "mt-2 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline";
const removeBtnCls = "rounded p-1 text-gray-400 hover:text-red-500 transition-colors";

function SectionHeader({ title, subtitle, open, onToggle }) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
    </button>
  );
}

export default function EditDestinationPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);

  // Collapsible sections
  const [openSections, setOpenSections] = useState({
    cultural: false,
    places: false,
    experiences: false,
    practical: false,
    gastronomy: false,
    gallery: false,
    map: false,
    testimonials: false,
    seo: false,
  });

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    country: "",
    description: "",
    short_description: "",
    image_url: "",
    category_id: "",
    destination_type: "venezuela",
    language: "es",
    display_order: 0,
    is_featured: false,
    is_active: true,
    meta_title: "",
    meta_description: "",
    // Metadata fields
    gallery: [],
    coordinates: { lat: "", lng: "" },
    metadata: {
      cultural_description: "",
      must_see_places: [],
      experiences: [],
      practical_info: {
        climate: "",
        currency: "",
        how_to_get_there: "",
        local_transport: "",
        useful_tips: "",
      },
      gastronomy: "",
      lodging: "",
      testimonials: [],
    },
  });

  useEffect(() => {
    fetchCategories();
    fetchDestination();
  }, [params.id]);

  async function fetchCategories() {
    try {
      const response = await fetch("/api/cms/categories");
      const data = await response.json();
      if (!data.error) setCategories(data.data || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  }

  async function fetchDestination() {
    try {
      const response = await fetch(`/api/cms/destinations/${params.id}`);
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        const d = data.data;
        const meta = d.metadata || {};
        setFormData({
          name: d.name || "",
          slug: d.slug || "",
          country: d.country || "",
          description: d.description || "",
          short_description: d.short_description || "",
          image_url: d.image_url || "",
          category_id: d.category_id || "",
          destination_type: d.destination_type || "venezuela",
          language: d.language || "es",
          display_order: d.display_order || 0,
          is_featured: d.is_featured ?? false,
          is_active: d.is_active ?? true,
          meta_title: d.meta_title || "",
          meta_description: d.meta_description || "",
          gallery: d.gallery || [],
          coordinates: d.coordinates || { lat: "", lng: "" },
          metadata: {
            cultural_description: meta.cultural_description || "",
            must_see_places: meta.must_see_places || [],
            experiences: meta.experiences || [],
            practical_info: {
              climate: meta.practical_info?.climate || "",
              currency: meta.practical_info?.currency || "",
              how_to_get_there: meta.practical_info?.how_to_get_there || "",
              local_transport: meta.practical_info?.local_transport || "",
              useful_tips: meta.practical_info?.useful_tips || "",
            },
            gastronomy: meta.gastronomy || "",
            lodging: meta.lodging || "",
            testimonials: meta.testimonials || [],
          },
        });
      }
    } catch (err) {
      setError("Error al cargar el destino");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  function updateMetadata(path, value) {
    setFormData((prev) => {
      const meta = { ...prev.metadata };
      const keys = path.split(".");
      let obj = meta;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return { ...prev, metadata: meta };
    });
  }

  // Dynamic list helpers
  function addToList(path, template) {
    const keys = path.split(".");
    let val = formData.metadata;
    for (const k of keys) val = val[k];
    updateMetadata(path, [...(val || []), template]);
  }

  function removeFromList(path, index) {
    const keys = path.split(".");
    let val = formData.metadata;
    for (const k of keys) val = val[k];
    updateMetadata(path, val.filter((_, i) => i !== index));
  }

  function updateListItem(path, index, field, value) {
    const keys = path.split(".");
    let val = formData.metadata;
    for (const k of keys) val = val[k];
    const updated = [...val];
    updated[index] = { ...updated[index], [field]: value };
    updateMetadata(path, updated);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const { gallery, coordinates, metadata, ...rest } = formData;
      const response = await fetch(`/api/cms/destinations/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest,
          category_id: rest.category_id || null,
          gallery,
          coordinates: coordinates.lat && coordinates.lng
            ? { lat: parseFloat(coordinates.lat), lng: parseFloat(coordinates.lng) }
            : null,
          metadata,
        }),
      });

      const data = await response.json();
      if (data.error) setError(data.error);
      else router.push("/dashboard/cms/destinations");
    } catch (err) {
      setError("Error al actualizar el destino");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Estás seguro de eliminar este destino?")) return;
    try {
      const response = await fetch(`/api/cms/destinations/${params.id}`, { method: "DELETE" });
      const data = await response.json();
      if (data.error) setError(data.error);
      else router.push("/dashboard/cms/destinations");
    } catch (err) {
      setError("Error al eliminar el destino");
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  const { metadata: meta } = formData;

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/cms/destinations" className="text-sm text-gray-500 hover:text-gray-700">
          ← Volver a Destinos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Editar Destino</h1>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Información Básica</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className={labelCls}>Nombre *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Slug *</label>
              <input type="text" name="slug" value={formData.slug} onChange={handleChange} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>País *</label>
              <input type="text" name="country" value={formData.country} onChange={handleChange} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Categoría</label>
              <select name="category_id" value={formData.category_id} onChange={handleChange} className={inputCls}>
                <option value="">Sin categoría</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tipo de destino *</label>
              <select name="destination_type" value={formData.destination_type} onChange={handleChange} required className={inputCls}>
                <option value="venezuela">Destino Venezuela</option>
                <option value="flight">Vuelo internacional</option>
                <option value="hotel">Hotel</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Idioma del contenido *</label>
              <select name="language" value={formData.language} onChange={handleChange} required className={inputCls}>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Idioma en que está escrito el nombre, descripción y demás textos.
              </p>
            </div>
            <div>
              <label className={labelCls}>Orden de visualización</label>
              <input type="number" name="display_order" value={formData.display_order} onChange={handleChange} min="0" className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <ImageUpload value={formData.image_url} onChange={(url) => setFormData((prev) => ({ ...prev, image_url: url }))} folder="destinations" label="Imagen principal del destino" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Descripción corta</label>
              <input type="text" name="short_description" value={formData.short_description} onChange={handleChange} maxLength={160} className={inputCls} />
              <p className="mt-1 text-xs text-gray-400">{formData.short_description.length}/160 caracteres</p>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Descripción completa</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className={inputCls} />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="is_featured" checked={formData.is_featured} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                Destacado
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                Activo
              </label>
            </div>
          </div>
        </div>

        {/* Descubre el destino */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <SectionHeader title="Descubre el Destino" subtitle="Descripción cultural e histórica" open={openSections.cultural} onToggle={() => toggleSection("cultural")} />
          {openSections.cultural && (
            <div className="mt-4">
              <label className={labelCls}>Descripción cultural</label>
              <textarea value={meta.cultural_description} onChange={(e) => updateMetadata("cultural_description", e.target.value)} rows={6} placeholder="Historia, cultura, qué hace único al lugar..." className={inputCls} />
            </div>
          )}
        </div>

        {/* Lugares Imprescindibles */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <SectionHeader title="Lugares Imprescindibles" subtitle={`${meta.must_see_places.length} lugares`} open={openSections.places} onToggle={() => toggleSection("places")} />
          {openSections.places && (
            <div className="mt-4 space-y-4">
              {meta.must_see_places.map((place, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Lugar {i + 1}</span>
                    <button type="button" onClick={() => removeFromList("must_see_places", i)} className={removeBtnCls}><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Nombre</label>
                      <input type="text" value={place.name || ""} onChange={(e) => updateListItem("must_see_places", i, "name", e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <ImageUpload value={place.image || ""} onChange={(url) => updateListItem("must_see_places", i, "image", url)} folder="destinations" label="Imagen" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className={labelCls}>Descripción</label>
                    <textarea value={place.description || ""} onChange={(e) => updateListItem("must_see_places", i, "description", e.target.value)} rows={2} className={inputCls} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => addToList("must_see_places", { name: "", description: "", image: "" })} className={addBtnCls}>
                <Plus className="h-4 w-4" /> Agregar lugar
              </button>
            </div>
          )}
        </div>

        {/* Experiencias y Rutas */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <SectionHeader title="Experiencias y Rutas" subtitle={`${meta.experiences.length} experiencias`} open={openSections.experiences} onToggle={() => toggleSection("experiences")} />
          {openSections.experiences && (
            <div className="mt-4 space-y-3">
              {meta.experiences.map((exp, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-dashed border-gray-200 p-3">
                  <div className="flex-1 space-y-2">
                    <input type="text" value={exp.title || ""} onChange={(e) => updateListItem("experiences", i, "title", e.target.value)} placeholder="Título de la experiencia" className={inputCls} />
                    <textarea value={exp.description || ""} onChange={(e) => updateListItem("experiences", i, "description", e.target.value)} rows={2} placeholder="Descripción..." className={inputCls} />
                  </div>
                  <button type="button" onClick={() => removeFromList("experiences", i)} className={removeBtnCls}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => addToList("experiences", { title: "", description: "" })} className={addBtnCls}>
                <Plus className="h-4 w-4" /> Agregar experiencia
              </button>
            </div>
          )}
        </div>

        {/* Información Práctica */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <SectionHeader title="Información Práctica" subtitle="Clima, moneda, transporte, consejos" open={openSections.practical} onToggle={() => toggleSection("practical")} />
          {openSections.practical && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Clima</label>
                <textarea value={meta.practical_info.climate} onChange={(e) => updateMetadata("practical_info.climate", e.target.value)} rows={2} placeholder="Temperatura, épocas del año..." className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Moneda</label>
                <textarea value={meta.practical_info.currency} onChange={(e) => updateMetadata("practical_info.currency", e.target.value)} rows={2} placeholder="Métodos de pago recomendados..." className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cómo llegar</label>
                <textarea value={meta.practical_info.how_to_get_there} onChange={(e) => updateMetadata("practical_info.how_to_get_there", e.target.value)} rows={2} placeholder="Vuelos, carreteras..." className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Transporte local</label>
                <textarea value={meta.practical_info.local_transport} onChange={(e) => updateMetadata("practical_info.local_transport", e.target.value)} rows={2} placeholder="Taxis, lanchas, buses..." className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Consejos útiles</label>
                <textarea value={meta.practical_info.useful_tips} onChange={(e) => updateMetadata("practical_info.useful_tips", e.target.value)} rows={2} placeholder="Recomendaciones para el viajero..." className={inputCls} />
              </div>
            </div>
          )}
        </div>

        {/* Gastronomía y Alojamiento */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <SectionHeader title="Gastronomía y Alojamiento" open={openSections.gastronomy} onToggle={() => toggleSection("gastronomy")} />
          {openSections.gastronomy && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Gastronomía</label>
                <textarea value={meta.gastronomy} onChange={(e) => updateMetadata("gastronomy", e.target.value)} rows={4} placeholder="Platos típicos, restaurantes recomendados..." className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Alojamiento</label>
                <textarea value={meta.lodging} onChange={(e) => updateMetadata("lodging", e.target.value)} rows={4} placeholder="Tipos de hospedaje, posadas, hoteles..." className={inputCls} />
              </div>
            </div>
          )}
        </div>

        {/* Galería de imágenes */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <SectionHeader title="Galería de Imágenes" subtitle={`${formData.gallery.length} imágenes`} open={openSections.gallery} onToggle={() => toggleSection("gallery")} />
          {openSections.gallery && (
            <div className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {formData.gallery.map((url, i) => (
                  <div key={i} className="relative">
                    <ImageUpload
                      value={url}
                      onChange={(newUrl) => {
                        const updated = [...formData.gallery];
                        updated[i] = newUrl;
                        setFormData((prev) => ({ ...prev, gallery: updated }));
                      }}
                      folder="destinations"
                      label={`Imagen ${i + 1}`}
                    />
                    <button type="button" onClick={() => setFormData((prev) => ({ ...prev, gallery: prev.gallery.filter((_, j) => j !== i) }))} className="absolute right-1 top-1 rounded bg-red-500 p-1 text-white hover:bg-red-600">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setFormData((prev) => ({ ...prev, gallery: [...prev.gallery, ""] }))} className={addBtnCls}>
                <Plus className="h-4 w-4" /> Agregar imagen
              </button>
            </div>
          )}
        </div>

        {/* Mapa */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <SectionHeader title="Ubicación en Mapa" subtitle="Coordenadas para Google Maps" open={openSections.map} onToggle={() => toggleSection("map")} />
          {openSections.map && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Latitud</label>
                <input type="number" step="any" value={formData.coordinates?.lat || ""} onChange={(e) => setFormData((prev) => ({ ...prev, coordinates: { ...prev.coordinates, lat: e.target.value } }))} placeholder="10.1234" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Longitud</label>
                <input type="number" step="any" value={formData.coordinates?.lng || ""} onChange={(e) => setFormData((prev) => ({ ...prev, coordinates: { ...prev.coordinates, lng: e.target.value } }))} placeholder="-66.5678" className={inputCls} />
              </div>
            </div>
          )}
        </div>

        {/* Testimonios */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <SectionHeader title="Testimonios" subtitle={`${meta.testimonials.length} testimonios`} open={openSections.testimonials} onToggle={() => toggleSection("testimonials")} />
          {openSections.testimonials && (
            <div className="mt-4 space-y-3">
              {meta.testimonials.map((t, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-dashed border-gray-200 p-3">
                  <div className="flex-1 space-y-2">
                    <textarea value={t.text || ""} onChange={(e) => updateListItem("testimonials", i, "text", e.target.value)} rows={2} placeholder="Texto del testimonio..." className={inputCls} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input type="text" value={t.author || ""} onChange={(e) => updateListItem("testimonials", i, "author", e.target.value)} placeholder="Nombre del autor" className={inputCls} />
                      <input type="text" value={t.role || ""} onChange={(e) => updateListItem("testimonials", i, "role", e.target.value)} placeholder="Ej: Viajera frecuente" className={inputCls} />
                    </div>
                  </div>
                  <button type="button" onClick={() => removeFromList("testimonials", i)} className={removeBtnCls}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => addToList("testimonials", { text: "", author: "", role: "" })} className={addBtnCls}>
                <Plus className="h-4 w-4" /> Agregar testimonio
              </button>
            </div>
          )}
        </div>

        {/* SEO */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <SectionHeader title="SEO" subtitle="Meta título y descripción para buscadores" open={openSections.seo} onToggle={() => toggleSection("seo")} />
          {openSections.seo && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Meta título</label>
                <input type="text" name="meta_title" value={formData.meta_title} onChange={handleChange} maxLength={70} className={inputCls} />
                <p className="mt-1 text-xs text-gray-400">{formData.meta_title.length}/70</p>
              </div>
              <div>
                <label className={labelCls}>Meta descripción</label>
                <input type="text" name="meta_description" value={formData.meta_description} onChange={handleChange} maxLength={160} className={inputCls} />
                <p className="mt-1 text-xs text-gray-400">{formData.meta_description.length}/160</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between rounded-lg bg-white p-6 shadow-md">
          <div className="flex gap-4">
            <button type="submit" disabled={saving} className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
            <Link href="/dashboard/cms/destinations" className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </Link>
          </div>
          <button type="button" onClick={handleDelete} className="rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700">
            Eliminar
          </button>
        </div>
      </form>
    </div>
  );
}
