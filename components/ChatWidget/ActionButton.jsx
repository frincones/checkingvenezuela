"use client";

import { ExternalLink, MessageCircle } from "lucide-react";

/**
 * Botón de acción rápida que aparece dentro de un mensaje del bot.
 * Por ahora soporta acción 'open_whatsapp'.
 */
export function ActionButton({ output, language = "en" }) {
  if (!output || !output.ok) return null;

  if (output.action === "open_whatsapp" && output.url) {
    const label =
      language === "en"
        ? output.labelEn || "💬 Talk to advisor on WhatsApp"
        : output.label || "💬 Hablar con asesor por WhatsApp";
    return (
      <a
        href={output.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#128C7E] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-1"
      >
        <MessageCircle className="h-4 w-4" />
        <span>{label}</span>
        <ExternalLink className="h-3 w-3 opacity-70" />
      </a>
    );
  }

  return null;
}
