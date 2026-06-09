"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { useDropzone } from "react-dropzone";
import RecipientInput from "@/components/dashboard/email/RecipientInput";

/* ── Constants ── */
// Resend API limit is 40 MB, but Base64 encoding adds ~33% overhead.
// A 30 MB binary file becomes ~40 MB in Base64, so we cap at 30 MB.
const MAX_ATTACHMENT_SIZE = 30 * 1024 * 1024; // 30 MB per file (safe binary limit)
const MAX_TOTAL_SIZE = 30 * 1024 * 1024; // 30 MB total

const FONTS = [
  { label: "Sans Serif", value: "Arial, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Monospace", value: "monospace" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
];

const COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc",
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#0A1A44", "#F2A93B", "#FFD275",
];

const FILE_ICONS = {
  pdf: "M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2z",
  image: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  default: "M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13",
};

function getFileIcon(type) {
  if (type?.startsWith("image/")) return FILE_ICONS.image;
  if (type === "application/pdf") return FILE_ICONS.pdf;
  return FILE_ICONS.default;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Toolbar ── */
function EditorToolbar({ editor, onInsertImage, onToggleEmoji }) {
  const [showColorPicker, setShowColorPicker] = useState(null); // "text" | "bg" | null
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowColorPicker(null);
        setShowFontMenu(false);
        setShowTableMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!editor) return null;

  const btn = (active, onClick, children, title) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1 rounded text-sm ${active ? "bg-gray-200 text-gray-900" : "text-gray-500 hover:bg-gray-100"}`}
    >
      {children}
    </button>
  );

  const icon = (d) => (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b border-gray-200 bg-gray-50 relative" ref={pickerRef}>
      {/* Font family */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowFontMenu(!showFontMenu); setShowColorPicker(null); setShowTableMenu(false); }}
          className="text-xs px-1.5 py-1 rounded text-gray-500 hover:bg-gray-100 max-w-[80px] truncate"
          title="Fuente"
        >
          Fuente ▾
        </button>
        {showFontMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 py-1 w-40">
            {FONTS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => { editor.chain().focus().setFontFamily(f.value).run(); setShowFontMenu(false); }}
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
                style={{ fontFamily: f.value }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-gray-200 mx-0.5" />

      {/* Basic formatting */}
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <strong className="text-xs">B</strong>, "Negrita")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <em className="text-xs">I</em>, "Cursiva")}
      {btn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), <span className="text-xs underline">U</span>, "Subrayado")}
      {btn(editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), <span className="text-xs line-through">S</span>, "Tachado")}
      {btn(editor.isActive("subscript"), () => editor.chain().focus().toggleSubscript().run(), <span className="text-[10px]">X₂</span>, "Subíndice")}
      {btn(editor.isActive("superscript"), () => editor.chain().focus().toggleSuperscript().run(), <span className="text-[10px]">X²</span>, "Superíndice")}

      <div className="w-px h-4 bg-gray-200 mx-0.5" />

      {/* Colors */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowColorPicker(showColorPicker === "text" ? null : "text"); setShowFontMenu(false); setShowTableMenu(false); }}
          title="Color de texto"
          className="p-1 rounded text-gray-500 hover:bg-gray-100"
        >
          <span className="text-xs font-bold" style={{ color: editor.getAttributes("textStyle").color || "#000" }}>A</span>
        </button>
        {showColorPicker === "text" && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 p-2 grid grid-cols-5 gap-1 w-fit">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { editor.chain().focus().setColor(c).run(); setShowColorPicker(null); }}
                className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowColorPicker(showColorPicker === "bg" ? null : "bg"); setShowFontMenu(false); setShowTableMenu(false); }}
          title="Color de fondo"
          className="p-1 rounded text-gray-500 hover:bg-gray-100"
        >
          <span className="text-xs font-bold bg-yellow-200 px-0.5">A</span>
        </button>
        {showColorPicker === "bg" && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 p-2 grid grid-cols-5 gap-1 w-fit">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setShowColorPicker(null); }}
                className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-gray-200 mx-0.5" />

      {/* Alignment */}
      {btn(editor.isActive({ textAlign: "left" }), () => editor.chain().focus().setTextAlign("left").run(), icon("M4 6h16M4 12h10M4 18h14"), "Izquierda")}
      {btn(editor.isActive({ textAlign: "center" }), () => editor.chain().focus().setTextAlign("center").run(), icon("M4 6h16M8 12h8M6 18h12"), "Centro")}
      {btn(editor.isActive({ textAlign: "right" }), () => editor.chain().focus().setTextAlign("right").run(), icon("M4 6h16M10 12h10M6 18h14"), "Derecha")}

      <div className="w-px h-4 bg-gray-200 mx-0.5" />

      {/* Lists */}
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), icon("M4 6h16M4 12h16M4 18h16"), "Lista")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <span className="text-[10px] font-mono">1.</span>, "Lista numerada")}
      {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), icon("M4 6h16M4 12h8M4 18h16"), "Cita")}

      <div className="w-px h-4 bg-gray-200 mx-0.5" />

      {/* Link */}
      {btn(editor.isActive("link"), () => {
        if (editor.isActive("link")) {
          editor.chain().focus().unsetLink().run();
        } else {
          const url = prompt("URL del enlace:");
          if (url) editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
        }
      }, icon("M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"), "Enlace")}

      {/* Image */}
      {btn(false, onInsertImage, icon("M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"), "Imagen inline")}

      {/* Table */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowTableMenu(!showTableMenu); setShowColorPicker(null); setShowFontMenu(false); }}
          title="Tabla"
          className="p-1 rounded text-gray-500 hover:bg-gray-100"
        >
          {icon("M3 10h18M3 14h18M3 6h18M3 18h18M10 6v12M17 6v12")}
        </button>
        {showTableMenu && (
          <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 py-1 w-44">
            <button type="button" onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run(); setShowTableMenu(false); }} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100">Insertar tabla 3×3</button>
            <button type="button" onClick={() => { editor.chain().focus().insertTable({ rows: 2, cols: 2 }).run(); setShowTableMenu(false); }} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100">Insertar tabla 2×2</button>
            {editor.can().deleteTable() && (
              <>
                <div className="border-t my-1" />
                <button type="button" onClick={() => { editor.chain().focus().addColumnAfter().run(); setShowTableMenu(false); }} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100">+ Columna</button>
                <button type="button" onClick={() => { editor.chain().focus().addRowAfter().run(); setShowTableMenu(false); }} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100">+ Fila</button>
                <button type="button" onClick={() => { editor.chain().focus().deleteColumn().run(); setShowTableMenu(false); }} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-red-500">- Columna</button>
                <button type="button" onClick={() => { editor.chain().focus().deleteRow().run(); setShowTableMenu(false); }} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-red-500">- Fila</button>
                <button type="button" onClick={() => { editor.chain().focus().deleteTable().run(); setShowTableMenu(false); }} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-red-500">Eliminar tabla</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Emoji */}
      {btn(false, onToggleEmoji, <span className="text-sm">😊</span>, "Emojis")}

      {/* Horizontal rule */}
      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), icon("M4 12h16"), "Línea horizontal")}
    </div>
  );
}

/* ── Emoji Picker (lazy loaded) ── */
function EmojiPicker({ onSelect }) {
  const [Picker, setPicker] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      import("@emoji-mart/react"),
      import("@emoji-mart/data"),
    ]).then(([pickerMod, dataMod]) => {
      setPicker(() => pickerMod.default);
      setData(dataMod.default);
    });
  }, []);

  if (!Picker || !data) return <div className="p-4 text-sm text-gray-400">Cargando emojis...</div>;

  return (
    <Picker
      data={data}
      onEmojiSelect={(emoji) => onSelect(emoji.native)}
      theme="light"
      locale="es"
      previewPosition="none"
      skinTonePosition="none"
      maxFrequentRows={1}
    />
  );
}

/* ── Attachment item ── */
function AttachmentItem({ file, onRemove }) {
  const isImage = file.type?.startsWith("image/");
  const isOversize = file.size > MAX_ATTACHMENT_SIZE;

  return (
    <div className={`flex items-center gap-2 border rounded-lg px-2.5 py-1.5 text-sm ${isOversize ? "border-red-300 bg-red-50" : "bg-gray-50"}`}>
      {isImage && file.preview ? (
        <img src={file.preview} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
      ) : (
        <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getFileIcon(file.type)} />
        </svg>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-gray-700">{file.name}</p>
        <p className={`text-[10px] ${isOversize ? "text-red-500 font-semibold" : "text-gray-400"}`}>
          {formatSize(file.size)} {isOversize && "— Excede 30 MB"}
        </p>
      </div>
      <button type="button" onClick={onRemove} className="text-gray-400 hover:text-red-500 flex-shrink-0">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ── Signature selector ── */
function SignatureSelector({ onSelect }) {
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/email/signatures")
      .then((r) => r.json())
      .then((d) => setSignatures(d.signatures || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !signatures.length) return null;

  return (
    <div className="border-t border-gray-200 px-3 py-1.5 bg-gray-50">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Firma:</span>
        {signatures.map((sig) => (
          <button
            key={sig.id}
            type="button"
            onClick={() => onSelect(sig.body_html)}
            className="text-xs text-[#0A1A44] hover:underline"
          >
            {sig.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Template selector ── */
function TemplateSelector({ onLoad, editorContent, subject }) {
  const [templates, setTemplates] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/email/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/email/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName, subject, body_html: editorContent }),
      });
      const res = await fetch("/api/email/templates");
      const d = await res.json();
      setTemplates(d.templates || []);
      setShowSave(false);
      setSaveName("");
    } catch {}
    setSaving(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
        title="Plantillas"
      >
        Plantillas ▾
      </button>
      {showMenu && (
        <div className="absolute bottom-full right-0 mb-1 bg-white border rounded-lg shadow-lg z-20 py-1 w-52">
          {templates.length > 0 && templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onLoad(t); setShowMenu(false); }}
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 truncate"
            >
              {t.name}
            </button>
          ))}
          {templates.length === 0 && (
            <p className="px-3 py-1.5 text-xs text-gray-400">Sin plantillas</p>
          )}
          <div className="border-t my-1" />
          {showSave ? (
            <div className="px-3 py-1.5 flex gap-1">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Nombre"
                className="flex-1 text-xs border rounded px-1.5 py-1 outline-none"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              <button type="button" onClick={handleSave} disabled={saving} className="text-xs text-[#0A1A44] font-semibold">
                {saving ? "..." : "OK"}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowSave(true)} className="block w-full text-left px-3 py-1.5 text-sm text-[#0A1A44] hover:bg-gray-100">
              + Guardar como plantilla
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Reply helpers ── */
// Given an email + the active mailbox, returns who should receive the reply.
// - Inbound mail → reply to the sender (from_email).
// - Outbound mail → reply to the original recipient (to_emails[0]).
//   (Otherwise the user would reply to themselves.)
function defaultReplyTo(email, ownAddress) {
  if (!email) return "";
  if (email.direction === "outbound") {
    const first = Array.isArray(email.to_emails) && email.to_emails[0];
    return (typeof first === "string" ? first : first?.email) || "";
  }
  return email.from_email || "";
}

// Collect every other participant of the original email for Reply All.
// Excludes (a) the person we already replied to, (b) ourselves, and
// dedups case-insensitively.
function replyAllCcList(email, primaryRecipient, ownAddress) {
  if (!email) return [];
  const normalize = (e) => (typeof e === "string" ? e : e?.email || "").toLowerCase().trim();
  const exclude = new Set(
    [primaryRecipient, ownAddress].filter(Boolean).map((s) => s.toLowerCase().trim())
  );
  const candidates = [
    ...(Array.isArray(email.to_emails) ? email.to_emails : []),
    ...(Array.isArray(email.cc) ? email.cc : []),
  ];
  const seen = new Set();
  const result = [];
  for (const c of candidates) {
    const addr = normalize(c);
    if (!addr || exclude.has(addr) || seen.has(addr)) continue;
    seen.add(addr);
    result.push(addr);
  }
  return result;
}

/* ── Main ComposeModal ── */
export default function ComposeModal({ isOpen, onClose, replyTo, forwardEmail, onSent, mailboxes, defaultFromAddress }) {
  const ownAddress = defaultFromAddress || "ventas@venezuelavoyages.com";
  const initialTo = defaultReplyTo(replyTo, ownAddress);
  const initialCcArr = replyTo?.replyAll ? replyAllCcList(replyTo, initialTo, ownAddress) : [];

  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState(initialCcArr.join(", "));
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(initialCcArr.length > 0);
  const [showBcc, setShowBcc] = useState(false);
  const [fromAddress, setFromAddress] = useState(ownAddress);
  const [subject, setSubject] = useState(() => {
    if (replyTo) return replyTo.subject?.startsWith("Re: ") ? replyTo.subject : `Re: ${replyTo.subject || ""}`;
    if (forwardEmail) return `Fwd: ${forwardEmail.subject || ""}`;
    return "";
  });
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const autoSaveTimer = useRef(null);
  const draftIdRef = useRef(null);
  // Track whether the user has actually typed something, to decide whether
  // closing the composer should ask for confirmation. Pre-filled values
  // from a reply do NOT count as touched; only user edits do.
  const [touched, setTouched] = useState(false);

  // Reset touched when the composer is freshly opened (replyTo / forward
  // transitions, or a brand-new compose).
  useEffect(() => {
    if (isOpen) setTouched(false);
  }, [isOpen, replyTo?.id, forwardEmail?.id]);

  // Defensive sync: every time the composer opens with a NEW replyTo /
  // forwardEmail, force the To / CC / Subject inputs to reflect that target.
  // useState's lazy initializer only runs on mount; if the component happens
  // to be reused between two reply targets (or replyTo arrives milliseconds
  // after isOpen flipped, due to React batching across components), the
  // fields would otherwise show the stale value (or the empty placeholder
  // as the user reported on 2026-06-09).
  useEffect(() => {
    if (!isOpen) return;
    if (replyTo) {
      const own = defaultFromAddress || "ventas@venezuelavoyages.com";
      const primary = defaultReplyTo(replyTo, own);
      setTo(primary);
      const ccArr = replyTo.replyAll ? replyAllCcList(replyTo, primary, own) : [];
      setCc(ccArr.join(", "));
      setShowCc(ccArr.length > 0);
      setSubject(
        replyTo.subject?.startsWith("Re: ")
          ? replyTo.subject
          : `Re: ${replyTo.subject || ""}`
      );
    } else if (forwardEmail) {
      setTo("");
      setCc("");
      setShowCc(false);
      setSubject(`Fwd: ${forwardEmail.subject || ""}`);
    } else {
      // Brand-new compose — leave whatever the user has typed alone.
    }
    // Only depend on the identifying fields so unrelated re-renders of the
    // parent don't wipe out user edits mid-compose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, replyTo?.id, forwardEmail?.id, defaultFromAddress]);

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
      LinkExt.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Escribe tu mensaje..." }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      Image.configure({ inline: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Subscript,
      Superscript,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3",
      },
    },
    onUpdate: () => setTouched(true),
  });

  /* ── Dropzone ── */
  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map((f) =>
      Object.assign(f, { preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null })
    );
    setAttachments((prev) => [...prev, ...newFiles]);
    setTouched(true);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  const removeAttachment = useCallback((index) => {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const totalSize = attachments.reduce((s, f) => s + f.size, 0);
  const oversized = totalSize > MAX_TOTAL_SIZE;

  /* ── Insert inline image ── */
  const handleInsertImage = useCallback(() => {
    const url = prompt("URL de la imagen:");
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  /* ── Emoji ── */
  const handleEmojiSelect = useCallback((native) => {
    if (editor) editor.chain().focus().insertContent(native).run();
    setShowEmoji(false);
  }, [editor]);

  /* ── Signature insert ── */
  const handleSignatureInsert = useCallback((html) => {
    if (!editor) return;
    editor.chain().focus().command(({ tr, state }) => {
      tr.insert(state.doc.content.size, state.schema.text("\n"));
      return true;
    }).insertContent(html).run();
  }, [editor]);

  /* ── Template load ── */
  const handleTemplateLoad = useCallback((template) => {
    if (template.subject) setSubject(template.subject);
    if (template.body_html && editor) {
      editor.commands.setContent(template.body_html);
    }
  }, [editor]);

  /* ── Draft auto-save (every 30s) ──
   *  Saves to the drafts folder including reply context (thread_id +
   *  in_reply_to + the parent email id) so the user can resume an
   *  unsent reply later. The first save creates the draft row; subsequent
   *  saves PATCH the same id so we don't pollute the drafts folder. */
  useEffect(() => {
    if (!isOpen) return;
    autoSaveTimer.current = setInterval(async () => {
      const html = editor?.getHTML() || "";
      const text = editor?.getText() || "";
      // Trivial bodies aren't worth a draft row
      if (!html || html === "<p></p>" || text.trim().length < 2) return;
      if (!touched) return;
      try {
        const toEmails = to.split(",").map((e) => e.trim()).filter(Boolean);
        const ccEmails = cc.split(",").map((e) => e.trim()).filter(Boolean);
        const bccEmails = bcc.split(",").map((e) => e.trim()).filter(Boolean);
        const payload = {
          to: toEmails,
          cc: ccEmails.length ? ccEmails : undefined,
          bcc: bccEmails.length ? bccEmails : undefined,
          subject,
          html,
          text,
          isDraft: true,
          from_address: fromAddress,
          in_reply_to: replyTo?.message_id || replyTo?.id || null,
          thread_id: replyTo?.thread_id || replyTo?.id || null,
          parent_email_id: replyTo?.id || forwardEmail?.id || null,
        };
        if (draftIdRef.current) {
          // Update existing draft
          await fetch(`/api/email/${draftIdRef.current}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subject,
              body_html: html,
              body_text: text,
              to_emails: toEmails.map((e) => ({ email: e })),
              cc: ccEmails.map((e) => ({ email: e })),
              bcc: bccEmails.map((e) => ({ email: e })),
            }),
          });
        } else {
          const res = await fetch("/api/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const j = await res.json().catch(() => ({}));
            if (j?.id) draftIdRef.current = j.id;
          }
        }
      } catch {}
    }, 30000);
    return () => clearInterval(autoSaveTimer.current);
  }, [isOpen, to, cc, bcc, subject, editor, replyTo, forwardEmail, fromAddress, touched]);

  /* Reset draft id when the composer transitions between targets */
  useEffect(() => {
    if (!isOpen) {
      draftIdRef.current = null;
    }
  }, [isOpen, replyTo?.id, forwardEmail?.id]);

  /* ── Send ── */
  const handleSend = useCallback(async () => {
    if (!to.trim() || oversized) return;
    setSending(true);
    try {
      const toEmails = to.split(",").map((e) => e.trim()).filter(Boolean);
      const ccEmails = cc.split(",").map((e) => e.trim()).filter(Boolean);
      const bccEmails = bcc.split(",").map((e) => e.trim()).filter(Boolean);
      const html = editor?.getHTML() || "";
      const text = editor?.getText() || "";

      // Convert attachments to base64 (FileReader is safe for large files;
      // String.fromCharCode(...) spread fails on arrays >~65k items)
      const fileToBase64 = (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            // result format: "data:<mime>;base64,<payload>"
            const result = reader.result;
            const base64 = typeof result === "string" ? result.split(",")[1] : "";
            resolve(base64);
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });

      const attPayload = await Promise.all(
        attachments.map(async (f) => {
          const base64 = await fileToBase64(f);
          return { filename: f.name, content: base64, type: f.type };
        })
      );

      const payload = { to: toEmails, subject, html, text, from_address: fromAddress };
      if (ccEmails.length) payload.cc = ccEmails;
      if (bccEmails.length) payload.bcc = bccEmails;
      if (attPayload.length) payload.attachments = attPayload;
      if (replyTo) {
        payload.in_reply_to = replyTo.message_id;
        payload.thread_id = replyTo.thread_id || replyTo.id;
      }

      const endpoint = replyTo ? `/api/email/${replyTo.id}/reply` : "/api/email";
      // For replies, send the FULL edited payload (the user may have changed
      // recipients, added CC/BCC, attached files). The backend uses these
      // verbatim instead of regenerating from the original.
      const replyBody = replyTo
        ? {
            html,
            text,
            replyAll: !!replyTo.replyAll,
            to: toEmails,
            cc: ccEmails.length ? ccEmails : undefined,
            bcc: bccEmails.length ? bccEmails : undefined,
            attachments: attPayload.length ? attPayload : undefined,
            from_address: fromAddress,
          }
        : payload;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(replyBody),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al enviar");
      }

      // Cleanup previews
      attachments.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
      onSent?.();
      onClose();
    } catch (error) {
      alert(error.message);
    } finally {
      setSending(false);
    }
  }, [to, cc, bcc, subject, editor, replyTo, attachments, oversized, onSent, onClose]);

  /* ── Save draft ── */
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

  /* ── Close with unsaved-changes guard ── */
  const handleClose = useCallback(() => {
    const hasText = !!editor && editor.getText().trim().length > 0;
    const hasRecipient = !!(to || cc || bcc);
    const hasSubject = !!subject;
    const hasAttachments = attachments.length > 0;
    const isDirty = touched && (hasText || hasRecipient || hasSubject || hasAttachments);
    if (isDirty) {
      const confirmClose = window.confirm(
        "Tienes cambios sin guardar. ¿Deseas descartar este mensaje?"
      );
      if (!confirmClose) return;
    }
    attachments.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    onClose();
  }, [touched, editor, to, cc, bcc, subject, attachments, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4" {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="absolute inset-0 bg-[#0A1A44]/20 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-[#0A1A44]">
          <p className="text-lg font-semibold text-[#0A1A44] bg-white/90 px-6 py-3 rounded-lg">
            Suelta los archivos aquí para adjuntar
          </p>
        </div>
      )}

      <div className="w-full max-w-2xl bg-white rounded-t-xl shadow-2xl border border-gray-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0A1A44] rounded-t-xl">
          <h3 className="text-white font-semibold text-sm">
            {replyTo ? "Responder" : forwardEmail ? "Reenviar" : "Nuevo mensaje"}
          </h3>
          <div className="flex items-center gap-1">
            <TemplateSelector
              onLoad={handleTemplateLoad}
              editorContent={editor?.getHTML() || ""}
              subject={subject}
            />
            <button onClick={handleDraft} className="text-white/70 hover:text-white text-xs px-2 py-1">
              Borrador
            </button>
            <button onClick={handleClose} className="text-white/70 hover:text-white" title="Cerrar">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="border-b border-gray-200 text-sm">
          {/* From selector */}
          {mailboxes?.length > 0 && (
            <div className="flex items-center px-4 py-1.5 border-b border-gray-100">
              <span className="text-gray-500 w-12">De:</span>
              <select
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                className="flex-1 text-sm outline-none bg-transparent"
              >
                {mailboxes.map((mb) => (
                  <option key={mb.id} value={mb.address}>
                    {mb.display_name || mb.name} &lt;{mb.address}&gt;
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center px-4 py-1.5 border-b border-gray-100">
            <span className="text-gray-500 w-12">Para:</span>
            <RecipientInput value={to} onChange={(v) => { setTo(v); setTouched(true); }} placeholder="email@ejemplo.com" />
            <div className="flex gap-1">
              {!showCc && <button type="button" onClick={() => setShowCc(true)} className="text-xs text-gray-400 hover:text-gray-600">CC</button>}
              {!showBcc && <button type="button" onClick={() => setShowBcc(true)} className="text-xs text-gray-400 hover:text-gray-600">BCC</button>}
            </div>
          </div>
          {showCc && (
            <div className="flex items-center px-4 py-1.5 border-b border-gray-100">
              <span className="text-gray-500 w-12">CC:</span>
              <RecipientInput value={cc} onChange={(v) => { setCc(v); setTouched(true); }} placeholder="email@ejemplo.com" />
            </div>
          )}
          {showBcc && (
            <div className="flex items-center px-4 py-1.5 border-b border-gray-100">
              <span className="text-gray-500 w-12">BCC:</span>
              <RecipientInput value={bcc} onChange={(v) => { setBcc(v); setTouched(true); }} placeholder="email@ejemplo.com" />
            </div>
          )}
          <div className="flex items-center px-4 py-1.5">
            <span className="text-gray-500 w-12">Asunto:</span>
            <input type="text" value={subject} onChange={(e) => { setSubject(e.target.value); setTouched(true); }} placeholder="Asunto del correo" className="flex-1 outline-none text-sm" />
          </div>
        </div>

        {/* Toolbar */}
        <EditorToolbar
          editor={editor}
          onInsertImage={handleInsertImage}
          onToggleEmoji={() => setShowEmoji(!showEmoji)}
        />

        {/* Emoji picker */}
        {showEmoji && (
          <div className="absolute bottom-20 right-8 z-50 shadow-xl rounded-lg overflow-hidden">
            <EmojiPicker onSelect={handleEmojiSelect} />
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          <EditorContent editor={editor} />
        </div>

        {/* Signature */}
        <SignatureSelector onSelect={handleSignatureInsert} />

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="border-t border-gray-200 px-3 py-2 bg-gray-50 max-h-32 overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{attachments.length} adjunto(s) — {formatSize(totalSize)}</span>
              {oversized && <span className="text-xs text-red-500 font-semibold">Excede el límite de 30 MB</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((f, i) => (
                <AttachmentItem key={`${f.name}-${i}`} file={f} onRemove={() => removeAttachment(i)} />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openFileDialog}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
              title="Adjuntar archivo"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Adjuntar
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !to.trim() || oversized}
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
