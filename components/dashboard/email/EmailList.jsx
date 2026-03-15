"use client";

import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

function getPreview(email) {
  if (email.body_text) return email.body_text.slice(0, 100);
  if (email.body_html) return email.body_html.replace(/<[^>]+>/g, "").slice(0, 100);
  return "";
}

function getDisplayName(email) {
  if (email.direction === "outbound") {
    const first = email.to_emails?.[0];
    return first?.name || first?.email || "Destinatario";
  }
  return email.from_name || email.from_email || "Remitente";
}

export default function EmailList({
  emails,
  selectedId,
  onSelect,
  onToggleStar,
  loading,
  folder,
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Cargando...
      </div>
    );
  }

  if (!emails?.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
        <svg className="h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">No hay correos en esta carpeta</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {emails.map((email) => {
        const isSelected = email.id === selectedId;
        const isUnread = !email.is_read;
        const hasAttachments = email.attachments?.length > 0;

        return (
          <div
            key={email.id}
            onClick={() => onSelect(email.id)}
            className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer transition ${
              isSelected
                ? "bg-[#0A1A44]/5 border-l-2 border-l-[#0A1A44]"
                : "hover:bg-gray-50"
            } ${isUnread ? "bg-blue-50/30" : ""}`}
          >
            {/* Star */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(email.id, !email.is_starred);
              }}
              className="mt-0.5 flex-shrink-0"
            >
              <svg
                className={`h-4 w-4 ${email.is_starred ? "fill-[#F2A93B] text-[#F2A93B]" : "text-gray-300 hover:text-gray-400"}`}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm truncate ${isUnread ? "font-bold text-gray-900" : "text-gray-700"}`}>
                  {folder === "sent" ? "Para: " : ""}{getDisplayName(email)}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatDistanceToNow(new Date(email.created_at), { addSuffix: true, locale: es })}
                </span>
              </div>
              <p className={`text-sm truncate ${isUnread ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                {email.subject || "(Sin asunto)"}
              </p>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {getPreview(email)}
              </p>
            </div>

            {/* Indicators */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
              {isUnread && (
                <span className="h-2 w-2 rounded-full bg-[#0A1A44]" />
              )}
              {hasAttachments && (
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
