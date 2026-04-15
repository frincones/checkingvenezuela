"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const QUOTATION_STATUS_LABELS = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-800" },
  sent: { label: "Enviada", color: "bg-blue-100 text-blue-800" },
  viewed: { label: "Vista", color: "bg-indigo-100 text-indigo-800" },
  accepted: { label: "Aceptada", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rechazada", color: "bg-red-100 text-red-800" },
  expired: { label: "Expirada", color: "bg-yellow-100 text-yellow-800" },
  converted: { label: "Convertida", color: "bg-emerald-100 text-emerald-800" },
};

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [relatedVouchers, setRelatedVouchers] = useState([]);
  const [pdfError, setPdfError] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailModal, setEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", message: "" });
  const [emailResult, setEmailResult] = useState(null);

  useEffect(() => {
    fetchQuotation();
    fetchRelatedVouchers();
  }, [params.id]);

  async function fetchRelatedVouchers() {
    try {
      const res = await fetch(`/api/vouchers?quotation_id=${params.id}&limit=10`);
      const json = await res.json();
      if (json.data) setRelatedVouchers(json.data);
    } catch {
      // silent
    }
  }

  async function fetchQuotation() {
    try {
      const response = await fetch(`/api/crm/quotations/${params.id}`);
      const data = await response.json();
      if (data.data) {
        setQuotation(data.data);
      }
    } catch (err) {
      console.error("Error fetching quotation:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateQuotation(updates) {
    setSaving(true);
    try {
      const response = await fetch(`/api/crm/quotations/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setQuotation(data.data);
      }
    } catch (err) {
      console.error("Error updating quotation:", err);
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuotation() {
    if (!confirm("Estas seguro de eliminar esta cotizacion?")) return;

    try {
      const response = await fetch(`/api/crm/quotations/${params.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/dashboard/quotations");
      }
    } catch (err) {
      console.error("Error deleting quotation:", err);
    }
  }

  async function sendToCustomer() {
    // Update status to sent
    await updateQuotation({ status: "sent", sent_at: new Date().toISOString() });

    // Get customer info from lead or metadata
    const customerName = quotation.lead?.contact_name || quotation.metadata?.customer_name || "Cliente";
    const customerPhone = quotation.lead?.contact_phone || quotation.metadata?.customer_phone;
    const total = quotation.total || quotation.total_amount || 0;

    // Open WhatsApp with quotation message
    if (customerPhone) {
      const message = encodeURIComponent(
        `Hola ${customerName}!\n\n` +
        `Le enviamos su cotizacion ${quotation.quotation_number}.\n\n` +
        `Total: ${formatCurrency(total)}\n` +
        `Valida hasta: ${new Date(quotation.valid_until).toLocaleDateString("es-VE")}\n\n` +
        `Quedamos atentos a cualquier consulta.`
      );
      window.open(`https://wa.me/${customerPhone.replace(/\D/g, "")}?text=${message}`, "_blank");
    }
  }

  function openEmailModal() {
    const toEmail =
      quotation.lead?.contact_email ||
      quotation.metadata?.customer_email ||
      "";
    setEmailForm({
      to: toEmail,
      subject: `Cotización ${quotation.quotation_number} — Venezuela Voyages`,
      message: "",
    });
    setEmailResult(null);
    setEmailModal(true);
  }

  async function sendEmail() {
    if (!emailForm.to) return;
    setSendingEmail(true);
    setEmailResult(null);
    try {
      const response = await fetch(`/api/crm/quotations/${params.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEmailResult({ success: true, message: data.message });
      await fetchQuotation();
      setTimeout(() => setEmailModal(false), 2000);
    } catch (err) {
      setEmailResult({ success: false, message: err.message });
    } finally {
      setSendingEmail(false);
    }
  }

  async function generateAndPreviewPdf() {
    setGeneratingPdf(true);
    setPdfError(null);
    try {
      const response = await fetch(`/api/crm/quotations/${params.id}/pdf`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al generar PDF");
      }

      // Get the PDF blob and open in new tab
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");

      // Refresh quotation to get updated pdf_url
      await fetchQuotation();
    } catch (err) {
      console.error("Error generating PDF:", err);
      setPdfError(err.message);
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function downloadPdf() {
    setGeneratingPdf(true);
    setPdfError(null);
    try {
      const response = await fetch(`/api/crm/quotations/${params.id}/pdf`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al generar PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cotizacion-${quotation.quotation_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Refresh quotation to get updated pdf_url
      await fetchQuotation();
    } catch (err) {
      console.error("Error downloading PDF:", err);
      setPdfError(err.message);
    } finally {
      setGeneratingPdf(false);
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: quotation?.currency || "USD",
    }).format(amount);
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando...</div>;
  }

  if (!quotation) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Cotizacion no encontrada</p>
        <Link href="/dashboard/quotations" className="text-primary hover:underline">
          Volver a cotizaciones
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/quotations" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver a cotizaciones
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Cotizacion {quotation.quotation_number}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={deleteQuotation}
            className="rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
          >
            Eliminar
          </button>
          {quotation.status === "draft" && (
            <button
              onClick={sendToCustomer}
              disabled={saving}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Enviar al Cliente
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Informacion del Cliente</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Nombre</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {quotation.lead?.contact_name || quotation.metadata?.customer_name || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {quotation.lead?.contact_email || quotation.metadata?.customer_email || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Telefono</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {(quotation.lead?.contact_phone || quotation.metadata?.customer_phone) ? (
                    <a
                      href={`https://wa.me/${(quotation.lead?.contact_phone || quotation.metadata?.customer_phone).replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:underline"
                    >
                      {quotation.lead?.contact_phone || quotation.metadata?.customer_phone}
                    </a>
                  ) : (
                    "N/A"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Tipo</dt>
                <dd className="mt-1 text-sm text-gray-900 capitalize">
                  {(quotation.metadata?.quotation_type || quotation.quotation_type) === "flight" && "Vuelo"}
                  {(quotation.metadata?.quotation_type || quotation.quotation_type) === "hotel" && "Hotel"}
                  {(quotation.metadata?.quotation_type || quotation.quotation_type) === "package" && "Paquete"}
                  {!(quotation.metadata?.quotation_type || quotation.quotation_type) && "General"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Items */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Items</h2>
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left text-sm font-medium text-gray-500">Descripcion</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-500">Cant.</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-500">Precio Unit.</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-500">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items?.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-3 text-sm text-gray-900">{item.description}</td>
                    <td className="py-3 text-right text-sm text-gray-600">{item.quantity}</td>
                    <td className="py-3 text-right text-sm text-gray-600">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="py-3 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="py-3 text-right text-sm font-semibold text-gray-900">
                    Total
                  </td>
                  <td className="py-3 text-right text-lg font-bold text-primary">
                    {formatCurrency(quotation.total || quotation.total_amount || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {quotation.notes && (
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Notas</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Estado</h2>
            <select
              value={quotation.status}
              onChange={(e) => updateQuotation({ status: e.target.value })}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            >
              {Object.entries(QUOTATION_STATUS_LABELS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <div className="mt-4">
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${QUOTATION_STATUS_LABELS[quotation.status]?.color}`}>
                {QUOTATION_STATUS_LABELS[quotation.status]?.label}
              </span>
            </div>
          </div>

          {/* Dates */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Fechas</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Creada</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(quotation.created_at).toLocaleString("es-VE")}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Valida hasta</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {quotation.valid_until
                    ? new Date(quotation.valid_until).toLocaleDateString("es-VE")
                    : "N/A"}
                </dd>
              </div>
              {quotation.sent_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Enviada</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(quotation.sent_at).toLocaleString("es-VE")}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Acciones</h2>
            <div className="space-y-2">
              {/* PDF Actions */}
              <button
                onClick={generateAndPreviewPdf}
                disabled={generatingPdf}
                className="flex w-full items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {generatingPdf ? "Generando..." : "Ver PDF"}
              </button>
              <button
                onClick={downloadPdf}
                disabled={generatingPdf}
                className="flex w-full items-center gap-2 rounded-md bg-purple-100 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-200 disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {generatingPdf ? "Descargando..." : "Descargar PDF"}
              </button>
              {quotation.pdf_url && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  PDF guardado en Storage
                </p>
              )}
              {pdfError && (
                <p className="text-sm text-red-600">{pdfError}</p>
              )}

              <hr className="my-3" />

              {(quotation.lead?.contact_phone || quotation.metadata?.customer_phone) && (
                <a
                  href={`https://wa.me/${(quotation.lead?.contact_phone || quotation.metadata?.customer_phone).replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-2 rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-200"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </a>
              )}
              <button
                onClick={openEmailModal}
                className="flex w-full items-center gap-2 rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Enviar por Email
              </button>
              {quotation.status === "accepted" && (
                <button
                  onClick={() => updateQuotation({ status: "converted" })}
                  className="flex w-full items-center gap-2 rounded-md bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-200"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Marcar como Convertida
                </button>
              )}
              <Link
                href={`/dashboard/vouchers/new?from_quotation=${params.id}`}
                className="flex w-full items-center gap-2 rounded-md bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-200"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                Convertir a Voucher
              </Link>
            </div>
          </div>

          {/* Lead Link */}
          {quotation.lead_id && (
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Lead Asociado</h2>
              <Link
                href={`/dashboard/leads/${quotation.lead_id}`}
                className="text-primary hover:underline"
              >
                Ver Lead →
              </Link>
            </div>
          )}

          {/* Related Vouchers */}
          {relatedVouchers.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Vouchers Emitidos</h2>
              <div className="space-y-2">
                {relatedVouchers.map((v) => (
                  <Link
                    key={v.id}
                    href={`/dashboard/vouchers/${v.id}`}
                    className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-900">{v.voucher_number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      v.status === "sent" ? "bg-green-100 text-green-700" :
                      v.status === "issued" ? "bg-blue-100 text-blue-700" :
                      v.status === "cancelled" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {v.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Enviar Cotización por Email</h3>
              <button onClick={() => setEmailModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Para</label>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                  placeholder="cliente@email.com"
                  className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Asunto</label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Mensaje adicional (opcional)</label>
                <textarea
                  value={emailForm.message}
                  onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                  rows={3}
                  placeholder="Mensaje personalizado para el cliente..."
                  className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-500">
                Se adjuntará automáticamente el PDF de la cotización al email.
                <br />
                Enviado desde: <strong>ventas@venezuelavoyages.com</strong>
              </div>

              {emailResult && (
                <div className={`rounded-md p-3 text-sm ${emailResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {emailResult.message}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEmailModal(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={sendEmail}
                disabled={sendingEmail || !emailForm.to}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingEmail ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Enviar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
