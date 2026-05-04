"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Bot,
  Send,
  X,
  MessageCircleMore,
  Languages,
  Minimize2,
  RefreshCw,
} from "lucide-react";
import { MessageList } from "./MessageList";
import { ConsentDialog } from "./ConsentDialog";

const STORAGE_LANG_KEY = "vv_chat_lang";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [language, setLanguage] = useState("es");
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState(null);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  // Bootstrap session al abrir por primera vez
  useEffect(() => {
    if (!open || bootstrapped) return;
    let cancelled = false;
    (async () => {
      try {
        const stored =
          typeof window !== "undefined" ? localStorage.getItem(STORAGE_LANG_KEY) : null;
        const lang = stored || detectBrowserLang();
        const res = await fetch("/api/chatbot/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: lang }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) {
          setError(data.error || "No se pudo iniciar la sesión");
          return;
        }
        setConversationId(data.conversationId);
        setLanguage(data.language || lang);
        setConsentAccepted(!!data.consentAccepted);
        setBootstrapped(true);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, bootstrapped]);

  // useChat de AI SDK 6
  const { messages, sendMessage, status, stop, error: chatError } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chatbot/chat",
      body: () => ({ language }),
    }),
    onToolCall: ({ toolCall }) => {
      // Si el agente llama a requestConsent, abrimos el dialog
      if (toolCall.toolName === "requestConsent") {
        setConsentOpen(true);
      }
    },
    onError: (err) => {
      console.error("[chat] error:", err);
      setError(err.message);
    },
  });

  function changeLanguage(next) {
    setLanguage(next);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_LANG_KEY, next);
  }

  // Auto-focus el input cuando el widget abre y cuando termina cada turno.
  // Antes el cursor se perdía después de cada respuesta y había que hacer
  // click manualmente. Esto re-enfoca cuando status vuelve a "ready".
  useEffect(() => {
    if (!open || !bootstrapped) return;
    if (status === "ready" || status === "idle") {
      // pequeño delay para esperar el render del último mensaje
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open, bootstrapped, status]);

  // Reiniciar conversación: borra cookie de sesión y recarga el widget
  // como cliente nuevo (sin contact_captured residual).
  async function resetConversation() {
    try {
      await fetch("/api/chatbot/session", {
        method: "DELETE",
      }).catch(() => {});
    } catch {}
    // Limpieza local
    setBootstrapped(false);
    setConversationId(null);
    setConsentAccepted(false);
    setError(null);
    setInput("");
    // El cookie httpOnly se borra mediante DELETE en el endpoint;
    // el siguiente bootstrap creará nueva session.
  }

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !bootstrapped || status === "streaming" || status === "submitted") return;
    if (trimmed.length > 2000) {
      setError(language === "en" ? "Message too long (max 2000 chars)" : "Mensaje muy largo (máx 2000 caracteres)");
      return;
    }
    setError(null);
    sendMessage({ text: trimmed });
    setInput("");
  }

  function onConsentDecide(accepted) {
    setConsentAccepted(accepted);
    setConsentOpen(false);
    // Re-enviar mensaje al agente para que continúe con createLead si aceptó
    if (accepted) {
      sendMessage({
        text: language === "en"
          ? "I accept the data processing consent. Please proceed."
          : "Acepto el tratamiento de datos. Procede por favor.",
      });
    } else {
      sendMessage({
        text: language === "en"
          ? "I prefer not to share my data right now. Please continue helping me without saving anything."
          : "Prefiero no compartir mis datos ahora. Por favor sigue ayudándome sin guardar nada.",
      });
    }
  }

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={language === "en" ? "Open chat" : "Abrir chat"}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <MessageCircleMore className="h-7 w-7" />
        </button>
      )}

      {/* Panel del chat */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-40 flex w-[calc(100vw-3rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:bottom-6 sm:right-6"
          style={{ height: "min(640px, calc(100vh - 3rem))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <Bot className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <div className="font-semibold">Vale</div>
                <div className="text-xs opacity-80">
                  {language === "en" ? "Your travel friend" : "Tu amigo viajero"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (
                    confirm(
                      language === "en"
                        ? "Start a new conversation? Your current chat will be cleared."
                        : "¿Empezar una nueva conversación? Se limpiará el chat actual."
                    )
                  ) {
                    resetConversation();
                  }
                }}
                title={language === "es" ? "Nueva conversación" : "New conversation"}
                className="rounded-md p-1.5 hover:bg-white/10"
                aria-label={language === "en" ? "New conversation" : "Nueva conversación"}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={() => changeLanguage(language === "es" ? "en" : "es")}
                title={language === "es" ? "Switch to English" : "Cambiar a español"}
                className="rounded-md p-1.5 hover:bg-white/10"
                aria-label="Toggle language"
              >
                <Languages className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 hover:bg-white/10"
                aria-label={language === "en" ? "Minimize" : "Minimizar"}
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto bg-background">
            {!bootstrapped && !error && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {language === "en" ? "Connecting..." : "Conectando..."}
              </div>
            )}
            {bootstrapped && (
              <MessageList messages={messages} status={status} language={language} />
            )}
          </div>

          {/* Error inline */}
          {(error || chatError) && (
            <div className="border-t border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error || chatError?.message}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex gap-2 border-t border-border bg-background p-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!bootstrapped || status === "streaming"}
              placeholder={
                language === "en" ? "Type your message..." : "Escribe tu mensaje..."
              }
              className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary disabled:opacity-50"
              maxLength={2000}
            />
            {status === "streaming" ? (
              <button
                type="button"
                onClick={stop}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                aria-label={language === "en" ? "Stop" : "Detener"}
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || !bootstrapped}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={language === "en" ? "Send" : "Enviar"}
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>
      )}

      {/* Consent dialog */}
      <ConsentDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        language={language}
        onDecide={onConsentDecide}
      />
    </>
  );
}

function detectBrowserLang() {
  if (typeof navigator === "undefined") return "es";
  const lang = navigator.language || "es";
  return lang.toLowerCase().startsWith("en") ? "en" : "es";
}
