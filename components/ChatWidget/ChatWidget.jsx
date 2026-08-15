"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Bot,
  Send,
  X,
  MessageCircleMore,
  Languages,
  Minimize2,
  Plus,
  ArrowLeft,
  List,
} from "lucide-react";
import { MessageList } from "./MessageList";
import { ConversationList } from "./ConversationList";
import { ConsentDialog } from "./ConsentDialog";

const STORAGE_LANG_KEY = "vv_chat_lang";
const STORAGE_VISITOR_KEY = "vv_chat_visitor"; // localStorage (no cookie httpOnly)

function detectBrowserLang() {
  if (typeof navigator === "undefined") return "es";
  const lang = navigator.language || "es";
  return lang.toLowerCase().startsWith("en") ? "en" : "es";
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [visitorToken, setVisitorToken] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  // Por defecto inglés: el sitio es monolingüe EN. detectLanguage sigue
  // cambiando el idioma si el visitante escribe en español.
  const [language, setLanguage] = useState("en");
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState(null);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  // Vista actual: 'list' (sidebar de conversaciones) | 'chat' (thread activo)
  const [viewMode, setViewMode] = useState("chat");
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  // Mensajes históricos rehidratados al cargar un thread existente
  const [initialMessages, setInitialMessages] = useState([]);
  const [initialKey, setInitialKey] = useState(0); // forzar remount de useChat

  // ─────────────────────────────────────────────────────────────────
  // Bootstrap: visitor + active conversation al abrir
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || bootstrapped) return;
    let cancelled = false;
    (async () => {
      try {
        const stored =
          typeof window !== "undefined" ? localStorage.getItem(STORAGE_LANG_KEY) : null;
        const lang = stored || detectBrowserLang();
        const existingToken =
          typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_VISITOR_KEY)
            : null;

        // 1. Bootstrap visitor (crea o recupera)
        const visitorRes = await fetch("/api/chatbot/visitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorToken: existingToken || null, language: lang }),
        });
        const vData = await visitorRes.json();
        if (cancelled) return;
        if (!vData.ok) {
          setError(vData.error || "No se pudo iniciar el visitor");
          return;
        }
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_VISITOR_KEY, vData.visitorToken);
        }
        setVisitorToken(vData.visitorToken);
        setLanguage(vData.preferredLanguage || lang);
        setConsentAccepted(!!vData.consentAccepted);

        // 2. Bootstrap session (devuelve conversación activa o crea nueva)
        const sessRes = await fetch("/api/chatbot/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorToken: vData.visitorToken,
            language: lang,
          }),
        });
        const sData = await sessRes.json();
        if (cancelled) return;
        if (!sData.ok) {
          setError(sData.error || "No se pudo iniciar la sesión");
          return;
        }
        setConversationId(sData.conversationId);
        setBootstrapped(true);
        setViewMode("chat");
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, bootstrapped]);

  // ─────────────────────────────────────────────────────────────────
  // Hook useChat
  // ─────────────────────────────────────────────────────────────────
  const { messages, sendMessage, status, stop, setMessages, error: chatError } =
    useChat({
      id: `chat-${initialKey}-${conversationId || "none"}`,
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: "/api/chatbot/chat",
        body: () => ({ visitorToken, conversationId, language }),
      }),
      onToolCall: ({ toolCall }) => {
        if (toolCall.toolName === "requestConsent") setConsentOpen(true);
      },
      onError: (err) => {
        console.error("[chat] error:", err);
        setError(err.message);
      },
    });

  // ─────────────────────────────────────────────────────────────────
  // Helpers de conversaciones
  // ─────────────────────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    if (!visitorToken) return;
    setConversationsLoading(true);
    try {
      const res = await fetch(
        `/api/chatbot/conversations?visitorToken=${encodeURIComponent(visitorToken)}`
      );
      const data = await res.json();
      if (data.ok) setConversations(data.conversations || []);
    } catch (e) {
      console.warn("fetchConversations", e);
    } finally {
      setConversationsLoading(false);
    }
  }, [visitorToken]);

  const openList = async () => {
    setViewMode("list");
    await fetchConversations();
  };

  const selectConversation = async (id) => {
    if (!visitorToken) return;
    setError(null);
    try {
      // Cargar mensajes históricos del thread
      const res = await fetch(
        `/api/chatbot/conversations/${id}?visitorToken=${encodeURIComponent(
          visitorToken
        )}`
      );
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "No se pudo cargar la conversación");
        return;
      }
      setConversationId(id);
      setLanguage(data.conversation?.language || language);
      setInitialMessages(data.messages || []);
      setInitialKey((k) => k + 1); // forzar remount de useChat con nuevos mensajes
      setViewMode("chat");
    } catch (e) {
      setError(e.message);
    }
  };

  const createNewConversation = async () => {
    if (!visitorToken) return;
    setError(null);
    try {
      const res = await fetch("/api/chatbot/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorToken, language }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "No se pudo crear la conversación");
        return;
      }
      setConversationId(data.conversation.id);
      setInitialMessages([]);
      setInitialKey((k) => k + 1);
      setMessages([]);
      setViewMode("chat");
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteConversation = async (id) => {
    if (!visitorToken) return;
    try {
      await fetch(
        `/api/chatbot/conversations/${id}?visitorToken=${encodeURIComponent(
          visitorToken
        )}`,
        { method: "DELETE" }
      );
      // Si borraste la conversación activa, crear una nueva
      if (id === conversationId) {
        await createNewConversation();
      }
      await fetchConversations();
    } catch (e) {
      console.warn("delete", e);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Idioma + auto-focus
  // ─────────────────────────────────────────────────────────────────
  function changeLanguage(next) {
    setLanguage(next);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_LANG_KEY, next);
  }

  useEffect(() => {
    if (!open || !bootstrapped || viewMode !== "chat") return;
    if (status === "ready" || status === "idle") {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open, bootstrapped, status, viewMode]);

  // ─────────────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────────────
  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !bootstrapped || status === "streaming" || status === "submitted") return;
    if (trimmed.length > 2000) {
      setError(
        language === "en"
          ? "Message too long (max 2000 chars)"
          : "Mensaje muy largo (máx 2000 caracteres)"
      );
      return;
    }
    setError(null);
    sendMessage({ text: trimmed });
    setInput("");
  }

  function onConsentDecide(accepted) {
    setConsentAccepted(accepted);
    setConsentOpen(false);
    if (accepted) {
      sendMessage({
        text:
          language === "en"
            ? "I accept the data processing consent. Please proceed."
            : "Acepto el tratamiento de datos. Procede por favor.",
      });
    } else {
      sendMessage({
        text:
          language === "en"
            ? "I prefer not to share my data right now. Please continue helping me without saving anything."
            : "Prefiero no compartir mis datos ahora. Por favor sigue ayudándome sin guardar nada.",
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
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
          className="fixed bottom-6 right-6 z-40 flex w-[calc(100vw-3rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          style={{ height: "min(640px, calc(100vh - 3rem))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-primary px-3 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              {viewMode === "list" ? (
                <button
                  onClick={() => setViewMode("chat")}
                  aria-label={language === "en" ? "Back to chat" : "Volver al chat"}
                  className="rounded-md p-1.5 hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                  <Bot className="h-5 w-5" />
                </div>
              )}
              <div className="leading-tight">
                <div className="font-semibold">
                  {viewMode === "list"
                    ? language === "en"
                      ? "Conversations"
                      : "Conversaciones"
                    : "Vale"}
                </div>
                <div className="text-xs opacity-80">
                  {viewMode === "list"
                    ? language === "en"
                      ? "All your chats"
                      : "Todos tus chats"
                    : language === "en"
                    ? "Your travel friend"
                    : "Tu amigo viajero"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {viewMode === "chat" && (
                <>
                  <button
                    onClick={openList}
                    title={
                      language === "en" ? "All conversations" : "Mis conversaciones"
                    }
                    className="rounded-md p-1.5 hover:bg-white/10"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={createNewConversation}
                    title={
                      language === "en" ? "New conversation" : "Nueva conversación"
                    }
                    className="rounded-md p-1.5 hover:bg-white/10"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </>
              )}
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
            {bootstrapped && viewMode === "list" && (
              <ConversationList
                conversations={conversations}
                loading={conversationsLoading}
                language={language}
                onSelect={selectConversation}
                onCreate={async () => {
                  await createNewConversation();
                }}
                onDelete={deleteConversation}
                activeId={conversationId}
              />
            )}
            {bootstrapped && viewMode === "chat" && (
              <MessageList messages={messages} status={status} language={language} />
            )}
          </div>

          {/* Error inline */}
          {(error || chatError) && (
            <div className="border-t border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error || chatError?.message}
            </div>
          )}

          {/* Input — solo en vista chat */}
          {viewMode === "chat" && (
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
          )}
        </div>
      )}

      {/* Consent dialog */}
      <ConsentDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        language={language}
        visitorToken={visitorToken}
        onDecide={onConsentDecide}
      />
    </>
  );
}
