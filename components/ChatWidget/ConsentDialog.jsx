"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const TEXT = {
  es: {
    title: "Autorización de tratamiento de datos",
    body: `Para que un asesor de Venezuela Voyages pueda contactarte, necesitamos guardar tu nombre, email y teléfono.
Tus datos serán usados ÚNICAMENTE para gestionar tu solicitud de viaje y enviarte información relacionada.
Puedes solicitar la eliminación de tus datos en cualquier momento escribiendo a privacidad@venezuelavoyages.com.`,
    accept: "Acepto y deseo ser contactado",
    decline: "No, gracias",
  },
  en: {
    title: "Personal data processing consent",
    body: `For a Venezuela Voyages advisor to contact you, we need to store your name, email and phone.
Your data will be used ONLY to handle your travel request and send you related information.
You can request deletion of your data at any time by writing to privacy@venezuelavoyages.com.`,
    accept: "I accept and want to be contacted",
    decline: "No, thanks",
  },
};

export function ConsentDialog({
  open,
  onOpenChange,
  language = "en",
  visitorToken,
  onDecide,
}) {
  const t = TEXT[language] || TEXT.es;

  async function decide(accepted) {
    try {
      await fetch("/api/chatbot/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted, visitorToken }),
      });
    } catch (e) {
      console.error("[ConsentDialog]", e);
    } finally {
      onDecide?.(accepted);
      onOpenChange?.(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line text-sm">
            {t.body}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => decide(false)}>
            {t.decline}
          </Button>
          <Button onClick={() => decide(true)}>{t.accept}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
