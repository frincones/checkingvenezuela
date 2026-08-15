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
      whatsappMessage: `Hi! I'm interested in the "${packageName}" package. I'd like more information and a quote.`,
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
        Book {packageName}
      </Button>

      <LeadCaptureModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleLeadSubmit}
        trackingData={trackingData}
        triggerLabel="Continue to WhatsApp"
      />
    </>
  );
}
