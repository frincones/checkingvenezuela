"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function NewQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("leadId");

  const [saving, setSaving] = useState(false);
  const [lead, setLead] = useState(null);
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    quotation_type: "flight",
    currency: "USD",
    valid_until: "",
    notes: "",
    items: [{ description: "", quantity: 1, unit_price: 0 }],
  });

  useEffect(() => {
    if (leadId) {
      fetchLead();
    }
  }, [leadId]);

  async function fetchLead() {
    try {
      const response = await fetch(`/api/crm/leads/${leadId}`);
      const data = await response.json();
      if (data.data) {
        setLead(data.data);
        setFormData((prev) => ({
          ...prev,
          customer_name: data.data.customer_name || "",
          customer_email: data.data.customer_email || "",
          customer_phone: data.data.customer_phone || "",
        }));
      }
    } catch (err) {
      console.error("Error fetching lead:", err);
    }
  }

  function updateItem(index, field, value) {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  }

  function addItem() {
    setFormData({
      ...formData,
      items: [...formData.items, { description: "", quantity: 1, unit_price: 0 }],
    });
  }

  function removeItem(index) {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData({ ...formData, items: newItems });
    }
  }

  function calculateTotal() {
    return formData.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/crm/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          lead_id: leadId || null,
          total_amount: calculateTotal(),
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Update lead status if coming from a lead
        if (leadId) {
          await fetch(`/api/crm/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "quoting" }),
          });
        }

        router.push(`/dashboard/quotations/${data.data.id}`);
      }
    } catch (err) {
      console.error("Error creating quotation:", err);
    } finally {
      setSaving(false);
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: formData.currency,
    }).format(amount);
  }

  // Set default valid_until to 7 days from now
  useEffect(() => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setFormData((prev) => ({
      ...prev,
      valid_until: defaultDate.toISOString().split("T")[0],
    }));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/quotations" className="text-sm text-gray-500 hover:text-gray-700">
          ← Volver a cotizaciones
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Nueva Cotizacion</h1>
        {lead && (
          <p className="mt-1 text-sm text-gray-500">
            Creando cotizacion para lead: {lead.customer_name}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Customer Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Informacion del Cliente</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefono</label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Items de la Cotizacion</h2>
              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <div key={index} className="grid gap-4 sm:grid-cols-12 items-end">
                    <div className="sm:col-span-6">
                      <label className="block text-sm font-medium text-gray-700">Descripcion</label>
                      <input
                        type="text"
                        required
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        placeholder="Ej: Vuelo CCS-MIA ida y vuelta"
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Precio Unitario</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={formData.items.length === 1}
                        className="rounded-md bg-red-100 p-2 text-red-700 hover:bg-red-200 disabled:opacity-50"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addItem}
                className="mt-4 flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Agregar Item
              </button>
            </div>

            {/* Notes */}
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Notas</h2>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                placeholder="Notas adicionales para el cliente..."
                className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary focus:ring-primary"
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quotation Details */}
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Detalles</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo</label>
                  <select
                    value={formData.quotation_type}
                    onChange={(e) => setFormData({ ...formData, quotation_type: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
                  >
                    <option value="flight">Vuelo</option>
                    <option value="hotel">Hotel</option>
                    <option value="package">Paquete</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Moneda</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
                  >
                    <option value="USD">USD - Dolar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="VES">VES - Bolivar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Valida hasta</label>
                  <input
                    type="date"
                    required
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Resumen</h2>
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600 truncate max-w-[150px]">
                      {item.description || `Item ${index + 1}`}
                    </span>
                    <span className="text-gray-900">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-lg text-primary">{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="rounded-lg bg-white p-6 shadow-md">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Crear Cotizacion"}
              </button>
              <Link
                href="/dashboard/quotations"
                className="mt-2 block w-full rounded-md bg-gray-100 px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancelar
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
