"use client";

import { MessageCircle } from "lucide-react";
import { useLeadCapture } from "@/hooks/useLeadCapture";
import { LeadCaptureModal } from "@/components/ui/LeadCaptureModal";

export function WhatsAppButton() {
  const { modalOpen, setModalOpen, trackingData, requestCapture, handleLeadSubmit } =
    useLeadCapture();

  function handleClick(e) {
    e.preventDefault();
    requestCapture({
      action: "whatsapp",
      whatsappMessage: "Hi, I'm interested in your travel services.",
      trackingData: {
        source: "whatsapp",
        interest_type: "other",
        interest_details: { origin: "floating_button" },
      },
    });
  }

  return (
    <>
      <button
        onClick={handleClick}
        aria-label="Contact us on WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all duration-300 hover:scale-110 hover:bg-[#128C7E] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2"
      >
        <MessageCircle className="h-7 w-7" />
        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
          1
        </span>
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
