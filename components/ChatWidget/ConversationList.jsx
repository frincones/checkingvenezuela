"use client";

import { MessageSquare, Plus, Trash2, CheckCircle2 } from "lucide-react";

const TXT = {
  es: {
    empty: "No tienes conversaciones aún. Inicia una nueva.",
    new: "Nueva conversación",
    today: "Hoy",
    yesterday: "Ayer",
    delete: "Borrar conversación",
    confirmDelete: "¿Borrar esta conversación?",
    untitled: "Sin título",
    leadCreated: "Lead enviado",
  },
  en: {
    empty: "No conversations yet. Start a new one.",
    new: "New conversation",
    today: "Today",
    yesterday: "Yesterday",
    delete: "Delete conversation",
    confirmDelete: "Delete this conversation?",
    untitled: "Untitled",
    leadCreated: "Lead submitted",
  },
};

function formatTime(ts, language) {
  if (!ts) return "";
  const t = TXT[language] || TXT.es;
  const d = new Date(ts);
  const now = new Date();
  const diffH = (now - d) / 1000 / 60 / 60;
  const time = d.toTimeString().slice(0, 5);
  if (diffH < 24) return `${t.today} ${time}`;
  if (diffH < 48) return `${t.yesterday} ${time}`;
  return d.toLocaleDateString(language === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "short",
  });
}

export function ConversationList({
  conversations,
  loading,
  language = "es",
  onSelect,
  onCreate,
  onDelete,
  activeId,
}) {
  const t = TXT[language] || TXT.es;
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border p-2">
        <button
          onClick={onCreate}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t.new}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            …
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-6 w-6 opacity-40" />
            <p>{t.empty}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {conversations.map((c) => (
              <li key={c.id}>
                <div
                  className={`group flex items-center gap-2 px-3 py-2 hover:bg-muted/50 ${
                    activeId === c.id ? "bg-muted" : ""
                  }`}
                >
                  <button
                    onClick={() => onSelect(c.id)}
                    className="flex flex-1 items-start gap-2 text-left"
                  >
                    <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                        <span className="truncate">{c.title || t.untitled}</span>
                        {c.hasLead && (
                          <CheckCircle2
                            className="h-3.5 w-3.5 flex-shrink-0 text-green-600"
                            aria-label={t.leadCreated}
                          />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(c.lastMessageAt, language)} · {c.messageCount}{" "}
                        msg
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t.confirmDelete)) onDelete(c.id);
                    }}
                    aria-label={t.delete}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
