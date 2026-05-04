"use client";

import { Bot, User } from "lucide-react";
import { SourceBadge } from "./SourceBadge";

/**
 * Renderiza un mensaje del chat (UIMessage AI SDK 6).
 * - role: 'user' | 'assistant'
 * - parts: array de { type: 'text' | 'tool-...' , text?, output? }
 */
export function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const text = (message.parts || [])
    .filter((p) => p.type === "text")
    .map((p) => p.text || "")
    .join("");

  // Sources extraídas de tool calls a searchKb
  const sources = (message.parts || [])
    .filter((p) => p.type === "tool-searchKb" && p.state === "output-available")
    .flatMap((p) => p.output?.results || [])
    .map((r) => ({ title: r.documentTitle, source: r.source, score: r.score }));

  // Detectar tool calls visibles (booking / lead created)
  const leadCreated = (message.parts || []).some(
    (p) =>
      p.type === "tool-createLead" &&
      p.state === "output-available" &&
      p.output?.ok &&
      p.output?.leadId
  );

  return (
    <div
      className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}
      data-role={message.role}
    >
      {!isUser && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{text || (isUser ? "" : "...")}</div>
        {sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {sources.slice(0, 3).map((s, i) => (
              <SourceBadge key={i} source={s} />
            ))}
          </div>
        )}
        {leadCreated && (
          <div className="mt-2 rounded-md bg-green-100 px-2 py-1 text-xs text-green-700">
            ✓ Tus datos fueron registrados. Un asesor te contactará pronto.
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
