"use client";

import { useLeadCapture } from "@/hooks/useLeadCapture";
import { LeadCaptureModal } from "@/components/ui/LeadCaptureModal";

export function FooterWhatsAppLink() {
  const { modalOpen, setModalOpen, trackingData, requestCapture, handleLeadSubmit } =
    useLeadCapture();

  function handleClick(e) {
    e.preventDefault();
    requestCapture({
      action: "whatsapp",
      whatsappMessage: "Hi, I'm interested in your travel services.",
      trackingData: {
        source: "web_form",
        interest_type: "other",
        interest_details: { origin: "footer" },
      },
    });
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="text-[0.875rem] hover:text-accent inline font-medium text-white/70 transition-colors text-left"
      >
        WhatsApp
      </button>

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
