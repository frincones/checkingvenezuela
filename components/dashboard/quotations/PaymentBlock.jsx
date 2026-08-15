"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

/**
 * Bloque de cobro del detalle de cotización.
 *
 * Tres estados: sin cobro, cobro activo y cobrado. El asesor nunca elige
 * "PayPal": elige cuánto cobrar y cómo entregarlo. El proveedor es un detalle
 * de implementación.
 */

const STATUS = {
  created:        { label: "Creado",        cls: "bg-gray-100 text-gray-700" },
  sent:           { label: "Enviado",       cls: "bg-blue-100 text-blue-800" },
  viewed:         { label: "Visto",         cls: "bg-indigo-100 text-indigo-800" },
  partially_paid: { label: "Pago parcial",  cls: "bg-amber-100 text-amber-800" },
  paid:           { label: "Pagado",        cls: "bg-green-100 text-green-800" },
  cancelled:      { label: "Cancelado",     cls: "bg-gray-100 text-gray-500" },
  refunded:       { label: "Reembolsado",   cls: "bg-red-100 text-red-800" },
  expired:        { label: "Expirado",      cls: "bg-gray-100 text-gray-500" },
};

const ACTIVE = ["created", "sent", "viewed", "partially_paid"];

const money = (v, c = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(Number(v || 0));

export function PaymentBlock({ quotationId, total, currency, onChange }) {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [useDeposit, setUseDeposit] = useState(false);
  const [depositPct, setDepositPct] = useState(30);
  const [notify, setNotify] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/quotations/${quotationId}/payment-link`);
      if (res.ok) {
        const json = await res.json();
        setLink(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/quotations/${quotationId}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notify,
          // D1: por defecto se cobra el 100 %. El anticipo es opt-in.
          deposit_pct: useDeposit ? Number(depositPct) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo generar el cobro");
      setLink(json.data);
      toast.success(notify ? "Cobro generado y enviado al cliente" : "Cobro generado");
      onChange?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm("¿Cancelar este cobro? El cliente ya no podrá pagar con este enlace.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/payments/links/${link.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo cancelar");
      setLink(json.data);
      toast.success("Cobro cancelado");
      onChange?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remind() {
    setBusy(true);
    try {
      const res = await fetch(`/api/payments/links/${link.id}/remind`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo enviar el recordatorio");
      toast.success("Recordatorio enviado");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(link.url);
    toast.success("Enlace copiado");
  }

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Cobro</h2>
        <div className="h-20 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  const isActive = link && ACTIVE.includes(link.status);
  const isPaid = link?.status === "paid";
  const pending = link ? Number(link.amount) - Number(link.amount_paid || 0) : 0;

  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Cobro</h2>

      {/* ── Pagado ── */}
      {isPaid && (
        <div className="space-y-3">
          <div className="rounded-md bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">
              ✅ Pagado · {money(link.amount_paid, link.currency)}
            </p>
            {link.paid_at && (
              <p className="mt-1 text-xs text-green-700">
                {new Date(link.paid_at).toLocaleDateString("es-VE", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </p>
            )}
          </div>
          <a
            href={link.merchant_url || link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm text-primary hover:underline"
          >
            Ver en PayPal ↗
          </a>
        </div>
      )}

      {/* ── Cobro activo ── */}
      {isActive && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS[link.status].cls}`}>
              {STATUS[link.status].label}
            </span>
            <span className="text-lg font-bold text-gray-900">
              {money(link.amount, link.currency)}
            </span>
          </div>

          {link.status === "partially_paid" && (
            <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
              Pagado {money(link.amount_paid, link.currency)} ·{" "}
              <strong>pendiente {money(pending, link.currency)}</strong>
            </div>
          )}

          <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
            <p className="break-all font-mono text-[11px] text-gray-600">{link.url}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={copy}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              Copiar enlace
            </button>
            <button
              onClick={remind}
              disabled={busy}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Recordar
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <a
              href={link.merchant_url || link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Ver en PayPal ↗
            </a>
            <button
              onClick={cancel}
              disabled={busy}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              Cancelar cobro
            </button>
          </div>
        </div>
      )}

      {/* ── Sin cobro ── */}
      {!isActive && !isPaid && (
        <div className="space-y-3">
          {link && (
            <p className="text-xs text-gray-500">
              Último cobro: {STATUS[link.status]?.label || link.status}
            </p>
          )}

          <button
            onClick={generate}
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Generando…" : `Generar cobro · ${money(total, "USD")}`}
          </button>

          {currency && currency !== "USD" && (
            <p className="text-xs text-amber-700">
              La cotización está en {currency}; el cobro se emite en USD.
            </p>
          )}

          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={useDeposit}
              onChange={(e) => setUseDeposit(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            Cobrar solo un anticipo
            {useDeposit && (
              <input
                type="number"
                min="1"
                max="99"
                value={depositPct}
                onChange={(e) => setDepositPct(e.target.value)}
                className="w-14 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
              />
            )}
            {useDeposit && "%"}
          </label>

          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            Que PayPal envíe el email al cliente
          </label>
        </div>
      )}
    </div>
  );
}

export default PaymentBlock;
