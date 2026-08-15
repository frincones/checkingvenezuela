import Image from "next/image";
import { ShieldCheck } from "lucide-react";

/**
 * Sello de "aceptamos PayPal".
 *
 * ⚠️ Es un SELLO DE CONFIANZA, no un botón de pago. El sitio público no tiene
 * checkout: todos los CTA terminan en un lead y el cobro lo genera después el
 * asesor desde la cotización. Por eso el texto dice "we accept" / "secure
 * payment" y nunca "Pay now" — prometer un pago que no existe manda al cliente
 * a un callejón sin salida.
 *
 * Si algún día hay checkout público, el gancho natural es
 * `catalog_services.has_online_purchase`, hoy en false para los 9 servicios.
 *
 * Variantes:
 *   inline  — junto al precio o a un CTA. Discreto.
 *   card    — recuadro con copy completo. Para formularios y modales.
 *   footer  — franja de métodos aceptados.
 *   compact — solo el logo con su etiqueta accesible.
 */

function Logo({ width = 72, className = "" }) {
  return (
    <Image
      src="/icons/paypal-logo.png"
      alt="PayPal"
      width={width}
      height={Math.round((width * 51) / 200)} // proporción original 200x51
      className={className}
      unoptimized
    />
  );
}

export function PaymentBadge({ variant = "inline", className = "" }) {
  if (variant === "compact") {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <Logo width={64} />
        <span className="sr-only">We accept PayPal</span>
      </span>
    );
  }

  if (variant === "footer") {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <p className="text-[0.8125rem] font-medium text-white/70">We accept</p>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5">
            <Logo width={68} />
          </span>
        </div>
        <p className="text-[0.6875rem] leading-relaxed text-white/50">
          Pay by PayPal, credit or debit card. Buyer protection included.
        </p>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={`rounded-lg border border-gray-200 bg-gray-50 p-4 ${className}`}
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                Secure payment with
              </span>
              <Logo width={68} />
            </div>
            <p className="text-xs leading-relaxed text-gray-600">
              Once your trip is confirmed we send you a PayPal invoice. Pay by
              PayPal, credit or debit card — no PayPal account required. Buyer
              protection included.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // inline
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ShieldCheck className="h-4 w-4 flex-shrink-0 text-green-600" />
      <span className="text-xs text-gray-600">Secure payment with</span>
      <Logo width={58} />
    </div>
  );
}

export default PaymentBadge;
