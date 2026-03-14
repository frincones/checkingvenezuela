"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ProductSelectorModal } from "@/components/dashboard/quotations/ProductSelectorModal";
import { QuotationItemCard } from "@/components/dashboard/quotations/QuotationItemCard";

export default function NewQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("leadId");

  const [saving, setSaving] = useState(false);
  const [lead, setLead] = useState(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    quotation_type: "flight",
    currency: "USD",
    valid_until: "",
    notes: "",
    items: [],
    // New fields
    start_date: "",
    end_date: "",
    passengers: 1,
    observations: "",
    special_conditions: "",
    additional_services: [],
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
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  }

  function addInventoryItem(enrichedItem) {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, enrichedItem],
    }));
  }

  function addService() {
    setFormData((prev) => ({
      ...prev,
      additional_services: [...prev.additional_services, { description: "", price: 0 }],
    }));
  }

  function updateService(index, field, value) {
    const updated = [...formData.additional_services];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, additional_services: updated });
  }

  function removeService(index) {
    setFormData({
      ...formData,
      additional_services: formData.additional_services.filter((_, i) => i !== index),
    });
  }

  function calculateItemsTotal() {
    return formData.items.reduce((sum, item) => sum + (item.quantity || 1) * (item.unit_price || 0), 0);
  }

  function calculateServicesTotal() {
    return formData.additional_services.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
  }

  function calculateTotal() {
    return calculateItemsTotal() + calculateServicesTotal();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (formData.items.length === 0) {
      alert("Agrega al menos un item a la cotizacion");
      return;
    }
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

              {formData.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 text-gray-300">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                  <p className="text-sm font-medium text-gray-500">No hay items en la cotizacion</p>
                  <p className="mt-1 text-xs text-gray-400">Agrega productos del inventario o items manuales</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <QuotationItemCard
                      key={index}
                      item={item}
                      index={index}
                      onUpdate={updateItem}
                      onRemove={removeItem}
                      currency={formData.currency}
                    />
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setSelectorOpen(true)}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                  Agregar del Inventario
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Agregar Item Manual
                </button>
              </div>
            </div>

            {/* Product Selector Modal */}
            <ProductSelectorModal
              open={selectorOpen}
              onOpenChange={setSelectorOpen}
              onAddItem={addInventoryItem}
            />

            {/* Additional Services */}
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Servicios Adicionales</h2>

              {formData.additional_services.length === 0 ? (
                <p className="text-sm text-gray-400">No hay servicios adicionales</p>
              ) : (
                <div className="space-y-2">
                  {formData.additional_services.map((svc, i) => (
                    <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-gray-200 bg-white p-3">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs text-gray-500">Descripcion</label>
                        <input
                          type="text"
                          value={svc.description}
                          onChange={(e) => updateService(i, "description", e.target.value)}
                          placeholder="Ej: Seguro de viaje"
                          className="h-9 w-full rounded border border-gray-300 px-3 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="w-28">
                        <label className="mb-1 block text-xs text-gray-500">Precio</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={svc.price}
                          onChange={(e) => updateService(i, "price", parseFloat(e.target.value) || 0)}
                          className="h-9 w-full rounded border border-gray-300 px-2 text-right text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeService(i)}
                        className="mb-0.5 rounded p-1.5 text-gray-400 hover:text-red-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addService}
                className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                Agregar Servicio
              </button>
            </div>

            {/* Observations & Conditions */}
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Observaciones y Condiciones</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notas para el cliente</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Notas que apareceran en la cotizacion del cliente..."
                    className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Condiciones Especiales</label>
                  <textarea
                    value={formData.special_conditions}
                    onChange={(e) => setFormData({ ...formData, special_conditions: e.target.value })}
                    rows={3}
                    placeholder="Condiciones especiales que apareceran en el PDF..."
                    className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Observaciones internas
                    <span className="ml-1 text-xs font-normal text-gray-400">(no aparece en el PDF)</span>
                  </label>
                  <textarea
                    value={formData.observations}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    rows={2}
                    placeholder="Observaciones internas del equipo..."
                    className="mt-1 w-full rounded-md border border-gray-300 bg-yellow-50/50 p-3 text-sm focus:border-primary focus:ring-primary"
                  />
                </div>
              </div>
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

            {/* Travel Info */}
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Info del Viaje</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha inicio</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha fin</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pasajeros</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.passengers}
                    onChange={(e) => setFormData({ ...formData, passengers: parseInt(e.target.value) || 1 })}
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
                      {formatCurrency((item.quantity || 1) * (item.unit_price || 0))}
                    </span>
                  </div>
                ))}
                {formData.additional_services.length > 0 && (
                  <>
                    <div className="border-t pt-2 mt-1">
                      <span className="text-xs font-medium text-gray-500 uppercase">Servicios</span>
                    </div>
                    {formData.additional_services.map((svc, i) => (
                      <div key={`svc-${i}`} className="flex justify-between text-sm">
                        <span className="text-gray-600 truncate max-w-[150px]">
                          {svc.description || `Servicio ${i + 1}`}
                        </span>
                        <span className="text-gray-900">
                          {formatCurrency(parseFloat(svc.price) || 0)}
                        </span>
                      </div>
                    ))}
                  </>
                )}
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
