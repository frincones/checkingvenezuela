"use client";

import { useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

function EditorToolbar({ editor }) {
  if (!editor) return null;
  const btn = (active, onClick, children) => (
    <button
      type="button"
      onClick={onClick}
      className={`p-1.5 rounded text-sm ${active ? "bg-gray-200 text-gray-900" : "text-gray-500 hover:bg-gray-100"}`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-200 bg-gray-50">
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <strong>B</strong>)}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <em>I</em>)}
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(),
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
      )}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(),
        <span className="text-xs font-mono">1.</span>
      )}
    </div>
  );
}

export default function ComposeModal({ isOpen, onClose, replyTo, forwardEmail, onSent }) {
  const [to, setTo] = useState(replyTo?.from_email || "");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(() => {
    if (replyTo) return replyTo.subject?.startsWith("Re: ") ? replyTo.subject : `Re: ${replyTo.subject || ""}`;
    if (forwardEmail) return `Fwd: ${forwardEmail.subject || ""}`;
    return "";
  });
  const [sending, setSending] = useState(false);

  const initialContent = forwardEmail
    ? `<br/><br/><blockquote style="border-left:2px solid #ccc;padding-left:12px;color:#666;">
        <p><small>---------- Mensaje reenviado ----------</small></p>
        <p><small>De: ${forwardEmail.from_email}<br/>Fecha: ${new Date(forwardEmail.created_at).toLocaleString("es-VE")}<br/>Asunto: ${forwardEmail.subject || ""}</small></p>
        ${forwardEmail.body_html || forwardEmail.body_text || ""}
      </blockquote>`
    : replyTo
      ? `<br/><br/><blockquote style="border-left:2px solid #ccc;padding-left:12px;color:#666;">
          <p><small>El ${new Date(replyTo.created_at).toLocaleString("es-VE")} &lt;${replyTo.from_email}&gt; escribió:</small></p>
          ${replyTo.body_html || replyTo.body_text || ""}
        </blockquote>`
      : "";

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Escribe tu mensaje..." }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3",
      },
    },
  });

  const handleSend = useCallback(async () => {
    if (!to.trim()) return;
    setSending(true);
    try {
      const toEmails = to.split(",").map((e) => e.trim()).filter(Boolean);
      const ccEmails = cc.split(",").map((e) => e.trim()).filter(Boolean);
      const html = editor?.getHTML() || "";
      const text = editor?.getText() || "";

      const payload = {
        to: toEmails,
        subject,
        html,
        text,
      };
      if (ccEmails.length) payload.cc = ccEmails;
      if (replyTo) {
        payload.in_reply_to = replyTo.message_id;
        payload.thread_id = replyTo.thread_id || replyTo.id;
      }

      const endpoint = replyTo
        ? `/api/email/${replyTo.id}/reply`
        : "/api/email";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(replyTo ? { html, text, replyAll: false } : payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al enviar");
      }

      onSent?.();
      onClose();
    } catch (error) {
      alert(error.message);
    } finally {
      setSending(false);
    }
  }, [to, cc, subject, editor, replyTo, onSent, onClose]);

  const handleDraft = useCallback(async () => {
    try {
      const toEmails = to.split(",").map((e) => e.trim()).filter(Boolean);
      await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toEmails,
          subject,
          html: editor?.getHTML() || "",
          text: editor?.getText() || "",
          isDraft: true,
        }),
      });
      onClose();
    } catch {}
  }, [to, subject, editor, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4">
      <div className="w-full max-w-lg bg-white rounded-t-xl shadow-2xl border border-gray-200 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0A1A44] rounded-t-xl">
          <h3 className="text-white font-semibold text-sm">
            {replyTo ? "Responder" : forwardEmail ? "Reenviar" : "Nuevo mensaje"}
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={handleDraft} className="text-white/70 hover:text-white text-xs px-2 py-1">
              Guardar borrador
            </button>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="border-b border-gray-200">
          <div className="flex items-center px-4 py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-12">Para:</span>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@ejemplo.com"
              className="flex-1 text-sm outline-none"
            />
            {!showCc && (
              <button onClick={() => setShowCc(true)} className="text-xs text-gray-400 hover:text-gray-600">
                CC
              </button>
            )}
          </div>
          {showCc && (
            <div className="flex items-center px-4 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 w-12">CC:</span>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="email@ejemplo.com"
                className="flex-1 text-sm outline-none"
              />
            </div>
          )}
          <div className="flex items-center px-4 py-2">
            <span className="text-sm text-gray-500 w-12">Asunto:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del correo"
              className="flex-1 text-sm outline-none"
            />
          </div>
        </div>

        {/* Editor */}
        <EditorToolbar editor={editor} />
        <div className="flex-1 overflow-y-auto">
          <EditorContent editor={editor} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            {/* Future: attach file button */}
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !to.trim()}
            className="flex items-center gap-2 rounded-lg bg-[#0A1A44] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A1A44]/90 disabled:opacity-50 transition"
          >
            {sending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enviando...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Enviar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
