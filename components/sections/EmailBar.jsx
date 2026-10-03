"use client";

/**
 * Cintillo azul de correo, bajo el naranja de WhatsApp.
 *
 * Existe porque el equipo comercial observa que parte de la audiencia
 * internacional no usa WhatsApp, y hasta ahora el sitio no ofrecía otra vía
 * visible desde la cabecera.
 *
 * Abre el mismo modal que el resto de puntos de contacto, en vez de un enlace
 * mailto: directo. Un mailto depende de que el visitante tenga configurado un
 * cliente de correo —en escritorio a menudo no lo está, y el clic no hace
 * nada— y además no deja lead ni envía copia al cliente.
 *
 * El enlace a un asesor por correo sigue disponible dentro del modal, para
 * quien prefiera escribir directamente.
 *
 * Montado desde app/layout.js: un fallo aquí se ve en todo el sitio.
 */

import { useState } from "react";
import { BookingRequestModal } from "@/components/ui/BookingRequestModal";

const TEXT = "PREFER EMAIL? WRITE TO US AND WE WILL REPLY WITHIN 24 HOURS";

export function EmailBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send us an email about your trip"
        className="block w-full bg-blue-700 px-4 py-2 text-center text-xs font-semibold tracking-wide text-white transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300 sm:text-sm"
      >
        {TEXT}
      </button>

      <BookingRequestModal
        open={open}
        onOpenChange={setOpen}
        origin="email_bar"
        whatsappMessage="Hi, I'd like to know more about your travel experiences."
      />
    </>
  );
}

export default EmailBar;
