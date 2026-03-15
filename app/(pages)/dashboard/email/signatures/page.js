"use client";

import { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";

function SignatureEditor({ signature, onSave, onCancel }) {
  const [name, setName] = useState(signature?.name || "");
  const [isDefault, setIsDefault] = useState(signature?.is_default || false);
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExt.configure({ openOnClick: false }),
      Underline,
      TextStyle,
      Color,
      Image.configure({ inline: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Diseña tu firma aquí..." }),
    ],
    content: signature?.body_html || `
      <p><strong>Tu Nombre</strong></p>
      <p>Cargo | Venezuela Voyages</p>
      <p>📞 +58 426 403 4052</p>
      <p>✉️ ventas@venezuelavoyages.com</p>
      <p>🌐 www.venezuelavoyages.com</p>
    `,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[150px] px-4 py-3",
      },
    },
  });

  const handleSave = useCallback(async () => {
    if (!name.trim() || !editor) return;
    setSaving(true);
    try {
      const body_html = editor.getHTML();
      const method = signature?.id ? "PATCH" : "POST";
      const url = signature?.id
        ? `/api/email/signatures/${signature.id}`
        : "/api/email/signatures";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body_html, is_default: isDefault }),
      });

      if (!res.ok) throw new Error("Error al guardar");
      onSave();
    } catch (err) {
      alert(err.message);
    }
    setSaving(false);
  }, [name, isDefault, editor, signature, onSave]);

  const handleInsertImage = () => {
    const url = prompt("URL de la imagen (logo):");
    if (url && editor) editor.chain().focus().setImage({ src: url }).run();
  };

  const handleInsertLink = () => {
    const url = prompt("URL del enlace:");
    if (url && editor) editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  };

  return (
    <div className="border rounded-xl bg-white">
      <div className="p-4 border-b">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 block mb-1">Nombre de la firma</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Firma principal"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0A1A44]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded"
            />
            Predeterminada
          </label>
        </div>
      </div>

      {/* Mini toolbar */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b bg-gray-50">
        <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={`p-1 rounded text-sm ${editor?.isActive("bold") ? "bg-gray-200" : "hover:bg-gray-100"}`}><strong>B</strong></button>
        <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={`p-1 rounded text-sm ${editor?.isActive("italic") ? "bg-gray-200" : "hover:bg-gray-100"}`}><em>I</em></button>
        <button type="button" onClick={() => editor?.chain().focus().toggleUnderline().run()} className={`p-1 rounded text-sm ${editor?.isActive("underline") ? "bg-gray-200" : "hover:bg-gray-100"}`}><span className="underline">U</span></button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <button type="button" onClick={handleInsertLink} className="p-1 rounded text-sm text-gray-500 hover:bg-gray-100" title="Enlace">🔗</button>
        <button type="button" onClick={handleInsertImage} className="p-1 rounded text-sm text-gray-500 hover:bg-gray-100" title="Imagen/Logo">🖼️</button>
      </div>

      <EditorContent editor={editor} />

      <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="px-4 py-2 text-sm font-semibold text-white bg-[#0A1A44] rounded-lg hover:bg-[#0A1A44]/90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : signature?.id ? "Actualizar" : "Crear firma"}
        </button>
      </div>
    </div>
  );
}

export default function SignaturesPage() {
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | signature object

  const fetchSignatures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/signatures");
      const data = await res.json();
      setSignatures(data.signatures || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchSignatures(); }, [fetchSignatures]);

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta firma?")) return;
    await fetch(`/api/email/signatures/${id}`, { method: "DELETE" });
    fetchSignatures();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Firmas de Email</h1>
          <p className="text-sm text-gray-500 mt-1">Crea y gestiona tus firmas para incluirlas en los correos</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-2 rounded-lg bg-[#0A1A44] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A1A44]/90"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva firma
          </button>
        )}
      </div>

      {editing && (
        <div className="mb-6">
          <SignatureEditor
            signature={editing === "new" ? null : editing}
            onSave={() => { setEditing(null); fetchSignatures(); }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : signatures.length === 0 && !editing ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <p className="text-gray-400 mb-2">No tienes firmas creadas</p>
          <button onClick={() => setEditing("new")} className="text-sm text-[#0A1A44] font-semibold hover:underline">
            Crear tu primera firma
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {signatures.map((sig) => (
            <div key={sig.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-gray-900">{sig.name}</h3>
                  {sig.is_default && (
                    <span className="text-[10px] bg-[#F2A93B] text-white px-1.5 py-0.5 rounded-full font-bold">
                      Predeterminada
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(sig)} className="text-xs text-gray-400 hover:text-[#0A1A44] px-2 py-1">
                    Editar
                  </button>
                  <button onClick={() => handleDelete(sig.id)} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1">
                    Eliminar
                  </button>
                </div>
              </div>
              <div
                className="prose prose-sm max-w-none text-gray-600 border-t pt-3"
                dangerouslySetInnerHTML={{ __html: sig.body_html }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
