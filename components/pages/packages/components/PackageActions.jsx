"use client";

import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { useLeadCapture } from "@/hooks/useLeadCapture";
import { LeadCaptureModal } from "@/components/ui/LeadCaptureModal";

export function PackageActions({ packageName, whatsappMessage, shareUrl, displayPrice }) {
  const [copied, setCopied] = useState(false);
  const { modalOpen, setModalOpen, trackingData, requestCapture, handleLeadSubmit } =
    useLeadCapture();

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: packageName,
          text: `Mira este paquete turístico: ${packageName}`,
          url: shareUrl,
        });
      } catch (error) {
        console.log("Share cancelled");
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error("Failed to copy:", error);
      }
    }
  };

  function handleReserve() {
    requestCapture({
      action: "whatsapp",
      whatsappMessage:
        whatsappMessage ||
        `Hola! Estoy interesado en el paquete "${packageName}". Me gustaría recibir más información y cotización.`,
      trackingData: {
        source: "web_form",
        interest_type: "package",
        interest_details: {
          package_name: packageName,
          price: displayPrice,
        },
      },
    });
  }

  return (
    <>
      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={handleShare}
        >
          <Share2 className="mr-2 h-4 w-4" />
          {copied ? "Copiado!" : "Compartir"}
        </Button>
        <Button
          size="lg"
          className="flex-1 lg:min-w-[200px]"
          onClick={handleReserve}
        >
          Reservar Ahora
        </Button>
      </div>

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
