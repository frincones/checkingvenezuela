"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImageUpload } from "@/components/cms/ImageUpload";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";

export default function NewPackagePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [providers, setProviders] = useState([]);
  const [destinations, setDestinations] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    description: "",
    provider_id: "",
    destination_id: "",
    sale_price: "",
    cost_price: "",
    currency: "USD",
    status: "available",
    quantity_available: "",
    valid_from: "",
    valid_until: "",
    is_featured: false,
    is_published: true,
    display_order: 0,
    pricing_details: {
      display_text: "",
      price_type: "per_person",
      category: ""
    },
    details: {
      duration: "",
      itinerary: [],
      includes: [],
      not_includes: [],
      schedule: {
        departure: "",
        return: ""
      }
    },
    images: [],
    blackout_dates: []
  });

  useEffect(() => {
    fetchProviders();
    fetchDestinations();
  }, []);

  async function fetchProviders() {
    try {
      const response = await fetch("/api/cms/providers");
      const data = await response.json();
      if (!data.error) {
        setProviders(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching providers:", err);
    }
  }

  async function fetchDestinations() {
    try {
      const response = await fetch("/api/cms/destinations");
      const data = await response.json();
      if (!data.error) {
        setDestinations(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching destinations:", err);
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === "checkbox" ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value
      }));
    }
  }

  function handleImageAdd(url) {
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, url]
    }));
  }

  function handleImageRemove(index) {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  }

  function handleIncludeAdd() {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        includes: [...(prev.details.includes || []), ""]
      }
    }));
  }

  function handleIncludeChange(index, value) {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        includes: prev.details.includes.map((item, i) => i === index ? value : item)
      }
    }));
  }

  function handleIncludeRemove(index) {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        includes: prev.details.includes.filter((_, i) => i !== index)
      }
    }));
  }

  function handleNotIncludeAdd() {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        not_includes: [...(prev.details.not_includes || []), ""]
      }
    }));
  }

  function handleNotIncludeChange(index, value) {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        not_includes: prev.details.not_includes.map((item, i) => i === index ? value : item)
      }
    }));
  }

  function handleNotIncludeRemove(index) {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        not_includes: prev.details.not_includes.filter((_, i) => i !== index)
      }
    }));
  }

  // --- Schedule handlers ---
  function handleScheduleChange(field, value) {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        schedule: {
          ...(prev.details.schedule || {}),
          [field]: value,
        },
      },
    }));
  }

  // --- Itinerary handlers ---
  function handleItineraryAdd() {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        itinerary: [
          ...(prev.details.itinerary || []),
          {
            day: (prev.details.itinerary?.length || 0) + 1,
            title: "",
            activities: [],
            meals: [],
          },
        ],
      },
    }));
  }

  function handleItineraryRemove(index) {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        itinerary: prev.details.itinerary.filter((_, i) => i !== index),
      },
    }));
  }

  function handleItineraryFieldChange(index, field, value) {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        itinerary: prev.details.itinerary.map((d, i) =>
          i === index
            ? { ...d, [field]: field === "day" ? parseInt(value) || 0 : value }
            : d
        ),
      },
    }));
  }

  function handleDayListAdd(dayIndex, listField) {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        itinerary: prev.details.itinerary.map((d, i) =>
          i === dayIndex
            ? { ...d, [listField]: [...(d[listField] || []), ""] }
            : d
        ),
      },
    }));
  }

  function handleDayListChange(dayIndex, listField, itemIndex, value) {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        itinerary: prev.details.itinerary.map((d, i) =>
          i === dayIndex
            ? {
                ...d,
                [listField]: d[listField].map((item, j) =>
                  j === itemIndex ? value : item
                ),
              }
            : d
        ),
      },
    }));
  }

  function handleDayListRemove(dayIndex, listField, itemIndex) {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        itinerary: prev.details.itinerary.map((d, i) =>
          i === dayIndex
            ? { ...d, [listField]: d[listField].filter((_, j) => j !== itemIndex) }
            : d
        ),
      },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        provider_id: formData.provider_id || null,
        destination_id: formData.destination_id || null,
        sale_price: parseFloat(formData.sale_price) || null,
        cost_price: parseFloat(formData.cost_price) || null,
        quantity_available: formData.quantity_available ? parseInt(formData.quantity_available) : null,
        product_type: "package"
      };

      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        router.push("/dashboard/cms/packages");
      }
    } catch (err) {
      setError("Error al crear el paquete");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/cms/packages"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Volver a Paquetes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Crear Nuevo Paquete</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información Básica */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Información Básica</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Nombre del Paquete *
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
                SKU (Código único)
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="Ej: PKG-MAR-UNIK-3D2N"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Duración
              </label>
              <input
                type="text"
                name="details.duration"
                value={formData.details.duration}
                onChange={handleChange}
                placeholder="Ej: 3 días / 2 noches"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Proveedor
              </label>
              <select
                name="provider_id"
                value={formData.provider_id}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Seleccionar proveedor</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Destino *
              </label>
              <select
                name="destination_id"
                value={formData.destination_id}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Seleccionar destino</option>
                {destinations.map((dest) => (
                  <option key={dest.id} value={dest.id}>
                    {dest.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Descripción
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                placeholder="Describe el paquete turístico..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Precios */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Precios</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Precio de Venta *
              </label>
              <input
                type="number"
                name="sale_price"
                value={formData.sale_price}
                onChange={handleChange}
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Precio de Costo
              </label>
              <input
                type="number"
                name="cost_price"
                value={formData.cost_price}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Moneda
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="USD">USD</option>
                <option value="VES">VES</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Texto de Precio a Mostrar
              </label>
              <input
                type="text"
                name="pricing_details.display_text"
                value={formData.pricing_details.display_text}
                onChange={handleChange}
                placeholder="Ej: DESDE $470,00 POR PERSONA"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Categoría de Precio
              </label>
              <input
                type="text"
                name="pricing_details.category"
                value={formData.pricing_details.category}
                onChange={handleChange}
                placeholder="Ej: Todo Incluido"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Disponibilidad y Estado */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Disponibilidad</h2>
          <div className="grid gap-6 md:grid-cols-4">
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
                <option value="available">Disponible</option>
                <option value="limited">Limitado</option>
                <option value="sold_out">Agotado</option>
                <option value="discontinued">Descontinuado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Cantidad Disponible
              </label>
              <input
                type="number"
                name="quantity_available"
                value={formData.quantity_available}
                onChange={handleChange}
                min="0"
                placeholder="Dejar vacío para ilimitado"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Válido Desde
              </label>
              <input
                type="date"
                name="valid_from"
                value={formData.valid_from}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Válido Hasta
              </label>
              <input
                type="date"
                name="valid_until"
                value={formData.valid_until}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Imágenes */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Imágenes</h2>
          <p className="text-sm text-gray-600 mb-4">
            La primera imagen será la imagen principal del paquete
          </p>

          <ImageUpload
            value=""
            onChange={handleImageAdd}
            folder="packages"
            label="Agregar Imagen"
            placeholder="Sube imágenes del paquete"
          />

          {formData.images.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {formData.images.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Imagen ${index + 1}`}
                    className="h-32 w-full object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleImageRemove(index)}
                    className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {index === 0 && (
                    <span className="absolute top-2 left-2 bg-primary text-white px-2 py-1 text-xs rounded">
                      Principal
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incluye / No Incluye */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Qué Incluye / No Incluye</h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Incluye */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Qué Incluye
                </label>
                <button
                  type="button"
                  onClick={handleIncludeAdd}
                  className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Agregar
                </button>
              </div>
              <div className="space-y-2">
                {formData.details.includes?.length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    No hay items agregados. Haz clic en &quot;Agregar&quot; para añadir.
                  </p>
                )}
                {formData.details.includes?.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleIncludeChange(index, e.target.value)}
                      placeholder="Ej: ✈️ Vuelo ida y vuelta"
                      className="flex-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => handleIncludeRemove(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* No Incluye */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Qué NO Incluye
                </label>
                <button
                  type="button"
                  onClick={handleNotIncludeAdd}
                  className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Agregar
                </button>
              </div>
              <div className="space-y-2">
                {formData.details.not_includes?.length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    No hay items agregados. Haz clic en &quot;Agregar&quot; para añadir.
                  </p>
                )}
                {formData.details.not_includes?.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleNotIncludeChange(index, e.target.value)}
                      placeholder="Ej: Gastos personales"
                      className="flex-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => handleNotIncludeRemove(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Horarios */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Horarios</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Salida</label>
              <input
                type="text"
                value={formData.details.schedule?.departure || ""}
                onChange={(e) => handleScheduleChange("departure", e.target.value)}
                placeholder="Ej: 9:00 AM desde Caracas o Valencia (sujeto a disponibilidad)"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Retorno</label>
              <input
                type="text"
                value={formData.details.schedule?.return || ""}
                onChange={(e) => handleScheduleChange("return", e.target.value)}
                placeholder="Ej: 6:00 PM desde Margarita (sujeto a disponibilidad)"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Itinerario */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Itinerario Día a Día</h2>
            <button
              type="button"
              onClick={handleItineraryAdd}
              className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
            >
              <Plus className="h-4 w-4" /> Agregar Día
            </button>
          </div>

          {(!formData.details.itinerary || formData.details.itinerary.length === 0) && (
            <p className="text-sm italic text-gray-500">
              No hay días agregados. Haz clic en &quot;Agregar Día&quot; para añadir.
            </p>
          )}

          <div className="space-y-6">
            {formData.details.itinerary?.map((day, dayIndex) => (
              <div key={dayIndex} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-4 flex items-start gap-3">
                  <div className="w-20">
                    <label className="block text-xs font-medium text-gray-700">Día #</label>
                    <input
                      type="number"
                      value={day.day || ""}
                      onChange={(e) => handleItineraryFieldChange(dayIndex, "day", e.target.value)}
                      min="1"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700">Título del día</label>
                    <input
                      type="text"
                      value={day.title || ""}
                      onChange={(e) => handleItineraryFieldChange(dayIndex, "title", e.target.value)}
                      placeholder="Ej: Llegada a Isla Margarita"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleItineraryRemove(dayIndex)}
                    className="mt-5 text-red-600 hover:text-red-800"
                    title="Eliminar día"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Actividades */}
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-medium text-gray-700">Actividades</label>
                    <button
                      type="button"
                      onClick={() => handleDayListAdd(dayIndex, "activities")}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                    >
                      <Plus className="h-3 w-3" /> Agregar actividad
                    </button>
                  </div>
                  <div className="space-y-1">
                    {day.activities?.map((activity, actIndex) => (
                      <div key={actIndex} className="flex gap-2">
                        <input
                          type="text"
                          value={activity}
                          onChange={(e) => handleDayListChange(dayIndex, "activities", actIndex, e.target.value)}
                          placeholder="Ej: Check-in en hotel VIP"
                          className="block w-full flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={() => handleDayListRemove(dayIndex, "activities", actIndex)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comidas */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-medium text-gray-700">Comidas Incluidas</label>
                    <button
                      type="button"
                      onClick={() => handleDayListAdd(dayIndex, "meals")}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                    >
                      <Plus className="h-3 w-3" /> Agregar comida
                    </button>
                  </div>
                  <div className="space-y-1">
                    {day.meals?.map((meal, mealIndex) => (
                      <div key={mealIndex} className="flex gap-2">
                        <input
                          type="text"
                          value={meal}
                          onChange={(e) => handleDayListChange(dayIndex, "meals", mealIndex, e.target.value)}
                          placeholder="Ej: Desayuno buffet"
                          className="block w-full flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={() => handleDayListRemove(dayIndex, "meals", mealIndex)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Configuración */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Configuración</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex items-center gap-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_featured"
                  checked={formData.is_featured}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label className="ml-2 text-sm text-gray-700">Destacado</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_published"
                  checked={formData.is_published}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label className="ml-2 text-sm text-gray-700">Publicado</label>
              </div>
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
                min="0"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex gap-4 rounded-lg bg-white p-6 shadow-md">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Creando..." : "Crear Paquete"}
          </button>
          <Link
            href="/dashboard/cms/packages"
            className="rounded-md border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
