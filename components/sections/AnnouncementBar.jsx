"use client";

/**
 * Global announcement bar ("cintillo") rendered above the navbar in every
 * page. Orange background, white text, click-through to WhatsApp via the
 * existing lead-capture flow (same modal + tracking as the floating
 * WhatsApp button — see components/WhatsAppButton.js and hooks/useLeadCapture).
 *
 * Mounted from app/layout.js so it appears site-wide.
 */

import { useLeadCapture } from "@/hooks/useLeadCapture";
import { LeadCaptureModal } from "@/components/ui/LeadCaptureModal";

const ANNOUNCEMENT_TEXT = "BOOK NOW VIA OUR WHATSAPP, WE ARE AVAILABLE 24/7";
const WHATSAPP_PREFILLED =
  "Hi, I'd like to book a signature travel experience in Venezuela.";

export function AnnouncementBar() {
  const { modalOpen, setModalOpen, trackingData, requestCapture, handleLeadSubmit } =
    useLeadCapture();

  function handleClick(e) {
    e.preventDefault();
    requestCapture({
      action: "whatsapp",
      whatsappMessage: WHATSAPP_PREFILLED,
      trackingData: {
        source: "whatsapp",
        interest_type: "other",
        interest_details: { origin: "announcement_bar" },
      },
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Open WhatsApp to book a signature travel experience"
        className="block w-full bg-orange-500 px-4 py-2 text-center text-xs font-semibold tracking-wide text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300 sm:text-sm"
      >
        {ANNOUNCEMENT_TEXT}
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
