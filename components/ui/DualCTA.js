"use client";

import { Button } from "@/components/ui/button";
import { ShoppingCart, MessageCircle } from "lucide-react";
import { useState } from "react";
import { BookingRequestModal } from "@/components/ui/BookingRequestModal";

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
  onlineLabel = "Book now",
  onlineComingSoon = false,

  // Configuración de cotización WhatsApp
  quoteEnabled = true,
  quoteMessage = "Hi, I'm interested in getting a quote for this service.",
  quoteLabel = "Get a quote",

  // Contexto para el modal. Opcional: si no llega nada, el modal usa su
  // variante genérica, que es lo correcto para un CTA sin producto.
  productType = null,
  productName = null,
  productSlug = null,
  productPrice = null,

  // Se mantiene por compatibilidad con los usos existentes.
  trackingData = null,

  // Estilo
  variant = "default", // "default" | "compact" | "card"
  className = "",
}) {
  const [open, setOpen] = useState(false);

  // Tanto "Book now" como "Get a quote" abren el modal. Antes el primero era
  // un <Link> que navegaba: en la home llevaba a /flights y /hotels, y
  // /flights está rota en producción, así que además de lo pedido esto evita
  // que alguien aterrice en una pantalla de error.
  function openModal(e) {
    if (e) e.preventDefault();
    setOpen(true);
  }

  // Un único modal para las tres variantes: antes estaba repetido en las tres
  // ramas del return, con el mismo riesgo de divergencia tres veces.
  const modal = (
    <BookingRequestModal
      open={open}
      onOpenChange={setOpen}
      productType={productType}
      productName={productName}
      productSlug={productSlug}
      productPrice={productPrice}
      origin="dual_cta"
      whatsappMessage={quoteMessage}
    />
  );

  const quoteButton = (size, variantStyle, extraClass, children) => (
    <Button
      size={size}
      variant={variantStyle}
      className={extraClass}
      onClick={openModal}
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
            size="icon"
            variant="default"
            className="h-8 w-8"
            disabled={onlineComingSoon}
            title={onlineComingSoon ? "Coming soon" : onlineLabel}
            onClick={openModal}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        )}
        {quoteEnabled &&
          quoteButton("icon", "secondary", "h-8 w-8", (
            <MessageCircle className="h-4 w-4" />
          ))}

        {modal}
      </div>
    );
  }

  // Variante para cards (botones pequeños)
  if (variant === "card") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {onlineEnabled && (
          <Button
            size="sm"
            variant="default"
            className="flex-1 text-xs"
            disabled={onlineComingSoon}
            onClick={openModal}
          >
            <span className="flex items-center gap-1">
              <ShoppingCart className="h-3 w-3" />
              {onlineComingSoon ? "Coming soon" : onlineLabel}
            </span>
          </Button>
        )}
        {quoteEnabled &&
          quoteButton("sm", "outline", "flex-1 text-xs", (
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {quoteLabel}
            </span>
          ))}

        {modal}
      </div>
    );
  }

  // Variante default (botones completos)
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {onlineEnabled && (
        <Button variant="default" disabled={onlineComingSoon} onClick={openModal}>
          <span className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {onlineComingSoon ? "Coming soon" : onlineLabel}
          </span>
        </Button>
      )}
      {quoteEnabled &&
        quoteButton(undefined, "outline", undefined, (
          <span className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {quoteLabel}
          </span>
        ))}

      {modal}
    </div>
  );
}

export default DualCTA;
