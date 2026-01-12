"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const LEAD_SOURCES = [
  { value: "web_form", label: "Formulario Web" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "chatbot", label: "Chatbot" },
  { value: "registration", label: "Registro" },
  { value: "booking_intent", label: "Intento de Reserva" },
  { value: "referral", label: "Referido" },
  { value: "social_media", label: "Redes Sociales" },
  { value: "phone", label: "Telefono" },
  { value: "email", label: "Email" },
  { value: "other", label: "Otro" },
];

const INTEREST_TYPES = [
  { value: "flight", label: "Vuelos" },
  { value: "hotel", label: "Hoteles" },
  { value: "package", label: "Paquetes" },
  { value: "other", label: "Otro" },
];

export default function NewLeadPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    source: "web_form",
    interest_type: "flight",
    interest_details: "",
    notes: "",
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: formData.contact_name,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
          source: formData.source,
          interest_type: formData.interest_type,
          interest_details: formData.interest_details
            ? { description: formData.interest_details, notes: formData.notes }
            : { notes: formData.notes },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al crear lead");
      }

      router.push("/dashboard/leads");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/leads" className="text-sm text-gray-500 hover:text-gray-700">
          ← Volver a leads
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Nuevo Lead</h1>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 shadow-md">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact Name */}
          <div>
            <label htmlFor="contact_name" className="block text-sm font-medium text-gray-700">
              Nombre del Contacto *
            </label>
            <input
              type="text"
              id="contact_name"
              name="contact_name"
              required
              value={formData.contact_name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Juan Perez"
            />
          </div>

          {/* Contact Email */}
          <div>
            <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              id="contact_email"
              name="contact_email"
              value={formData.contact_email}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="juan@ejemplo.com"
            />
          </div>

          {/* Contact Phone */}
          <div>
            <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700">
              Telefono
            </label>
            <input
              type="tel"
              id="contact_phone"
              name="contact_phone"
              value={formData.contact_phone}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="+58 412 1234567"
            />
          </div>

          {/* Source */}
          <div>
            <label htmlFor="source" className="block text-sm font-medium text-gray-700">
              Fuente *
            </label>
            <select
              id="source"
              name="source"
              required
              value={formData.source}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {LEAD_SOURCES.map((source) => (
                <option key={source.value} value={source.value}>
                  {source.label}
                </option>
              ))}
            </select>
          </div>

          {/* Interest Type */}
          <div>
            <label htmlFor="interest_type" className="block text-sm font-medium text-gray-700">
              Tipo de Interes
            </label>
            <select
              id="interest_type"
              name="interest_type"
              value={formData.interest_type}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {INTEREST_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Interest Details - Full Width */}
          <div className="md:col-span-2">
            <label htmlFor="interest_details" className="block text-sm font-medium text-gray-700">
              Detalles del Interes
            </label>
            <textarea
              id="interest_details"
              name="interest_details"
              rows={3}
              value={formData.interest_details}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Describe el interes del cliente (destino, fechas, numero de pasajeros, etc.)"
            />
          </div>

          {/* Notes - Full Width */}
          <div className="md:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notas Adicionales
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Notas internas sobre el lead"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <Link
            href="/dashboard/leads"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Crear Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
