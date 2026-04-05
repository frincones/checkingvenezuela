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
 *     whatsappMessage: "Hola...",
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
    const { action, whatsappMessage, navigateTo, onComplete } = config;

    if (action === "whatsapp") {
      const message = whatsappMessage || "Hola, estoy interesado en sus servicios de viajes.";
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } else if (action === "navigate" && navigateTo) {
      window.location.href = navigateTo;
    } else if (action === "custom" && onComplete) {
      onComplete({});
    }
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
    lines.push("Hola, estoy interesado en sus servicios de viajes.");
  }

  lines.push("");
  if (contactName) lines.push(`Nombre: ${contactName}`);
  if (email) lines.push(`Email: ${email}`);
  if (phone) lines.push(`Tel: ${phone}`);

  return lines.join("\n");
}
