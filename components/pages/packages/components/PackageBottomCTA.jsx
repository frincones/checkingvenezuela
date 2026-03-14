"use client";

import { Button } from "@/components/ui/button";
import { useLeadCapture } from "@/hooks/useLeadCapture";
import { LeadCaptureModal } from "@/components/ui/LeadCaptureModal";

export function PackageBottomCTA({ packageName, displayPrice }) {
  const { modalOpen, setModalOpen, trackingData, requestCapture, handleLeadSubmit } =
    useLeadCapture();

  function handleClick() {
    requestCapture({
      action: "whatsapp",
      whatsappMessage: `Hola! Estoy interesado en el paquete "${packageName}". Me gustaría recibir más información y cotización.`,
      trackingData: {
        source: "web_form",
        interest_type: "package",
        interest_details: {
          package_name: packageName,
          price: displayPrice,
          origin: "bottom_cta",
        },
      },
    });
  }

  return (
    <>
      <Button size="lg" className="min-w-[200px]" onClick={handleClick}>
        Reservar {packageName}
      </Button>

      <LeadCaptureModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleLeadSubmit}
        trackingData={trackingData}
        triggerLabel="Continuar a WhatsApp"
      />
    </>
  );
}
