"use client";

const FOLDERS = [
  { key: "inbox", label: "Bandeja de entrada", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { key: "sent", label: "Enviados", icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8" },
  { key: "drafts", label: "Borradores", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { key: "archive", label: "Archivo", icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" },
  { key: "trash", label: "Papelera", icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" },
];

export default function EmailSidebar({ activeFolder, onFolderChange, unread, onCompose, mailboxes, activeMailbox, onMailboxChange }) {
  return (
    <div className="w-60 border-r border-gray-200 bg-white flex flex-col h-full">
      {/* Mailbox selector */}
      {mailboxes?.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <select
            value={activeMailbox || "all"}
            onChange={(e) => onMailboxChange(e.target.value === "all" ? null : e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0A1A44] font-medium text-gray-700"
          >
            <option value="all">Todos los buzones</option>
            {mailboxes.map((mb) => (
              <option key={mb.id} value={mb.id}>
                {mb.name} — {mb.address.split("@")[0]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="px-4 pb-3 pt-2">
        <button
          onClick={onCompose}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0A1A44] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0A1A44]/90 transition"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Redactar
        </button>
      </div>

      <nav className="flex-1 px-2 space-y-0.5">
        {FOLDERS.map((f) => {
          const isActive = activeFolder === f.key;
          const count = unread?.[f.key] || 0;
          return (
            <button
              key={f.key}
              onClick={() => onFolderChange(f.key)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-[#0A1A44]/10 text-[#0A1A44] font-semibold"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} />
              </svg>
              <span className="flex-1 text-left">{f.label}</span>
              {count > 0 && f.key !== "trash" && (
                <span className="rounded-full bg-[#F2A93B] px-2 py-0.5 text-xs font-bold text-white">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Signatures link */}
      <div className="px-2 pb-4 pt-2 border-t border-gray-100 mt-2">
        <a
          href="/dashboard/email/signatures"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 transition"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Firmas
        </a>
      </div>
    </div>
  );
}
