"use client";

import { Button } from "@/components/ui/button";
import { ShoppingCart, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useLeadCapture } from "@/hooks/useLeadCapture";
import { LeadCaptureModal } from "@/components/ui/LeadCaptureModal";

/**
 * DualCTA - Componente reutilizable para doble llamada a la acción
 *
 * Regla de negocio HU-003: Todos los productos/servicios deben tener:
 * - Comprar online
 * - Cotizar con asesor (ahora con captura de lead)
 */
export function DualCTA({
  // Configuración de compra online
  onlineEnabled = true,
  onlinePath = "#",
  onlineLabel = "Book now",
  onlineComingSoon = false,

  // Configuración de cotización WhatsApp
  quoteEnabled = true,
  quoteMessage = "Hi, I'm interested in getting a quote for this service.",
  quoteLabel = "Get a quote",

  // Tracking data for lead capture
  trackingData = null,

  // Estilo
  variant = "default", // "default" | "compact" | "card"
  className = "",
}) {
  const { modalOpen, setModalOpen, trackingData: modalTrackingData, requestCapture, handleLeadSubmit } =
    useLeadCapture();

  function handleQuoteClick(e) {
    e.preventDefault();
    requestCapture({
      action: "whatsapp",
      whatsappMessage: quoteMessage,
      trackingData: {
        source: "web_form",
        interest_type: trackingData?.interest_type || "other",
        interest_details: trackingData?.interest_details || {},
        ...(trackingData || {}),
      },
    });
  }

  const quoteButton = (size, variantStyle, extraClass, children) => (
    <Button
      size={size}
      variant={variantStyle}
      className={extraClass}
      onClick={handleQuoteClick}
    >
      {children}
    </Button>
  );

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
            title={onlineComingSoon ? "Coming soon" : onlineLabel}
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
        {quoteEnabled &&
          quoteButton("icon", "secondary", "h-8 w-8", (
            <MessageCircle className="h-4 w-4" />
          ))}

        <LeadCaptureModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSubmit={handleLeadSubmit}
          trackingData={modalTrackingData}
          triggerLabel="Continue to WhatsApp"
        />
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
                Coming soon
              </span>
            ) : (
              <Link href={onlinePath} className="flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" />
                {onlineLabel}
              </Link>
            )}
          </Button>
        )}
        {quoteEnabled &&
          quoteButton("sm", "outline", "flex-1 text-xs", (
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {quoteLabel}
            </span>
          ))}

        <LeadCaptureModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSubmit={handleLeadSubmit}
          trackingData={modalTrackingData}
          triggerLabel="Continue to WhatsApp"
        />
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
              Coming soon
            </span>
          ) : (
            <Link href={onlinePath} className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              {onlineLabel}
            </Link>
          )}
        </Button>
      )}
      {quoteEnabled &&
        quoteButton(undefined, "outline", undefined, (
          <span className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {quoteLabel}
          </span>
        ))}

      <LeadCaptureModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleLeadSubmit}
        trackingData={modalTrackingData}
        triggerLabel="Continue to WhatsApp"
      />
    </div>
  );
}

export default DualCTA;
