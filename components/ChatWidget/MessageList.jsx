"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";

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

  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {status === "submitted" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></span>
          <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></span>
          <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-primary"></span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
