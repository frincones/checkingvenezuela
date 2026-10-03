"use client";

/**
 * Global announcement bar ("cintillo") rendered above the navbar on every
 * page. Orange background, white text; opens the booking request modal.
 *
 * Mounted from app/layout.js, so a failure here shows on the whole site.
 * It passes no product: the modal renders its generic variant.
 */

import { useState } from "react";
import { BookingRequestModal } from "@/components/ui/BookingRequestModal";

const ANNOUNCEMENT_TEXT = "BOOK NOW VIA OUR WHATSAPP, WE ARE AVAILABLE 24/7";
const WHATSAPP_PREFILLED =
  "Hi, I'd like to book a signature travel experience in Venezuela.";

export function AnnouncementBar() {
  // Sin producto: el cintillo es contacto genérico. El modal lo detecta por la
  // ausencia de productName y oculta cabecera de precio y bloque de viaje.
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Request a signature travel experience"
        className="block w-full bg-orange-500 px-4 py-2 text-center text-xs font-semibold tracking-wide text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300 sm:text-sm"
      >
        {ANNOUNCEMENT_TEXT}
      </button>

      <BookingRequestModal
        open={open}
        onOpenChange={setOpen}
        origin="announcement_bar"
        whatsappMessage={WHATSAPP_PREFILLED}
      />
    </>
  );
}
