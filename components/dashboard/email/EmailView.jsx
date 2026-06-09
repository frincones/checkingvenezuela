"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function fileSize(bytes) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ── Body renderer with collapsible quoted text ──
 * Outlook / Gmail wrap the previous message inside a <blockquote>. We render
 * the first level inline and collapse everything from the second nested
 * blockquote downwards behind a "Mostrar historial" button, so the current
 * reply is visible at full width without competing with chained citations.
 */
function EmailBody({ html, text }) {
  const containerRef = useRef(null);
  const [showHistory, setShowHistory] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);

  // Sanitize once; keep target on links so they open in a new tab.
  const sanitized = useMemo(() => {
    if (!html) return null;
    return DOMPurify.sanitize(html, {
      ADD_ATTR: ["target"],
      FORBID_ATTR: ["style"], // strip inline styles — heavy blockquote borders from Gmail kill readability
    });
  }, [html]);

  useEffect(() => {
    if (!containerRef.current || !sanitized) return;
    const node = containerRef.current;

    // Walk top-level blockquotes. The very first one stays visible (it's the
    // immediate quoted message the user is replying to). Anything deeper or
    // any second-or-later top-level blockquote goes into history.
    const blockquotes = node.querySelectorAll("blockquote");
    let count = 0;
    blockquotes.forEach((bq) => {
      count++;
      if (count >= 2) bq.setAttribute("data-history", "1");
    });

    // Detect "On ... wrote:" / "El ... escribió:" lines that mark quoted text
    // even when not wrapped in <blockquote>. Hide siblings after the marker.
    const markerRegex = /(escribi[oó]:|wrote:|------ ?(Mensaje|Forwarded message))/i;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (markerRegex.test(n.textContent)) {
        let parent = n.parentElement;
        while (parent && parent.parentElement !== node) parent = parent.parentElement;
        if (parent) {
          let sib = parent.nextElementSibling;
          while (sib) {
            sib.setAttribute("data-history", "1");
            sib = sib.nextElementSibling;
          }
        }
        break;
      }
    }

    const hidden = node.querySelectorAll("[data-history='1']");
    setHasHistory(hidden.length > 0);
    hidden.forEach((el) => {
      el.style.display = showHistory ? "" : "none";
    });
  }, [sanitized, showHistory]);

  if (!sanitized) {
    return (
      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
        {text || "(Sin contenido)"}
      </pre>
    );
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="email-body prose prose-sm max-w-none prose-p:my-2 prose-blockquote:border-l-2 prose-blockquote:border-gray-200 prose-blockquote:pl-3 prose-blockquote:text-gray-500 prose-blockquote:not-italic prose-img:max-w-full prose-img:h-auto"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
      {hasHistory && (
        <button
          onClick={() => setShowHistory((s) => !s)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#0A1A44] border border-gray-200 rounded px-2 py-1 hover:border-gray-300 transition"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
          </svg>
          {showHistory ? "Ocultar mensajes anteriores" : "Mostrar mensajes anteriores"}
        </button>
      )}
    </div>
  );
}

/* ── Attachment chip (Outlook-style, shown above the body) ── */
function AttachmentChip({ att, href, available }) {
  const isImage = (att.content_type || "").startsWith("image/");
  const isPdf = att.content_type === "application/pdf";
  const isOffice = /\b(word|excel|powerpoint|spreadsheet|presentation|document)\b/i.test(
    att.content_type || ""
  );
  const iconColor = isImage
    ? "text-purple-500"
    : isPdf
    ? "text-red-500"
    : isOffice
    ? "text-blue-500"
    : "text-gray-500";

  const Tag = available ? "a" : "span";
  const tagProps = available
    ? {
        href,
        target: "_blank",
        rel: "noopener noreferrer",
        className:
          "group flex items-center gap-2 border border-gray-200 rounded px-3 py-2 text-sm hover:bg-gray-50 hover:border-gray-300 transition bg-white",
        title: att.filename,
      }
    : {
        className:
          "flex items-center gap-2 border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed",
        title:
          att.ingest_error ||
          "Adjunto recibido antes de la migración de almacenamiento — no disponible para descarga.",
        "aria-disabled": true,
      };

  return (
    <Tag {...tagProps}>
      <svg
        className={`h-5 w-5 flex-shrink-0 ${available ? iconColor : "text-gray-300"}`}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM18 20H6V4h7v5h5v11z" />
      </svg>
      <div className="flex flex-col min-w-0">
        <span
          className={`truncate max-w-[180px] ${
            available ? "text-gray-800 group-hover:text-[#0A1A44]" : "text-gray-400"
          }`}
        >
          {att.filename}
        </span>
        {fileSize(att.size) && (
          <span className="text-xs text-gray-400">{fileSize(att.size)}</span>
        )}
      </div>
      {available && (
        <svg
          className="h-4 w-4 text-gray-300 group-hover:text-gray-500 ml-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
        </svg>
      )}
    </Tag>
  );
}

/* ── Toolbar icons ── */
const Icon = {
  Reply: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18a2 2 0 012 2v8" />
    </svg>
  ),
  // Double arrow distinguishes Reply All from Reply
  ReplyAll: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h12a4 4 0 014 4v2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4" />
    </svg>
  ),
  Forward: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  ),
  Archive: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  ),
  Trash: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Back: () => (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  ),
};

function ToolbarButton({ onClick, label, children, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded transition ${
        danger
          ? "text-gray-500 hover:bg-red-50 hover:text-red-500"
          : "text-gray-600 hover:bg-gray-100"
      }`}
      title={label}
    >
      {children}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
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

  const toList = (email.to_emails || [])
    .map((t) => t?.name || t?.email || (typeof t === "string" ? t : ""))
    .filter(Boolean)
    .join(", ");
  const ccList = (email.cc || [])
    .map((c) => (typeof c === "string" ? c : c?.email))
    .filter(Boolean)
    .join(", ");
  const attachments = Array.isArray(email.attachments) ? email.attachments : [];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded hover:bg-gray-100 text-gray-500"
        >
          <Icon.Back />
        </button>

        <ToolbarButton onClick={() => onReply(false)} label="Responder">
          <Icon.Reply />
        </ToolbarButton>
        <ToolbarButton onClick={() => onReply(true)} label="Responder a todos">
          <Icon.ReplyAll />
        </ToolbarButton>
        <ToolbarButton onClick={onForward} label="Reenviar">
          <Icon.Forward />
        </ToolbarButton>

        <div className="flex-1" />

        <ToolbarButton onClick={onArchive} label="Archivar">
          <Icon.Archive />
        </ToolbarButton>
        <ToolbarButton onClick={onDelete} label="Eliminar" danger>
          <Icon.Trash />
        </ToolbarButton>
      </div>

      {/* Email content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-5">
          {/* Subject — prominent, Outlook-style */}
          <h2 className="text-2xl font-bold text-gray-900 mb-5 leading-snug break-words">
            {email.subject || "(Sin asunto)"}
          </h2>

          {/* Sender card */}
          <div className="flex items-start gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-[#0A1A44] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {(email.from_name || email.from_email || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline flex-wrap gap-x-2">
                <span className="font-semibold text-sm text-gray-900">
                  {email.from_name || email.from_email}
                </span>
                <span className="text-xs text-gray-400 truncate">
                  &lt;{email.from_email}&gt;
                </span>
              </div>
              <button
                onClick={() => setShowFullHeaders(!showFullHeaders)}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <span className="truncate max-w-[28rem]">Para: {toList}</span>
                <svg
                  className={`h-3 w-3 transition-transform ${showFullHeaders ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showFullHeaders && ccList && (
                <p className="text-xs text-gray-500 mt-0.5">CC: {ccList}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(email.created_at)}</p>
            </div>

            {/* Status badge */}
            {email.status && email.direction === "outbound" && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                  email.status === "delivered"
                    ? "bg-green-100 text-green-700"
                    : email.status === "opened"
                    ? "bg-blue-100 text-blue-700"
                    : email.status === "bounced"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {email.status === "delivered"
                  ? "Entregado"
                  : email.status === "opened"
                  ? "Leído"
                  : email.status === "bounced"
                  ? "Rebotado"
                  : email.status === "sent"
                  ? "Enviado"
                  : email.status}
              </span>
            )}
          </div>

          {/* Attachments shown above the body (Outlook layout) */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {attachments.map((att, i) => {
                const available = !!att.storage_path;
                return (
                  <AttachmentChip
                    key={i}
                    att={att}
                    available={available}
                    href={available ? `/api/email/${email.id}/attachments/${i}` : undefined}
                  />
                );
              })}
            </div>
          )}

          {/* Body */}
          <div className="border border-gray-200 rounded-lg bg-white p-6 shadow-sm">
            <EmailBody html={email.body_html} text={email.body_text} />
          </div>
        </div>
      </div>
    </div>
  );
}
