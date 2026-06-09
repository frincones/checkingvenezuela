"use client";

import { useState, useEffect, useCallback } from "react";
import EmailSidebar from "@/components/dashboard/email/EmailSidebar";
import EmailList from "@/components/dashboard/email/EmailList";
import EmailView from "@/components/dashboard/email/EmailView";
import ComposeModal from "@/components/dashboard/email/ComposeModal";

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

  // Mailboxes
  const [mailboxes, setMailboxes] = useState([]);
  const [activeMailbox, setActiveMailbox] = useState(null); // null = all

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
  }, [folder, search, activeMailbox]);

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

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
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
              placeholder="Buscar correos..."
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
        </form>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
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
        />

        {/* Email list */}
        <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              {folder === "inbox" ? "Bandeja de entrada" :
               folder === "sent" ? "Enviados" :
               folder === "drafts" ? "Borradores" :
               folder === "archive" ? "Archivo" :
               "Papelera"}
              {total > 0 && ` (${total})`}
            </span>
          </div>
          <EmailList
            emails={emails}
            selectedId={selectedId}
            onSelect={handleSelect}
            onToggleStar={handleToggleStar}
            loading={loading}
            folder={folder}
          />
        </div>

        {/* Email viewer */}
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
