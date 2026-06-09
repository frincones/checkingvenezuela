"use client";

const FOLDERS = [
  { key: "inbox", label: "Bandeja de entrada" },
  { key: "archive", label: "Archivo" },
  { key: "trash", label: "Papelera" },
];

export default function BulkActionsBar({ count, onAction, onClear, currentFolder }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-[#0A1A44]/5 text-sm">
      <button
        onClick={onClear}
        className="text-gray-500 hover:text-gray-700"
        title="Limpiar selección"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <span className="font-semibold text-gray-700">
        {count} seleccionado{count > 1 ? "s" : ""}
      </span>

      <div className="flex-1" />

      <button
        onClick={() => onAction("mark_read")}
        className="px-2 py-1 rounded hover:bg-white text-gray-600"
        title="Marcar como leído"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </button>
      <button
        onClick={() => onAction("mark_unread")}
        className="px-2 py-1 rounded hover:bg-white text-gray-600"
        title="Marcar como no leído"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>
      <button
        onClick={() => onAction("star")}
        className="px-2 py-1 rounded hover:bg-white text-gray-600"
        title="Destacar"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>

      {currentFolder !== "archive" && (
        <button
          onClick={() => onAction("archive")}
          className="px-2 py-1 rounded hover:bg-white text-gray-600"
          title="Archivar"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </button>
      )}

      <select
        onChange={(e) => {
          if (e.target.value) {
            onAction("move", { folder: e.target.value });
            e.target.value = "";
          }
        }}
        className="px-2 py-1 rounded border border-gray-200 text-xs bg-white text-gray-600"
        defaultValue=""
        title="Mover a carpeta"
      >
        <option value="" disabled>
          Mover a…
        </option>
        {FOLDERS.filter((f) => f.key !== currentFolder).map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>

      <button
        onClick={() => onAction(currentFolder === "trash" ? "delete" : "trash")}
        className="px-2 py-1 rounded hover:bg-red-50 text-gray-600 hover:text-red-600"
        title={currentFolder === "trash" ? "Eliminar permanentemente" : "Mover a papelera"}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
