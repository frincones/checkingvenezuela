"use client";

import { useState, useCallback } from "react";

const WHATSAPP_NUMBER = "584264034052";

/**
 * Hook for lead capture flow.
 *
 * Usage:
 *   const { modalOpen, setModalOpen, trackingData, requestCapture } = useLeadCapture();
 *
 *   // When user clicks a CTA:
 *   requestCapture({
 *     action: "whatsapp",
 *     whatsappMessage: "Hi...",
 *     trackingData: { interest_type: "package", ... }
 *   });
 *
 *   // Render the modal:
 *   <LeadCaptureModal
 *     open={modalOpen}
 *     onOpenChange={setModalOpen}
 *     onSubmit={handleLeadSubmit}
 *     trackingData={trackingData}
 *     triggerLabel="Continuar a WhatsApp"
 *   />
 */
export function useLeadCapture() {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [trackingData, setTrackingData] = useState({});

  /**
   * Initiates the lead capture flow.
   * @param {Object} config
   * @param {string} config.action - "whatsapp" | "navigate" | "custom"
   * @param {string} [config.whatsappMessage] - Message for WhatsApp
   * @param {string} [config.navigateTo] - URL to navigate to
   * @param {Function} [config.onComplete] - Custom callback after lead capture
   * @param {Object} [config.trackingData] - Data for lead tracking
   */
  const requestCapture = useCallback((config) => {
    // Solo abre el modal y recuerda qué hacer al enviar.
    //
    // Antes ejecutaba la acción aquí mismo —abría WhatsApp nada más pulsar el
    // botón, con el formulario todavía vacío— y handleLeadSubmit la volvía a
    // ejecutar al enviar, así que se abrían dos pestañas. Pasaba inadvertido
    // porque ambas iban al mismo sitio.
    //
    // Con el canal de respuesta a elección del visitante dejaría de ser
    // inofensivo: elegir "Email" abriría WhatsApp igualmente.
    //
    // Además nunca guardaba pendingAction ni abría el modal, de modo que
    // handleLeadSubmit salía por su guarda inicial y la captura no ocurría.
    setPendingAction(config);
    setTrackingData(config.trackingData || {});
    setModalOpen(true);
  }, []);

  /**
   * Called when the modal form is submitted successfully.
   * Executes the pending action with enriched contact data.
   */
  const handleLeadSubmit = useCallback(
    (contactData) => {
      if (!pendingAction) return;

      const { action, whatsappMessage, navigateTo, onComplete } = pendingAction;

      if (action === "whatsapp") {
        // Build enriched WhatsApp message with contact info
        const enrichedMessage = buildWhatsAppMessage(
          whatsappMessage,
          contactData
        );
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(enrichedMessage)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      } else if (action === "navigate" && navigateTo) {
        window.location.href = navigateTo;
      } else if (action === "custom" && onComplete) {
        onComplete(contactData);
      }

      setPendingAction(null);
    },
    [pendingAction]
  );

  return {
    modalOpen,
    setModalOpen,
    trackingData,
    requestCapture,
    handleLeadSubmit,
  };
}

/**
 * Builds an enriched WhatsApp message that includes contact info
 */
function buildWhatsAppMessage(baseMessage, contactData) {
  const { contactName, email, phone } = contactData;
  const lines = [];

  if (baseMessage) {
    lines.push(baseMessage);
  } else {
    lines.push("Hi, I'm interested in your travel services.");
  }

  lines.push("");
  if (contactName) lines.push(`Name: ${contactName}`);
  if (email) lines.push(`Email: ${email}`);
  if (phone) lines.push(`Phone: ${phone}`);

  return lines.join("\n");
}
