"use client";
// use-client: useActionState + useState pour tabs FR/EN + Tiptap bind.

import { useActionState, useState } from "react";
import {
  upsertHelpArticleAction,
  type UpsertHelpArticleState,
} from "@/features/admin-help/actions";
import { TiptapEditor } from "@/components/admin/TiptapEditor";

const init: UpsertHelpArticleState = { ok: false, error: "" };

interface CategoryOption {
  id: string;
  slug: string;
  nameFr: string;
}
interface TranslationInitial {
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
}
interface Initial {
  id: string;
  categoryId: string | null;
  isTutorial: boolean;
  status: string;
  publishedAt: Date | null;
  fr: TranslationInitial;
  en: TranslationInitial;
}

interface Props {
  categories: ReadonlyArray<CategoryOption>;
  initial?: Initial;
}

export function HelpForm({ categories, initial }: Props) {
  const [state, formAction, pending] = useActionState(upsertHelpArticleAction, init);
  const [activeLocale, setActiveLocale] = useState<"fr" | "en">("fr");

  return (
    <form action={formAction} className="admin-form">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="status" className="admin-label">
            Statut
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "draft"}
            className="admin-input"
            disabled={pending}
          >
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
            <option value="archived">Archivé</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="publishedAt" className="admin-label">
            Date publication
          </label>
          <input
            id="publishedAt"
            name="publishedAt"
            type="datetime-local"
            defaultValue={
              initial?.publishedAt ? initial.publishedAt.toISOString().slice(0, 16) : ""
            }
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="categoryId" className="admin-label">
            Catégorie
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={initial?.categoryId ?? ""}
            className="admin-input"
            disabled={pending}
          >
            <option value="">— (aucune)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameFr}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="isTutorial" className="admin-label">
            Type
          </label>
          <label className="admin-checkbox-label">
            <input
              id="isTutorial"
              name="isTutorial"
              type="checkbox"
              defaultChecked={initial?.isTutorial ?? false}
              disabled={pending}
            />
            <span>📘 Tutoriel (balisage HowTo)</span>
          </label>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          type="button"
          onClick={() => setActiveLocale("fr")}
          className={activeLocale === "fr" ? "admin-tab admin-tab-active" : "admin-tab"}
        >
          Contenu FR
        </button>
        <button
          type="button"
          onClick={() => setActiveLocale("en")}
          className={activeLocale === "en" ? "admin-tab admin-tab-active" : "admin-tab"}
        >
          Contenu EN
        </button>
      </div>

      <div className={activeLocale === "fr" ? "admin-tab-content" : "admin-tab-content-hidden"}>
        <HelpTranslationFields prefix="fr" initial={initial?.fr} disabled={pending} />
      </div>
      <div className={activeLocale === "en" ? "admin-tab-content" : "admin-tab-content-hidden"}>
        <HelpTranslationFields prefix="en" initial={initial?.en} disabled={pending} />
      </div>

      {state.ok ? (
        <p role="status" className="admin-alert admin-alert-success">
          ✓ {state.created ? "Article créé" : "Article mis à jour"}.
        </p>
      ) : state.error ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="admin-button">
        {pending ? "Enregistrement..." : initial?.id ? "Mettre à jour" : "Créer"}
      </button>
    </form>
  );
}

function HelpTranslationFields({
  prefix,
  initial,
  disabled,
}: {
  prefix: "fr" | "en";
  initial: TranslationInitial | undefined;
  disabled: boolean;
}) {
  return (
    <>
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor={`${prefix}_title`} className="admin-label">
            Titre
          </label>
          <input
            id={`${prefix}_title`}
            name={`${prefix}_title`}
            type="text"
            required
            defaultValue={initial?.title ?? ""}
            className="admin-input"
            disabled={disabled}
          />
        </div>
        <div className="admin-field">
          <label htmlFor={`${prefix}_slug`} className="admin-label">
            Slug
          </label>
          <input
            id={`${prefix}_slug`}
            name={`${prefix}_slug`}
            type="text"
            required
            pattern="[a-z0-9-]+"
            defaultValue={initial?.slug ?? ""}
            className="admin-input"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="admin-field">
        <label htmlFor={`${prefix}_excerpt`} className="admin-label">
          Chapeau
        </label>
        <textarea
          id={`${prefix}_excerpt`}
          name={`${prefix}_excerpt`}
          rows={2}
          maxLength={500}
          defaultValue={initial?.excerpt ?? ""}
          className="admin-input admin-textarea"
          disabled={disabled}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label">Corps</label>
        <TiptapEditor
          name={`${prefix}_body`}
          initialHtml={initial?.body ?? ""}
          placeholder={prefix === "fr" ? "Rédigez l'article…" : "Rédigez l'article…"}
        />
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor={`${prefix}_metaTitle`} className="admin-label">
            Meta title (max 70)
          </label>
          <input
            id={`${prefix}_metaTitle`}
            name={`${prefix}_metaTitle`}
            type="text"
            maxLength={70}
            defaultValue={initial?.metaTitle ?? ""}
            className="admin-input"
            disabled={disabled}
          />
        </div>
        <div className="admin-field">
          <label htmlFor={`${prefix}_metaDescription`} className="admin-label">
            Meta description (max 160)
          </label>
          <input
            id={`${prefix}_metaDescription`}
            name={`${prefix}_metaDescription`}
            type="text"
            maxLength={160}
            defaultValue={initial?.metaDescription ?? ""}
            className="admin-input"
            disabled={disabled}
          />
        </div>
      </div>
    </>
  );
}
