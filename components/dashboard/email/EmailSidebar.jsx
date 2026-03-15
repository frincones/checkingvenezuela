"use client";

const FOLDERS = [
  { key: "inbox", label: "Bandeja de entrada", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { key: "sent", label: "Enviados", icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8" },
  { key: "drafts", label: "Borradores", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { key: "archive", label: "Archivo", icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" },
  { key: "trash", label: "Papelera", icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" },
];

export default function EmailSidebar({ activeFolder, onFolderChange, unread, onCompose }) {
  return (
    <div className="w-60 border-r border-gray-200 bg-white flex flex-col h-full">
      <div className="p-4">
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
    </div>
  );
}
