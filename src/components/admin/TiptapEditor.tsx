"use client";
// use-client: useEditor hook Tiptap + state pour bind html avec hidden input form.

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";

interface Props {
  /** name de l'input hidden — sera lu cote Server Action via formData.get(name). */
  name: string;
  /** HTML initial (pour edit). */
  initialHtml?: string;
  /** Placeholder pour quand vide. */
  placeholder?: string;
}

/**
 * Editor Tiptap minimal V1 (StarterKit = bold/italic/h1-h6/lists/blockquote/
 * code/hr/strike/underline natifs). M9 v2 : ajouter Image + Link + Table.
 *
 * Pattern form integration : on bind editor.getHTML() a un input hidden
 * portant `name` — quand le form submit, le HTML est envoye au server.
 *
 * SSR-safe : Tiptap v3 avec immediatelyRender:false ne touche pas au DOM
 * jusqu'au commit phase, evite mismatch hydration sans `mounted` state.
 */
export function TiptapEditor({ name, initialHtml = "", placeholder }: Props) {
  const [html, setHtml] = useState(initialHtml);
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialHtml,
    immediatelyRender: false, // SSR-safe per Tiptap v3 docs
    onUpdate: ({ editor: e }) => setHtml(e.getHTML()),
    editorProps: {
      attributes: {
        class: "tiptap-content",
        "aria-label": placeholder ?? "Editeur de contenu",
      },
    },
  });

  return (
    <div className="tiptap-wrapper">
      <input type="hidden" name={name} value={html} />
      {editor && (
        <div className="tiptap-toolbar">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "tiptap-btn-active" : ""}
            aria-label="Gras"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "tiptap-btn-active" : ""}
            aria-label="Italique"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive("strike") ? "tiptap-btn-active" : ""}
            aria-label="Barré"
          >
            <s>S</s>
          </button>
          <span className="tiptap-divider" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive("heading", { level: 2 }) ? "tiptap-btn-active" : ""}
            aria-label="Titre H2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={editor.isActive("heading", { level: 3 }) ? "tiptap-btn-active" : ""}
            aria-label="Titre H3"
          >
            H3
          </button>
          <span className="tiptap-divider" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive("bulletList") ? "tiptap-btn-active" : ""}
            aria-label="Liste a puces"
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive("orderedList") ? "tiptap-btn-active" : ""}
            aria-label="Liste numerotee"
          >
            1. List
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive("blockquote") ? "tiptap-btn-active" : ""}
            aria-label="Citation"
          >
            ❝
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={editor.isActive("code") ? "tiptap-btn-active" : ""}
            aria-label="Code inline"
          >
            &lt;/&gt;
          </button>
          <span className="tiptap-divider" />
          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            aria-label="Separateur horizontal"
          >
            —
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            aria-label="Annuler"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            aria-label="Refaire"
          >
            ↷
          </button>
        </div>
      )}
      <EditorContent editor={editor} className="tiptap-editor" />
    </div>
  );
}
