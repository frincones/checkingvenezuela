"use client";

import { useState } from "react";
import { BookingRequestModal } from "@/components/ui/BookingRequestModal";

export function FooterWhatsAppLink() {
  // Igual que el cintillo: sin producto asociado.
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[0.875rem] hover:text-accent inline font-medium text-white/70 transition-colors text-left"
      >
        WhatsApp
      </button>

      <BookingRequestModal
        open={open}
        onOpenChange={setOpen}
        origin="footer"
        whatsappMessage="Hi, I'm interested in your travel services."
      />
    </>
  );
}
