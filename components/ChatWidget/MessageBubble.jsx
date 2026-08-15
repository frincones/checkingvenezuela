"use client";

import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SourceBadge } from "./SourceBadge";
import { ActionButton } from "./ActionButton";

/**
 * Renderiza un mensaje del chat (UIMessage AI SDK 6) con markdown + botones de acción.
 */
export function MessageBubble({ message, language = "en" }) {
  const isUser = message.role === "user";
  const text = (message.parts || [])
    .filter((p) => p.type === "text")
    .map((p) => p.text || "")
    .join("");

  // Sources solo de searchKb (no de búsquedas de catálogo). Deduplicamos
  // por documento y mostramos máx 3 con la relevancia más alta.
  const sources = dedupeSources(
    (message.parts || [])
      .filter((p) => p.type === "tool-searchKb" && p.state === "output-available")
      .flatMap((p) => p.output?.results || [])
      .map((r) => ({
        title: r.documentTitle || r.source || "Documento",
        sourceType: r.sourceType,
        score: r.score,
      }))
  ).slice(0, 3);

  const leadCreated = (message.parts || []).some(
    (p) =>
      p.type === "tool-createLead" &&
      p.state === "output-available" &&
      p.output?.ok &&
      p.output?.leadId
  );

  // Acciones rápidas (botones) generadas por tools como talkToHuman.
  // Filter permisivo: cualquier parte de tipo tool-* o dynamic-tool con
  // un output que tenga action (independiente del state name exacto).
  const actionOutputs = (message.parts || [])
    .filter((p) => {
      const isToolPart =
        (typeof p.type === "string" && p.type.startsWith("tool-")) ||
        p.type === "dynamic-tool" ||
        p.type === "tool-result";
      const out = p.output || p.result || null;
      return isToolPart && out && (out.action === "open_whatsapp" || out.url);
    })
    .map((p) => p.output || p.result);

  // Debug: en desarrollo, exponer las parts en window.__lastChatParts
  if (
    typeof window !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    !isUser
  ) {
    window.__lastChatParts = message.parts;
  }

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
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{text}</div>
        ) : text ? (
          <div className="prose prose-sm prose-neutral max-w-none break-words [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-muted-foreground">…</div>
        )}

        {sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {sources.slice(0, 3).map((s, i) => (
              <SourceBadge key={i} source={s} />
            ))}
          </div>
        )}
        {actionOutputs.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {actionOutputs.map((output, i) => (
              <ActionButton key={i} output={output} language={language} />
            ))}
          </div>
        )}
        {leadCreated && (
          <div className="mt-2 rounded-md bg-green-100 px-2 py-1 text-xs text-green-700">
            {language === "es"
              ? "✓ Tus datos fueron registrados. Un asesor te contactará pronto."
              : "✓ Your details were saved. An advisor will contact you shortly."}
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

/**
 * Deduplica sources por título (case-insensitive), conservando la mayor
 * relevancia.
 */
function dedupeSources(arr) {
  const map = new Map();
  for (const s of arr) {
    const key = (s.title || "").toLowerCase().trim();
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || (s.score ?? 0) > (existing.score ?? 0)) {
      map.set(key, s);
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
