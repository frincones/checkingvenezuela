"use client";

import { useEffect, useState } from "react";

const LABEL_COLORS = [
  "#0A1A44", "#F2A93B", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899",
];

/**
 * Compact label manager that lives in the sidebar.
 * Lists existing labels with a click to filter; plus button shows a small
 * inline form to create a new one (name + color picker). Long-press / icon
 * lets the user rename or delete an existing label.
 */
export default function LabelsManager({ labels, onChange, activeLabel, onSelectLabel }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null); // label id
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[0]);

  function startCreate() {
    setCreating(true);
    setEditing(null);
    setName("");
    setColor(LABEL_COLORS[0]);
  }

  function startEdit(label) {
    setEditing(label.id);
    setCreating(false);
    setName(label.name);
    setColor(label.color);
  }

  function cancel() {
    setCreating(false);
    setEditing(null);
    setName("");
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      if (editing) {
        const res = await fetch(`/api/email/labels/${editing}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, color }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Error");
      } else {
        const res = await fetch("/api/email/labels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, color }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Error");
      }
      cancel();
      onChange?.();
    } catch (e) {
      alert(e.message);
    }
  }

  async function remove(label) {
    if (!window.confirm(`¿Eliminar la etiqueta "${label.name}"?`)) return;
    try {
      const res = await fetch(`/api/email/labels/${label.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      onChange?.();
    } catch {
      alert("No se pudo eliminar");
    }
  }

  return (
    <div className="px-2 pt-3 border-t border-gray-100 mt-2">
      <div className="flex items-center justify-between px-2 mb-1">
        <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wide">
          Etiquetas
        </span>
        <button
          onClick={startCreate}
          className="text-gray-400 hover:text-[#0A1A44] p-0.5"
          title="Nueva etiqueta"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="space-y-0.5">
        {labels.map((l) => {
          const isEditing = editing === l.id;
          if (isEditing) {
            return (
              <div key={l.id} className="p-2 rounded bg-gray-50 space-y-1.5">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#0A1A44]"
                  autoFocus
                />
                <div className="flex flex-wrap gap-1">
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`h-4 w-4 rounded-full border ${
                        color === c ? "ring-2 ring-offset-1 ring-gray-400" : "border-white"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <button onClick={save} className="flex-1 text-xs bg-[#0A1A44] text-white rounded px-2 py-1">
                    Guardar
                  </button>
                  <button onClick={cancel} className="text-xs text-gray-500 px-2 py-1">
                    Cancelar
                  </button>
                </div>
              </div>
            );
          }
          const isActive = activeLabel === l.id;
          return (
            <div
              key={l.id}
              className={`group flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer transition ${
                isActive ? "bg-[#0A1A44]/10 text-[#0A1A44]" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span
                onClick={() => onSelectLabel?.(isActive ? null : l.id)}
                className="flex items-center gap-2 flex-1 min-w-0"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: l.color }}
                />
                <span className="truncate">{l.name}</span>
              </span>
              <button
                onClick={() => startEdit(l)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition"
                title="Editar"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => remove(l)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"
                title="Eliminar"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}

        {creating && (
          <div className="p-2 rounded bg-gray-50 space-y-1.5">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la etiqueta"
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#0A1A44]"
              autoFocus
            />
            <div className="flex flex-wrap gap-1">
              {LABEL_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-4 w-4 rounded-full border ${
                    color === c ? "ring-2 ring-offset-1 ring-gray-400" : "border-white"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={save} className="flex-1 text-xs bg-[#0A1A44] text-white rounded px-2 py-1">
                Crear
              </button>
              <button onClick={cancel} className="text-xs text-gray-500 px-2 py-1">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
