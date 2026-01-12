"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const LEAD_STATUS_LABELS = {
  new: { label: "Nuevo", color: "bg-blue-100 text-blue-800" },
  contacted: { label: "Contactado", color: "bg-indigo-100 text-indigo-800" },
  quoting: { label: "Cotizando", color: "bg-purple-100 text-purple-800" },
  quote_sent: { label: "Cotizacion Enviada", color: "bg-yellow-100 text-yellow-800" },
  awaiting_payment: { label: "Esperando Pago", color: "bg-orange-100 text-orange-800" },
  paid: { label: "Pagado", color: "bg-green-100 text-green-800" },
  fulfilled: { label: "Completado", color: "bg-emerald-100 text-emerald-800" },
  won: { label: "Ganado", color: "bg-teal-100 text-teal-800" },
  lost: { label: "Perdido", color: "bg-red-100 text-red-800" },
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchLead();
  }, [params.id]);

  async function fetchLead() {
    try {
      const response = await fetch(`/api/crm/leads/${params.id}`);
      const data = await response.json();
      if (data.data) {
        setLead(data.data);
        setNotes(data.data.notes || "");
      }
    } catch (err) {
      console.error("Error fetching lead:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateLead(updates) {
    setSaving(true);
    try {
      const response = await fetch(`/api/crm/leads/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setLead(data.data);
      }
    } catch (err) {
      console.error("Error updating lead:", err);
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead() {
    if (!confirm("Estas seguro de eliminar este lead?")) return;

    try {
      const response = await fetch(`/api/crm/leads/${params.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/dashboard/leads");
      }
    } catch (err) {
      console.error("Error deleting lead:", err);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando...</div>;
  }

  if (!lead) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Lead no encontrado</p>
        <Link href="/dashboard/leads" className="text-primary hover:underline">
          Volver a leads
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/leads" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver a leads
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{lead.customer_name}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={deleteLead}
            className="rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
          >
            Eliminar
          </button>
          <Link
            href={`/dashboard/quotations/new?leadId=${lead.id}`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            Crear Cotizacion
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Informacion de Contacto</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{lead.customer_email || "N/A"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Telefono</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {lead.customer_phone ? (
                    <a
                      href={`https://wa.me/${lead.customer_phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:underline"
                    >
                      {lead.customer_phone} (WhatsApp)
                    </a>
                  ) : (
                    "N/A"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Fuente</dt>
                <dd className="mt-1 text-sm text-gray-900">{lead.source}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Fecha de Creacion</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(lead.created_at).toLocaleString("es-VE")}
                </dd>
              </div>
            </dl>
          </div>

          {/* Interest */}
          {lead.interest && (
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Interes</h2>
              <p className="text-gray-700">{lead.interest}</p>
            </div>
          )}

          {/* Metadata */}
          {lead.metadata && Object.keys(lead.metadata).length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Detalles Adicionales</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                {Object.entries(lead.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-sm font-medium text-gray-500 capitalize">{key.replace(/_/g, " ")}</dt>
                    <dd className="mt-1 text-sm text-gray-900">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Notes */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Notas</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary focus:ring-primary"
              placeholder="Agregar notas sobre este lead..."
            />
            <button
              onClick={() => updateLead({ notes })}
              disabled={saving}
              className="mt-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar Notas"}
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Estado</h2>
            <select
              value={lead.status}
              onChange={(e) => updateLead({ status: e.target.value })}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            >
              {Object.entries(LEAD_STATUS_LABELS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <div className="mt-4">
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${LEAD_STATUS_LABELS[lead.status]?.color}`}>
                {LEAD_STATUS_LABELS[lead.status]?.label}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Acciones Rapidas</h2>
            <div className="space-y-2">
              {lead.customer_phone && (
                <a
                  href={`https://wa.me/${lead.customer_phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-200"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Enviar WhatsApp
                </a>
              )}
              {lead.customer_email && (
                <a
                  href={`mailto:${lead.customer_email}`}
                  className="flex items-center gap-2 rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Enviar Email
                </a>
              )}
              <button
                onClick={() => updateLead({ status: "contacted" })}
                className="flex w-full items-center gap-2 rounded-md bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Marcar Contactado
              </button>
            </div>
          </div>

          {/* Timeline placeholder */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Historial</h2>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="h-2 w-2 mt-2 rounded-full bg-blue-500"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Lead creado</p>
                  <p className="text-xs text-gray-500">
                    {new Date(lead.created_at).toLocaleString("es-VE")}
                  </p>
                </div>
              </div>
              {lead.updated_at !== lead.created_at && (
                <div className="flex gap-3">
                  <div className="h-2 w-2 mt-2 rounded-full bg-gray-400"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Ultima actualizacion</p>
                    <p className="text-xs text-gray-500">
                      {new Date(lead.updated_at).toLocaleString("es-VE")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
