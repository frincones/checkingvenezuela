"use client";

import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SourceBadge } from "./SourceBadge";
import { ActionButton } from "./ActionButton";

/**
 * Renderiza un mensaje del chat (UIMessage AI SDK 6) con markdown + botones de acción.
 */
export function MessageBubble({ message, language = "es" }) {
  const isUser = message.role === "user";
  const text = (message.parts || [])
    .filter((p) => p.type === "text")
    .map((p) => p.text || "")
    .join("");

  const sources = (message.parts || [])
    .filter((p) => p.type === "tool-searchKb" && p.state === "output-available")
    .flatMap((p) => p.output?.results || [])
    .map((r) => ({ title: r.documentTitle, source: r.source, score: r.score }));

  const leadCreated = (message.parts || []).some(
    (p) =>
      p.type === "tool-createLead" &&
      p.state === "output-available" &&
      p.output?.ok &&
      p.output?.leadId
  );

  // Acciones rápidas (botones) generadas por tools como talkToHuman
  const actionOutputs = (message.parts || [])
    .filter(
      (p) =>
        p.type === "tool-talkToHuman" &&
        p.state === "output-available" &&
        p.output?.action
    )
    .map((p) => p.output);

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
