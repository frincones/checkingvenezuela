"use client";

/**
 * DualCTAWithTracking - Componente DualCTA con tracking de leads
 *
 * Extiende DualCTA para registrar leads cuando el usuario
 * hace clic en el botón de cotización WhatsApp.
 *
 * HU-003 + CRM: Dual CTA con captura de leads
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, MessageCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { createLeadFromQuoteIntentAction } from "@/lib/actions/crm/leadActions";

export function DualCTAWithTracking({
  // Configuración de compra online
  onlineEnabled = true,
  onlinePath = "#",
  onlineLabel = "Comprar",
  onlineComingSoon = false,

  // Configuración de cotización WhatsApp
  quoteEnabled = true,
  quoteMessage = "Hola, estoy interesado en cotizar este servicio.",
  quoteLabel = "Cotizar",

  // Datos para tracking de leads
  trackingData = null,
  // Ejemplo trackingData:
  // {
  //   interest_type: "flight" | "hotel" | "package" | etc,
  //   interest_details: {
  //     destination: "Cancún",
  //     origin: "Caracas",
  //     etc...
  //   },
  //   contact_name: "Usuario",
  //   landing_page: "/flights"
  // }

  // Estilo
  variant = "default", // "default" | "compact" | "card"
  className = "",
}) {
  const [isTracking, setIsTracking] = useState(false);
  const whatsappNumber = "584264034052";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(quoteMessage)}`;

  // Handler para tracking de lead antes de abrir WhatsApp
  const handleQuoteClick = async (e) => {
    // Si no hay datos de tracking, simplemente abrir WhatsApp
    if (!trackingData) {
      return;
    }

    e.preventDefault();
    setIsTracking(true);

    try {
      // Crear lead en background
      await createLeadFromQuoteIntentAction({
        interest_type: trackingData.interest_type || "other",
        interest_details: trackingData.interest_details || {},
        contact_name: trackingData.contact_name || "Usuario Web",
        contact_email: trackingData.contact_email || null,
        contact_phone: trackingData.contact_phone || null,
        landing_page:
          trackingData.landing_page ||
          (typeof window !== "undefined" ? window.location.pathname : null),
        utm_source: trackingData.utm_source || null,
        utm_medium: trackingData.utm_medium || null,
        utm_campaign: trackingData.utm_campaign || null,
      });
    } catch (error) {
      // Si falla el tracking, no bloquear al usuario
      console.error("Error tracking lead:", error);
    } finally {
      setIsTracking(false);
      // Abrir WhatsApp después del tracking
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Variante compacta (solo iconos)
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {onlineEnabled && (
          <Button
            asChild={!onlineComingSoon}
            size="icon"
            variant="default"
            className="h-8 w-8"
            disabled={onlineComingSoon}
            title={onlineComingSoon ? "Próximamente" : onlineLabel}
          >
            {onlineComingSoon ? (
              <span>
                <ShoppingCart className="h-4 w-4" />
              </span>
            ) : (
              <Link href={onlinePath}>
                <ShoppingCart className="h-4 w-4" />
              </Link>
            )}
          </Button>
        )}
        {quoteEnabled && (
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            title={quoteLabel}
            onClick={trackingData ? handleQuoteClick : undefined}
            asChild={!trackingData}
            disabled={isTracking}
          >
            {trackingData ? (
              isTracking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )
            ) : (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
              </a>
            )}
          </Button>
        )}
      </div>
    );
  }

  // Variante para cards (botones pequeños)
  if (variant === "card") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {onlineEnabled && (
          <Button
            asChild={!onlineComingSoon}
            size="sm"
            variant="default"
            className="flex-1 text-xs"
            disabled={onlineComingSoon}
          >
            {onlineComingSoon ? (
              <span className="flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" />
                Próximamente
              </span>
            ) : (
              <Link href={onlinePath} className="flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" />
                {onlineLabel}
              </Link>
            )}
          </Button>
        )}
        {quoteEnabled && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={trackingData ? handleQuoteClick : undefined}
            asChild={!trackingData}
            disabled={isTracking}
          >
            {trackingData ? (
              <span className="flex items-center gap-1">
                {isTracking ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <MessageCircle className="h-3 w-3" />
                )}
                {quoteLabel}
              </span>
            ) : (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                <MessageCircle className="h-3 w-3" />
                {quoteLabel}
              </a>
            )}
          </Button>
        )}
      </div>
    );
  }

  // Variante default (botones completos)
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {onlineEnabled && (
        <Button
          asChild={!onlineComingSoon}
          variant="default"
          disabled={onlineComingSoon}
        >
          {onlineComingSoon ? (
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Próximamente
            </span>
          ) : (
            <Link href={onlinePath} className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              {onlineLabel}
            </Link>
          )}
        </Button>
      )}
      {quoteEnabled && (
        <Button
          variant="outline"
          onClick={trackingData ? handleQuoteClick : undefined}
          asChild={!trackingData}
          disabled={isTracking}
        >
          {trackingData ? (
            <span className="flex items-center gap-2">
              {isTracking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              {quoteLabel}
            </span>
          ) : (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              {quoteLabel}
            </a>
          )}
        </Button>
      )}
    </div>
  );
}

export default DualCTAWithTracking;
