import { Button } from "@/components/ui/button";
import { ShoppingCart, MessageCircle } from "lucide-react";
import Link from "next/link";

/**
 * DualCTA - Componente reutilizable para doble llamada a la acción
 *
 * Regla de negocio HU-003: Todos los productos/servicios deben tener:
 * - Comprar online
 * - Cotizar con asesor
 */
export function DualCTA({
  // Configuración de compra online
  onlineEnabled = true,
  onlinePath = "#",
  onlineLabel = "Comprar",
  onlineComingSoon = false,

  // Configuración de cotización WhatsApp
  quoteEnabled = true,
  quoteMessage = "Hola, estoy interesado en cotizar este servicio.",
  quoteLabel = "Cotizar",

  // Estilo
  variant = "default", // "default" | "compact" | "card"
  className = "",
}) {
  const whatsappNumber = "584264034052";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(quoteMessage)}`;

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
            asChild
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            title={quoteLabel}
          >
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
            </a>
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
          <Button asChild size="sm" variant="outline" className="flex-1 text-xs">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              <MessageCircle className="h-3 w-3" />
              {quoteLabel}
            </a>
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
        <Button asChild variant="outline">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            {quoteLabel}
          </a>
        </Button>
      )}
    </div>
  );
}

export default DualCTA;
