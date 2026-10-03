"use client";

/**
 * Modal público de solicitud de reserva o cotización.
 *
 * Sustituye a LeadCaptureModal, que solo recogía tres campos y redirigía a
 * WhatsApp sin dejar constancia al cliente.
 *
 * Dos ideas lo gobiernan:
 *
 * 1. REVELADO PROGRESIVO. Abre pidiendo solo el email; al escribirlo aparece el
 *    resto. Se siente como una pregunta en vez de un formulario, y si el
 *    visitante abandona a mitad ya tenemos con qué responderle.
 *
 * 2. TRES CONTEXTOS, UN COMPONENTE. Siete puntos del sitio lo abren y no todos
 *    traen producto:
 *      · con paquete   → cabecera con nombre y precio, bloque de viaje
 *      · con destino   → cabecera con nombre, sin precio
 *      · sin nada      → cintillo, footer y /about; sin bloque de viaje
 *    Dos de esos puntos viven en el layout raíz, así que si el componente diera
 *    por hecho que siempre hay producto, el cintillo se rompería en todo el
 *    sitio. Por eso cada bloque es condicional.
 *
 * El canal de respuesta lo elige el visitante. Hasta ahora
 * leads.preferred_contact_method valía siempre "whatsapp" porque estaba escrito
 * a fuego en el código, así que no existe ningún dato real sobre qué prefiere
 * la gente. Esto empieza a generarlo.
 */

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@/data/countryCodes";
import { CheckCircle2, MessageCircle, Mail, Phone } from "lucide-react";

const STORAGE_KEY = "leadCaptureData";
const ADVISOR_EMAIL = "reservas@venezuelavoyages.com";

/** sessionStorage puede ser null o lanzar si el navegador bloquea almacenamiento. */
function readSaved() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSaved(data) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* almacenamiento bloqueado: no es un error de la aplicación */
  }
}

/** Próximos 12 meses como periodo aproximado: pedir un día exacto produce datos falsos. */
function travelPeriods() {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push(d.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
  }
  return out;
}

const CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
  { id: "email", label: "Email", Icon: Mail },
  { id: "phone", label: "Call me", Icon: Phone },
];

export function BookingRequestModal({
  open,
  onOpenChange,
  // Contexto del producto. Los tres ausentes = modal genérico.
  productType = null,
  productSlug = null,
  productName = null,
  productPrice = null,
  // Seguimiento
  origin = "booking_modal",
  utm = {},
  // Mensaje prellenado si el visitante acaba eligiendo WhatsApp
  whatsappMessage = "",
}) {
  const hasProduct = !!productName;

  const [step, setStep] = useState("form"); // form | done
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef(null);

  const [form, setForm] = useState({
    email: "",
    name: "",
    dialCode: DEFAULT_COUNTRY_CODE,
    phone: "",
    period: "",
    travelers: "2",
    message: "",
    channel: "whatsapp",
    consent: false,
  });

  // Al reabrir: estado limpio, pero conservando lo que ya escribió antes.
  useEffect(() => {
    if (!open) return;
    setStep("form");
    setError("");
    const saved = readSaved();
    if (saved) {
      setForm((prev) => ({
        ...prev,
        email: saved.email || prev.email,
        name: saved.name || prev.name,
        dialCode: saved.dialCode || prev.dialCode,
        phone: saved.phone || prev.phone,
      }));
      if (saved.email) setExpanded(true);
    }
  }, [open]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleEmail(value) {
    update("email", value);
    if (value.length > 2) setExpanded(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.email.includes("@")) {
      setError("Please enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    if (!form.consent) {
      setError("Please accept the privacy policy to continue.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/booking-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_email: form.email,
          contact_name: form.name || null,
          contact_phone: form.phone || null,
          contact_phone_dial_code: form.dialCode,
          preferred_channel: form.channel,
          product_type: productType,
          product_slug: productSlug,
          product_name: productName,
          travel_period: form.period || null,
          travelers_count: hasProduct ? Number(form.travelers) || null : null,
          message: form.message || null,
          consent: true,
          consent_version: "v1",
          origin,
          locale: "en",
          landing_page:
            typeof window !== "undefined" ? window.location.pathname : null,
          referrer_url:
            typeof document !== "undefined" ? document.referrer || null : null,
          utm_source: utm.source || null,
          utm_medium: utm.medium || null,
          utm_campaign: utm.campaign || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "We could not send your request. Please try again.");
        setSaving(false);
        return;
      }

      writeSaved({
        email: form.email,
        name: form.name,
        dialCode: form.dialCode,
        phone: form.phone,
      });

      // WhatsApp se abre SOLO aquí, y solo si el visitante eligió ese canal.
      // El flujo anterior lo abría al pulsar el botón y otra vez al enviar.
      if (form.channel === "whatsapp" && typeof window !== "undefined") {
        const base =
          whatsappMessage ||
          (productName
            ? `Hi! I just sent a request about "${productName}".`
            : "Hi! I just sent a request through your website.");
        const text = `${base}\n\nName: ${form.name || "-"}\nEmail: ${form.email}`;
        window.open(
          `https://wa.me/584264034052?text=${encodeURIComponent(text)}`,
          "_blank",
          "noopener,noreferrer"
        );
      }

      setStep("done");
    } catch {
      setError("We could not send your request. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const periods = travelPeriods();
  const advisorHref = `mailto:${ADVISOR_EMAIL}?subject=${encodeURIComponent(
    productName ? `Question about ${productName}` : "Travel enquiry"
  )}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[440px]">
        {step === "done" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <DialogTitle className="text-xl">Request sent</DialogTitle>
            <p className="max-w-[33ch] text-sm text-gray-600">
              We emailed a copy to <strong>{form.email}</strong>. An advisor will
              reply within 24 hours.
            </p>
            {hasProduct && (
              <div className="mt-2 w-full rounded-lg border border-dashed border-gray-300 p-3 text-left text-xs text-gray-600">
                <strong className="mb-1 block text-sm text-gray-900">
                  Want to speed things up?
                </strong>
                Share your travel companions and flight preferences, and we will
                have your quote ready sooner.
                <a
                  href={`/packages/${productSlug}/book`}
                  className="mt-2 block font-semibold text-gray-900 underline"
                >
                  Add trip details →
                </a>
              </div>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-2 text-sm font-medium text-gray-500 underline"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader className="space-y-1 text-left">
              {hasProduct && (
                <p className="text-[0.7rem] font-bold uppercase tracking-widest text-secondary">
                  {productName}
                </p>
              )}
              <DialogTitle className="text-xl">
                {hasProduct ? "Request your trip" : "Talk to an advisor"}
              </DialogTitle>
              {productPrice ? (
                <p className="text-sm text-gray-600">from ${productPrice} per person</p>
              ) : (
                !hasProduct && (
                  <p className="text-sm text-gray-600">
                    Tell us what you have in mind and we will get back to you.
                  </p>
                )
              )}
            </DialogHeader>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="br-email" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Your email
                </label>
                <input
                  ref={emailRef}
                  id="br-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(e) => handleEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
                />
              </div>

              {expanded && (
                <>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="br-name" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Full name
                    </label>
                    <input
                      id="br-name"
                      type="text"
                      autoComplete="name"
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="br-phone" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Phone / WhatsApp
                    </label>
                    <div className="grid grid-cols-[96px_1fr] gap-2">
                      <select
                        id="br-dial"
                        aria-label="Country code"
                        value={form.dialCode}
                        onChange={(e) => update("dialCode", e.target.value)}
                        className="rounded-lg border border-gray-300 px-2 py-2.5 text-sm focus:border-secondary focus:outline-none"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.country} value={c.code}>
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <input
                        id="br-phone"
                        type="tel"
                        autoComplete="tel"
                        value={form.phone}
                        onChange={(e) => update("phone", e.target.value)}
                        className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
                      />
                    </div>
                  </div>

                  {hasProduct ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label htmlFor="br-period" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                          When
                        </label>
                        <select
                          id="br-period"
                          value={form.period}
                          onChange={(e) => update("period", e.target.value)}
                          className="rounded-lg border border-gray-300 px-2 py-2.5 text-sm focus:border-secondary focus:outline-none"
                        >
                          <option value="">Not sure yet</option>
                          {periods.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor="br-pax" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Travelers
                        </label>
                        <select
                          id="br-pax"
                          value={form.travelers}
                          onChange={(e) => update("travelers", e.target.value)}
                          className="rounded-lg border border-gray-300 px-2 py-2.5 text-sm focus:border-secondary focus:outline-none"
                        >
                          {["1", "2", "3", "4", "5", "6+"].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <label htmlFor="br-msg" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                        How can we help?
                      </label>
                      <textarea
                        id="br-msg"
                        rows={2}
                        value={form.message}
                        onChange={(e) => update("message", e.target.value)}
                        placeholder="Tell us what you are looking for"
                        className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      How should we reply?
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {CHANNELS.map(({ id, label, Icon }) => (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={form.channel === id}
                          onClick={() => update("channel", id)}
                          className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                            form.channel === id
                              ? "border-secondary bg-secondary/10 text-gray-900"
                              : "border-gray-300 text-gray-500 hover:border-gray-400"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label htmlFor="br-consent" className="flex items-start gap-2 text-xs leading-relaxed text-gray-600">
                    <input
                      id="br-consent"
                      type="checkbox"
                      checked={form.consent}
                      onChange={(e) => update("consent", e.target.checked)}
                      className="mt-0.5 h-4 w-4 flex-shrink-0 accent-secondary"
                    />
                    <span>
                      I agree to be contacted about this trip and accept the{" "}
                      <a href="/privacy-policy" className="underline" target="_blank" rel="noopener noreferrer">
                        privacy policy
                      </a>
                      .
                    </span>
                  </label>
                </>
              )}

              {error && <p className="text-xs font-medium text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-secondary px-4 py-3 font-tradeGothic text-lg font-bold uppercase tracking-wide text-primary transition-colors hover:bg-secondary/90 disabled:opacity-60"
              >
                {saving ? "Sending…" : "Send request"}
              </button>

              <p className="text-center text-xs text-gray-500">
                Rather talk first?{" "}
                <a href={advisorHref} className="font-semibold text-gray-700 underline">
                  Email an advisor
                </a>
              </p>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BookingRequestModal;
