"use client";

import { useState } from "react";
import DOMPurify from "dompurify";

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString("es-VE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EmailView({ email, onReply, onForward, onDelete, onArchive, onBack }) {
  const [showFullHeaders, setShowFullHeaders] = useState(false);

  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 p-8">
        <div className="text-center">
          <svg className="h-16 w-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">Selecciona un correo para ver su contenido</p>
        </div>
      </div>
    );
  }

  const toList = (email.to_emails || []).map((t) => t.name || t.email).join(", ");
  const ccList = (email.cc || []).filter(Boolean).join(", ");
  const sanitizedHtml = email.body_html
    ? DOMPurify.sanitize(email.body_html, { ADD_ATTR: ["target"] })
    : null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded hover:bg-gray-100 text-gray-500"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1" />

        <button
          onClick={() => onReply(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 text-gray-600"
          title="Responder"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Responder
        </button>

        <button
          onClick={() => onReply(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 text-gray-600"
          title="Responder a todos"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Todos
        </button>

        <button
          onClick={onForward}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 text-gray-600"
          title="Reenviar"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
          Reenviar
        </button>

        <div className="w-px h-5 bg-gray-200" />

        <button
          onClick={onArchive}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          title="Archivar"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </button>

        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-500"
          title="Eliminar"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Email content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Subject */}
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {email.subject || "(Sin asunto)"}
          </h2>

          {/* Headers */}
          <div className="flex items-start gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-[#0A1A44] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {(email.from_name || email.from_email || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-gray-900">
                  {email.from_name || email.from_email}
                </span>
                <span className="text-xs text-gray-400">
                  &lt;{email.from_email}&gt;
                </span>
              </div>
              <button
                onClick={() => setShowFullHeaders(!showFullHeaders)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Para: {toList}
                {showFullHeaders ? " ▲" : " ▼"}
              </button>
              {showFullHeaders && ccList && (
                <p className="text-xs text-gray-400">CC: {ccList}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDate(email.created_at)}
              </p>
            </div>

            {/* Status badge */}
            {email.status && email.direction === "outbound" && (
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                email.status === "delivered" ? "bg-green-100 text-green-700" :
                email.status === "opened" ? "bg-blue-100 text-blue-700" :
                email.status === "bounced" ? "bg-red-100 text-red-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {email.status === "delivered" ? "Entregado" :
                 email.status === "opened" ? "Leído" :
                 email.status === "bounced" ? "Rebotado" :
                 email.status === "sent" ? "Enviado" : email.status}
              </span>
            )}
          </div>

          {/* Body */}
          <div className="border rounded-lg bg-white p-6">
            {sanitizedHtml ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                {email.body_text || "(Sin contenido)"}
              </pre>
            )}
          </div>

          {/* Attachments */}
          {email.attachments?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Adjuntos ({email.attachments.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {email.attachments.map((att, i) => {
                  // New attachments (post fix/email-attachments-storage) have
                  // storage_path → download via our proxy route that issues a
                  // signed URL. Legacy rows still have only `url` pointing to
                  // cdn.resend.app which is auth-only and unreachable from the
                  // browser — show them as disabled with a hint.
                  const isAvailable = !!att.storage_path;
                  const href = isAvailable
                    ? `/api/email/${email.id}/attachments/${i}`
                    : undefined;
                  const Tag = isAvailable ? "a" : "span";
                  const tagProps = isAvailable
                    ? {
                        href,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        className:
                          "flex items-center gap-2 border rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition",
                        title: att.filename,
                      }
                    : {
                        className:
                          "flex items-center gap-2 border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed",
                        title:
                          att.ingest_error ||
                          "Adjunto recibido antes de la migración de almacenamiento — no disponible para descarga.",
                        "aria-disabled": true,
                      };
                  return (
                    <Tag key={i} {...tagProps}>
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className={isAvailable ? "text-gray-700" : "text-gray-400"}>
                        {att.filename}
                      </span>
                      {att.size && (
                        <span className="text-xs text-gray-400">
                          ({(att.size / 1024).toFixed(0)} KB)
                        </span>
                      )}
                    </Tag>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
