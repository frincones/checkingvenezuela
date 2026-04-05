"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useEffect, useCallback, useRef } from "react";

const btnCls = (active) =>
  `px-2 py-1 rounded text-sm font-medium transition-colors ${
    active
      ? "bg-primary text-white"
      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
  }`;

const sepCls = "w-px h-6 bg-gray-300 mx-1";

function Toolbar({ editor }) {
  const addLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href;
    const url = prompt("URL del enlace:", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = prompt("URL de la imagen:");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const setColor = useCallback(
    (e) => {
      if (!editor) return;
      editor.chain().focus().setColor(e.target.value).run();
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2 rounded-t-md">
      {/* Text style */}
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnCls(editor.isActive("bold"))} title="Negrita">
        <b>B</b>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnCls(editor.isActive("italic"))} title="Cursiva">
        <i>I</i>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnCls(editor.isActive("underline"))} title="Subrayado">
        <u>U</u>
      </button>

      <div className={sepCls} />

      {/* Headings */}
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnCls(editor.isActive("heading", { level: 2 }))} title="Título H2">
        H2
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnCls(editor.isActive("heading", { level: 3 }))} title="Título H3">
        H3
      </button>

      <div className={sepCls} />

      {/* Lists */}
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnCls(editor.isActive("bulletList"))} title="Lista con viñetas">
        &bull; Lista
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnCls(editor.isActive("orderedList"))} title="Lista numerada">
        1. Lista
      </button>

      <div className={sepCls} />

      {/* Alignment */}
      <button type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={btnCls(editor.isActive({ textAlign: "left" }))} title="Alinear izquierda">
        &#8676;
      </button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={btnCls(editor.isActive({ textAlign: "center" }))} title="Centrar">
        &#8596;
      </button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={btnCls(editor.isActive({ textAlign: "right" }))} title="Alinear derecha">
        &#8677;
      </button>

      <div className={sepCls} />

      {/* Link & Image */}
      <button type="button" onClick={addLink} className={btnCls(editor.isActive("link"))} title="Enlace">
        &#128279; Link
      </button>
      <button type="button" onClick={addImage} className={btnCls(false)} title="Imagen">
        &#128247; Imagen
      </button>

      <div className={sepCls} />

      {/* Color */}
      <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer" title="Color de texto">
        A
        <input type="color" onChange={setColor} value={editor.getAttributes("textStyle").color || "#000000"} className="h-5 w-5 cursor-pointer border-0 p-0" />
      </label>

      {/* Blockquote */}
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnCls(editor.isActive("blockquote"))} title="Cita">
        &ldquo; Cita
      </button>
    </div>
  );
}

export default function TipTapEditor({ content, onChange }) {
  const isSettingContent = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: "Escribe el contenido del post..." }),
      Superscript,
      Subscript,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: content || "",
    onUpdate: ({ editor }) => {
      if (!isSettingContent.current) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3",
      },
    },
  });

  // Sync external content changes (e.g. when loading post data)
  useEffect(() => {
    if (editor && content !== undefined && content !== editor.getHTML()) {
      isSettingContent.current = true;
      editor.commands.setContent(content || "");
      isSettingContent.current = false;
    }
  }, [content, editor]);

  return (
    <div className="rounded-md border border-gray-300 shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
