"use client";

import { useEffect, useRef } from "react";
import { Bot, Search } from "lucide-react";
import { MessageBubble } from "./MessageBubble";

const TOOL_LABELS = {
  searchKb: { es: "Consultando documentos…", en: "Looking up documents…" },
  searchDestinations: { es: "Buscando destinos…", en: "Searching destinations…" },
  searchPackages: { es: "Buscando paquetes…", en: "Searching packages…" },
  searchHotels: { es: "Buscando hoteles…", en: "Searching hotels…" },
  searchFlights: { es: "Buscando vuelos…", en: "Searching flights…" },
  captureContactInfo: { es: "Guardando tus datos…", en: "Saving your info…" },
  requestConsent: { es: "Preparando autorización…", en: "Preparing consent…" },
  createLead: { es: "Registrando tu solicitud…", en: "Submitting your request…" },
  talkToHuman: { es: "Conectando con un asesor…", en: "Connecting to advisor…" },
};

function getActiveToolLabel(messages, language) {
  if (messages.length === 0) return null;
  const last = messages[messages.length - 1];
  if (last.role !== "assistant" || !Array.isArray(last.parts)) return null;

  // Tool en ejecución: input completo pero sin output aún
  const activeTool = last.parts.find(
    (p) =>
      p.type?.startsWith("tool-") &&
      (p.state === "input-streaming" ||
        p.state === "input-available" ||
        p.state === "output-streaming")
  );
  if (!activeTool) return null;
  // Mostramos el indicador SIEMPRE que haya tool corriendo, incluso si ya
  // hay texto previo — el delay del tool puede ser >1s y el usuario debe
  // saber que algo está pasando, no creer que el bot se trabó.
  const toolName = activeTool.type.replace(/^tool-/, "");
  const label = TOOL_LABELS[toolName];
  return label ? label[language] || label.es : null;
}

export function MessageList({ messages, status, language }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
        <div className="text-2xl">🌴</div>
        <p className="text-sm">
          {language === "en"
            ? "Hi! I'm Vale, your travel friend. Ask me anything about destinations, packages, flights or our policies."
            : "¡Hola! Soy Vale, tu amigo viajero. Pregúntame sobre destinos, paquetes, vuelos o nuestras políticas."}
        </p>
      </div>
    );
  }

  const toolLabel = getActiveToolLabel(messages, language);
  const showTyping = status === "submitted" || (status === "streaming" && toolLabel);

  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} language={language} />
      ))}

      {/* Indicador de tool en ejecución (durante streaming) */}
      {toolLabel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Search className="h-3.5 w-3.5 animate-pulse" />
          </div>
          <span className="italic">{toolLabel}</span>
        </div>
      )}

      {/* Indicador clásico de "pensando" (sin texto aún, sin tool aún) */}
      {showTyping && !toolLabel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></span>
          <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></span>
          <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-primary"></span>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
