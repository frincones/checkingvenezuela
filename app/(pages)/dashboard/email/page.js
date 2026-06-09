"use client";

import { useState, useEffect, useCallback } from "react";
import EmailSidebar from "@/components/dashboard/email/EmailSidebar";
import EmailList from "@/components/dashboard/email/EmailList";
import EmailView from "@/components/dashboard/email/EmailView";
import ComposeModal from "@/components/dashboard/email/ComposeModal";
import BulkActionsBar from "@/components/dashboard/email/BulkActionsBar";

export default function EmailPage() {
  const [folder, setFolder] = useState("inbox");
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [unread, setUnread] = useState({});
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [hasUnassigned, setHasUnassigned] = useState(false);

  // Bulk selection state — keys into the threads' head ids.
  const [bulkSelected, setBulkSelected] = useState(() => new Set());

  // Mailboxes
  const [mailboxes, setMailboxes] = useState([]);
  const [activeMailbox, setActiveMailbox] = useState(null); // null = all

  // Labels
  const [activeLabel, setActiveLabel] = useState(null);

  // Reading pane layout — persisted in localStorage
  const [readingPane, setReadingPane] = useState("right"); // 'right' | 'bottom' | 'off'

  useEffect(() => {
    try {
      const stored = localStorage.getItem("emailReadingPane");
      if (stored === "right" || stored === "bottom" || stored === "off") {
        setReadingPane(stored);
      }
    } catch {}
  }, []);

  function changeReadingPane(mode) {
    setReadingPane(mode);
    try {
      localStorage.setItem("emailReadingPane", mode);
    } catch {}
  }

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [forwardEmail, setForwardEmail] = useState(null);

  // Fetch mailboxes on mount
  useEffect(() => {
    fetch("/api/email/mailboxes")
      .then((r) => r.json())
      .then((d) => setMailboxes(d.mailboxes || []))
      .catch(() => {});
  }, []);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ folder });
      if (search) params.set("search", search);
      if (activeMailbox) params.set("mailbox_id", activeMailbox);
      if (activeLabel) params.set("label_id", activeLabel);
      const res = await fetch(`/api/email?${params}`);
      const data = await res.json();
      setEmails(data.emails || []);
      setTotal(data.total || 0);
      setUnread(data.unread || {});
      setHasUnassigned(!!data.hasUnassigned);
    } catch (err) {
      console.error("Error fetching emails:", err);
    } finally {
      setLoading(false);
    }
  }, [folder, search, activeMailbox, activeLabel]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchEmails, 30000);
    return () => clearInterval(interval);
  }, [fetchEmails]);

  const handleSelect = useCallback(async (id) => {
    setSelectedId(id);
    try {
      const res = await fetch(`/api/email/${id}`);
      const data = await res.json();
      setSelectedEmail(data);
      setEmails((prev) =>
        prev.map((e) => (e.id === id ? { ...e, is_read: true } : e))
      );
    } catch (err) {
      console.error("Error fetching email:", err);
    }
  }, []);

  const handleToggleStar = useCallback(async (id, starred) => {
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, is_starred: starred } : e))
    );
    await fetch(`/api/email/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_starred: starred }),
    });
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    await fetch(`/api/email/${selectedId}`, { method: "DELETE" });
    setSelectedEmail(null);
    setSelectedId(null);
    fetchEmails();
  }, [selectedId, fetchEmails]);

  const handleArchive = useCallback(async () => {
    if (!selectedId) return;
    await fetch(`/api/email/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: "archive" }),
    });
    setSelectedEmail(null);
    setSelectedId(null);
    fetchEmails();
  }, [selectedId, fetchEmails]);

  const handleToggleSelect = useCallback((id) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setBulkSelected(new Set());
  }, []);

  const handleBulkAction = useCallback(
    async (action, extra = {}) => {
      const ids = Array.from(bulkSelected);
      if (!ids.length) return;
      if (action === "delete" || action === "trash") {
        const confirmMsg =
          action === "delete"
            ? `¿Eliminar permanentemente ${ids.length} correo(s)?`
            : `¿Mover ${ids.length} correo(s) a la papelera?`;
        if (!window.confirm(confirmMsg)) return;
      }
      try {
        const res = await fetch("/api/email/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action, ...extra }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.error || "Error al aplicar la acción");
          return;
        }
        // If the currently-open email was in the bulk, deselect it.
        if (selectedId && bulkSelected.has(selectedId)) {
          setSelectedId(null);
          setSelectedEmail(null);
        }
        setBulkSelected(new Set());
        fetchEmails();
      } catch (err) {
        alert("Error al aplicar la acción");
      }
    },
    [bulkSelected, fetchEmails, selectedId]
  );

  const handleReply = useCallback(
    (replyAll) => {
      if (!selectedEmail) return;
      setReplyTo({ ...selectedEmail, replyAll });
      setForwardEmail(null);
      setComposeOpen(true);
    },
    [selectedEmail]
  );

  const handleForward = useCallback(() => {
    if (!selectedEmail) return;
    setForwardEmail(selectedEmail);
    setReplyTo(null);
    setComposeOpen(true);
  }, [selectedEmail]);

  const openCompose = useCallback(() => {
    setReplyTo(null);
    setForwardEmail(null);
    setComposeOpen(true);
  }, []);

  const handleSearchSubmit = useCallback(
    (e) => {
      e.preventDefault();
      fetchEmails();
    },
    [fetchEmails]
  );

  const handleMailboxChange = useCallback((mbId) => {
    setActiveMailbox(mbId);
    setSelectedId(null);
    setSelectedEmail(null);
  }, []);

  // Get active mailbox address for compose default
  const activeMailboxAddress = activeMailbox
    ? mailboxes.find((mb) => mb.id === activeMailbox)?.address
    : null;

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  // The email module is a 3-pane interface that should use the entire
  // viewport (minus the global header). The negative -m-4 cancels the
  // padding that <main> in dashboard/layout.js applies for simpler pages
  // so we can fill every pixel.
  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] -m-4 mt-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Email</h1>
          {totalUnread > 0 && (
            <span className="rounded-full bg-[#F2A93B] px-2.5 py-0.5 text-xs font-bold text-white">
              {totalUnread} sin leer
            </span>
          )}
        </div>
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Buscar… (ej: from:juan has:attachment is:unread before:2026-06-01)'
              title="Operadores: from: to: subject: has:attachment is:unread is:starred before: after:"
              className="rounded-lg border border-gray-300 pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-[#0A1A44] w-64"
            />
          </div>
          <button
            onClick={fetchEmails}
            type="button"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            title="Actualizar"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {/* Reading-pane layout selector */}
          <div className="hidden md:flex items-center gap-0.5 ml-1 border border-gray-200 rounded-lg p-0.5">
            {[
              {
                key: "right",
                label: "Panel a la derecha",
                d: "M3 4h7v16H3zM14 4h7v16h-7z",
              },
              {
                key: "bottom",
                label: "Panel abajo",
                d: "M3 3h18v8H3zM3 13h18v8H3z",
              },
              {
                key: "off",
                label: "Sin panel de lectura",
                d: "M3 3h18v18H3z",
              },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => changeReadingPane(opt.key)}
                title={opt.label}
                className={`p-1.5 rounded text-gray-500 hover:bg-gray-100 ${
                  readingPane === opt.key ? "bg-[#0A1A44]/10 text-[#0A1A44]" : ""
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={opt.d} />
                </svg>
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Main layout — three reading-pane modes:
       *   right  (default):   sidebar | list | viewer
       *   bottom:             sidebar | (list on top / viewer below)
       *   off:                sidebar | list ; viewer takes over when selected
       */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`${selectedId && readingPane === "off" ? "hidden md:flex" : "flex"}`}>
          <EmailSidebar
            activeFolder={folder}
            onFolderChange={(f) => {
              setFolder(f);
              setSelectedId(null);
              setSelectedEmail(null);
            }}
            unread={unread}
            onCompose={openCompose}
            mailboxes={mailboxes}
            activeMailbox={activeMailbox}
            onMailboxChange={handleMailboxChange}
            hasUnassigned={hasUnassigned}
            activeLabel={activeLabel}
            onLabelChange={setActiveLabel}
          />
        </div>

        {/* Right column = either list+viewer side-by-side ('right'),
            stacked ('bottom'), or just the list ('off') swapping with viewer. */}
        <div className={`flex-1 flex overflow-hidden ${readingPane === "bottom" ? "flex-col" : "flex-row"}`}>
          {/* List */}
          <div
            className={`${
              readingPane === "right"
                ? "w-full md:w-96 border-r border-gray-200"
                : readingPane === "bottom"
                ? "h-1/2 border-b border-gray-200"
                : "flex-1"
            } flex-col bg-white ${
              selectedId && (readingPane === "off") ? "hidden md:flex" : "flex"
            } ${selectedId && readingPane !== "off" && readingPane !== "right" ? "" : ""}`}
          >
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
              <span className="text-xs font-semibold text-gray-500 uppercase">
                {folder === "inbox"
                  ? "Bandeja de entrada"
                  : folder === "sent"
                  ? "Enviados"
                  : folder === "drafts"
                  ? "Borradores"
                  : folder === "archive"
                  ? "Archivo"
                  : "Papelera"}
                {total > 0 && ` (${total})`}
              </span>
            </div>
            <BulkActionsBar
              count={bulkSelected.size}
              onAction={handleBulkAction}
              onClear={handleClearSelection}
              currentFolder={folder}
            />
            <EmailList
              emails={emails}
              selectedId={selectedId}
              onSelect={handleSelect}
              onToggleStar={handleToggleStar}
              loading={loading}
              folder={folder}
              selectedSet={bulkSelected}
              onToggleSelect={handleToggleSelect}
            />
          </div>

          {/* Viewer */}
          <div
            className={`${
              readingPane === "right"
                ? "flex-1"
                : readingPane === "bottom"
                ? "h-1/2"
                : "flex-1"
            } ${
              readingPane === "off" && !selectedId
                ? "hidden"
                : selectedId
                ? "flex"
                : "hidden md:flex"
            }`}
          >
            <EmailView
              email={selectedEmail}
              onReply={handleReply}
              onForward={handleForward}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onBack={() => {
                setSelectedId(null);
                setSelectedEmail(null);
              }}
            />
          </div>
        </div>
      </div>

      {/* Compose modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          setReplyTo(null);
          setForwardEmail(null);
        }}
        replyTo={replyTo}
        forwardEmail={forwardEmail}
        onSent={fetchEmails}
        mailboxes={mailboxes}
        defaultFromAddress={activeMailboxAddress}
      />
    </div>
  );
}
