"use client";

import { useMemo, useState } from "react";
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

/* ── Group emails by thread_id, falling back to the row id for ungrouped ones.
 *    Each group is sorted by created_at desc; the head email is what shows
 *    in the collapsed view; the rest render on expand.
 */
function groupByThread(emails) {
  const groups = new Map();
  for (const e of emails) {
    const key = e.thread_id || e.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  // Sort each group most-recent first
  for (const arr of groups.values()) {
    arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  // Convert to array, sorted by the group head's date desc
  return Array.from(groups.values()).sort(
    (a, b) => new Date(b[0].created_at) - new Date(a[0].created_at)
  );
}

function ThreadRow({ thread, selectedId, onSelect, onToggleStar, folder, selectedSet, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false);
  const head = thread[0];
  const isChecked = selectedSet?.has(head.id) || false;
  const count = thread.length;
  const hasMultiple = count > 1;
  const headSelected = head.id === selectedId;
  const anyInThreadSelected = thread.some((e) => e.id === selectedId);
  const anyUnread = thread.some((e) => !e.is_read);
  const anyAttachments = thread.some((e) => e.attachments?.length > 0);
  const anyStarred = thread.some((e) => e.is_starred);

  return (
    <div>
      {/* Head row */}
      <div
        onClick={() => onSelect(head.id)}
        className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer transition ${
          anyInThreadSelected
            ? "bg-[#0A1A44]/5 border-l-2 border-l-[#0A1A44]"
            : "hover:bg-gray-50"
        } ${anyUnread ? "bg-blue-50/30" : ""}`}
      >
        {/* Checkbox for bulk selection (shows on hover or when any selected) */}
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(head.id);
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 flex-shrink-0 accent-[#0A1A44] cursor-pointer"
            aria-label="Seleccionar correo"
          />
        )}

        {/* Star (acts on head) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(head.id, !head.is_starred);
          }}
          className="mt-0.5 flex-shrink-0"
        >
          <svg
            className={`h-4 w-4 ${
              anyStarred ? "fill-[#F2A93B] text-[#F2A93B]" : "text-gray-300 hover:text-gray-400"
            }`}
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
            <span
              className={`text-sm truncate flex items-center gap-1.5 ${
                anyUnread ? "font-bold text-gray-900" : "text-gray-700"
              }`}
            >
              {folder === "sent" ? "Para: " : ""}
              {getDisplayName(head)}
              {hasMultiple && (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold ${
                    anyUnread ? "bg-[#0A1A44] text-white" : "bg-gray-200 text-gray-600"
                  }`}
                  title={`${count} mensajes en la conversación`}
                >
                  {count}
                </span>
              )}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {formatDistanceToNow(new Date(head.created_at), {
                addSuffix: true,
                locale: es,
              })}
            </span>
          </div>
          <p
            className={`text-sm truncate ${
              anyUnread ? "font-semibold text-gray-800" : "text-gray-600"
            }`}
          >
            {head.subject || "(Sin asunto)"}
          </p>
          <p className="text-xs text-gray-400 truncate mt-0.5">{getPreview(head)}</p>
        </div>

        {/* Indicators + expand toggle */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
          {anyUnread && <span className="h-2 w-2 rounded-full bg-[#0A1A44]" />}
          {anyAttachments && (
            <svg
              className="h-3.5 w-3.5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          )}
          {hasMultiple && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((x) => !x);
              }}
              className="text-gray-300 hover:text-gray-500"
              title={expanded ? "Colapsar conversación" : "Expandir conversación"}
            >
              <svg
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expanded sub-rows (older messages of the thread) */}
      {expanded &&
        thread.slice(1).map((e) => (
          <div
            key={e.id}
            onClick={() => onSelect(e.id)}
            className={`flex items-start gap-3 px-4 py-2 pl-12 border-b border-gray-100 cursor-pointer transition text-xs ${
              e.id === selectedId
                ? "bg-[#0A1A44]/5"
                : "hover:bg-gray-50"
            } ${!e.is_read ? "bg-blue-50/30" : ""}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`truncate ${
                    !e.is_read ? "font-bold text-gray-800" : "text-gray-600"
                  }`}
                >
                  {e.direction === "outbound" ? "↑ " : "↓ "}
                  {getDisplayName(e)}
                </span>
                <span className="text-gray-400 flex-shrink-0">
                  {formatDistanceToNow(new Date(e.created_at), {
                    addSuffix: true,
                    locale: es,
                  })}
                </span>
              </div>
              <p className="truncate text-gray-500 mt-0.5">{getPreview(e)}</p>
            </div>
            {e.attachments?.length > 0 && (
              <svg
                className="h-3 w-3 text-gray-400 flex-shrink-0 mt-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            )}
          </div>
        ))}
    </div>
  );
}

export default function EmailList({
  emails,
  selectedId,
  onSelect,
  onToggleStar,
  loading,
  folder,
  groupByConversation = true,
  selectedSet,
  onToggleSelect,
}) {
  const threads = useMemo(
    () => (groupByConversation ? groupByThread(emails || []) : (emails || []).map((e) => [e])),
    [emails, groupByConversation]
  );

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
      {threads.map((thread, i) => (
        <ThreadRow
          key={thread[0].id || i}
          thread={thread}
          selectedId={selectedId}
          onSelect={onSelect}
          onToggleStar={onToggleStar}
          folder={folder}
          selectedSet={selectedSet}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
