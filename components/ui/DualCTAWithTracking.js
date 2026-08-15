"use client";

/**
 * DualCTAWithTracking - Componente DualCTA con captura de leads via modal
 *
 * Ahora delega a DualCTA que maneja la captura de leads nativamente.
 * Mantiene la misma API para backwards compatibility.
 *
 * HU-003 + CRM: Dual CTA con captura de leads
 */

import { DualCTA } from "@/components/ui/DualCTA";

export function DualCTAWithTracking({
  onlineEnabled = true,
  onlinePath = "#",
  onlineLabel = "Book now",
  onlineComingSoon = false,
  quoteEnabled = true,
  quoteMessage = "Hi, I'm interested in getting a quote for this service.",
  quoteLabel = "Get a quote",
  trackingData = null,
  variant = "default",
  className = "",
}) {
  return (
    <DualCTA
      onlineEnabled={onlineEnabled}
      onlinePath={onlinePath}
      onlineLabel={onlineLabel}
      onlineComingSoon={onlineComingSoon}
      quoteEnabled={quoteEnabled}
      quoteMessage={quoteMessage}
      quoteLabel={quoteLabel}
      trackingData={trackingData}
      variant={variant}
      className={className}
    />
  );
}

export default DualCTAWithTracking;
