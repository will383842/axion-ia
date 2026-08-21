"use client";
// use-client: useEditor hook Tiptap + state pour bind html/json/text avec hidden inputs form.

import { EditorContent, useEditor } from "@tiptap/react";
import { Quote } from "lucide-react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";

interface Props {
  /**
   * Prefix des inputs hidden. Sprint 24 / C4 : 3 sources canoniques sont
   * exposees au form au lieu d'un seul HTML :
   *   - `${name}_html` : HTML rendu (source rendu cote consumer).
   *   - `${name}_json` : JSON Tiptap (reuse RSS/AMP/AI, edit precis cote admin).
   *   - `${name}_text` : texte plain (search FTS, OG description fallback).
   * Les Server Actions doivent lire `${name}_html` pour le rendu et
   * persister _json + _text en sus.
   */
  name: string;
  /** HTML initial (pour edit). */
  initialHtml?: string;
  /** Placeholder pour quand vide. */
  placeholder?: string;
  /**
   * Le libellé VISIBLE du champ, tel qu'il est écrit au-dessus de l'éditeur.
   *
   * 🔴 `D7-2-A1` (2026-08-21) — sans lui, la zone d'édition s'annonçait aux
   * lecteurs d'écran par son PLACEHOLDER : « Rédigez l'article… » au lieu de
   * « Corps ». Un placeholder dit ce qu'il faut FAIRE, pas ce qu'on est en
   * train de remplir — et il disparaît dès la première frappe, y compris de la
   * restitution vocale. Quand il n'y en avait pas, le champ s'annonçait
   * « Editeur de contenu », ce qui ne distingue pas deux éditeurs d'un même
   * formulaire.
   *
   * ⚠️ Les `<label>` posés au-dessus de ces éditeurs n'étaient associés à RIEN :
   * un éditeur riche n'est pas un contrôle étiquetable, `htmlFor` ne s'y
   * accroche pas. Ils avaient l'apparence d'une étiquette sans en avoir
   * l'effet — c'est « une protection décrite mais absente », appliqué à
   * l'accessibilité.
   */
  label?: string;
}

/**
 * Editor Tiptap minimal V1 (StarterKit = bold/italic/h1-h6/lists/blockquote/
 * code/hr/strike/underline natifs). M9 v2 : ajouter Image + Link + Table.
 *
 * Pattern form integration : on bind 3 inputs hidden au lieu d'un seul.
 * Voir Props.name pour la convention de nommage.
 *
 * SSR-safe : Tiptap v3 avec immediatelyRender:false ne touche pas au DOM
 * jusqu'au commit phase, evite mismatch hydration sans `mounted` state.
 */
export function TiptapEditor({ name, initialHtml = "", placeholder, label }: Props) {
  const [html, setHtml] = useState(initialHtml);
  const [json, setJson] = useState<string>("");
  const [text, setText] = useState<string>("");
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialHtml,
    immediatelyRender: false, // SSR-safe per Tiptap v3 docs
    onUpdate: ({ editor: e }) => {
      setHtml(e.getHTML());
      setJson(JSON.stringify(e.getJSON()));
      setText(e.getText());
    },
    editorProps: {
      attributes: {
        class: "tiptap-content",
        // Le libellé d'abord, le placeholder ensuite : l'un dit CE QUE C'EST,
        // l'autre ce qu'il faut y écrire. Le repli générique reste en dernier
        // recours plutôt qu'une zone d'édition sans nom du tout.
        "aria-label": label ?? placeholder ?? "Éditeur de contenu",
        // ⚠️ Un `contenteditable` nu n'a pas de rôle de formulaire : sans ces
        // deux attributs, un lecteur d'écran annonce un groupe de texte et non
        // un champ de saisie multiligne.
        role: "textbox",
        "aria-multiline": "true",
      },
    },
  });

  return (
    <div className="tiptap-wrapper">
      <input type="hidden" name={`${name}_html`} value={html} />
      <input type="hidden" name={`${name}_json`} value={json} />
      <input type="hidden" name={`${name}_text`} value={text} />
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
            • Liste
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive("orderedList") ? "tiptap-btn-active" : ""}
            aria-label="Liste numerotee"
          >
            1. Liste
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive("blockquote") ? "tiptap-btn-active" : ""}
            aria-label="Citation"
          >
            <Quote size={15} aria-hidden="true" />
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
