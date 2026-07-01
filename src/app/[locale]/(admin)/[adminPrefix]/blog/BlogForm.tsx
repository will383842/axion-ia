"use client";
// use-client: useActionState + useState pour wizard tabs FR/EN + Tiptap editor bind.

import { useActionState, useState } from "react";
import { upsertArticleAction, type UpsertArticleState } from "@/features/admin-blog/actions";
import { TiptapEditor } from "@/components/admin/TiptapEditor";

const init: UpsertArticleState = { ok: false, error: "" };

interface SelectOption {
  id: string;
  slug: string;
  name: string;
}
interface TagOption {
  id: string;
  slug: string;
  nameFr: string;
}

interface ArticleInitial {
  id: string;
  authorId: string | null;
  categoryId: string | null;
  featuredImage: string | null;
  status: string;
  publishedAt: Date | null;
  readingTime: number | null;
  commentsEnabled: boolean;
  tagIds: string[];
  fr: TranslationInitial;
  en: TranslationInitial;
}
interface TranslationInitial {
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
}

interface Props {
  authors: ReadonlyArray<SelectOption>;
  categories: ReadonlyArray<SelectOption>;
  tags: ReadonlyArray<TagOption>;
  initial?: ArticleInitial;
}

export function BlogForm({ authors, categories, tags, initial }: Props) {
  const [state, formAction, pending] = useActionState(upsertArticleAction, init);
  const [activeLocale, setActiveLocale] = useState<"fr" | "en">("fr");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(initial?.tagIds ?? []));

  function toggleTag(tagId: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  return (
    <form action={formAction} className="admin-form">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      {/* Bloc structurel */}
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
          <label htmlFor="readingTime" className="admin-label">
            Temps lecture (min)
          </label>
          <input
            id="readingTime"
            name="readingTime"
            type="number"
            min={0}
            defaultValue={initial?.readingTime ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="commentsEnabled" className="admin-label">
            Commentaires
          </label>
          <label className="admin-checkbox-label">
            <input
              id="commentsEnabled"
              name="commentsEnabled"
              type="checkbox"
              defaultChecked={initial?.commentsEnabled ?? false}
              disabled={pending}
            />
            <span>Activer</span>
          </label>
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="authorId" className="admin-label">
            Auteur
          </label>
          <select
            id="authorId"
            name="authorId"
            defaultValue={initial?.authorId ?? ""}
            className="admin-input"
            disabled={pending}
          >
            <option value="">— (non assigné)</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
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
            <option value="">— (non assignée)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="featuredImage" className="admin-label">
            Image de couverture (URL)
          </label>
          <input
            id="featuredImage"
            name="featuredImage"
            type="url"
            defaultValue={initial?.featuredImage ?? ""}
            className="admin-input"
            disabled={pending}
            placeholder="https://…"
          />
        </div>
      </div>

      {/* Tags */}
      <div className="admin-field">
        <label className="admin-label">Tags ({selectedTags.size} sélectionnés)</label>
        <div className="admin-tags-grid">
          {tags.map((t) => (
            <label key={t.id} className="admin-tag-checkbox">
              <input
                type="checkbox"
                name="tagIds"
                value={t.id}
                checked={selectedTags.has(t.id)}
                onChange={() => toggleTag(t.id)}
                disabled={pending}
              />
              <span>{t.nameFr}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Tabs FR / EN */}
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

      {/* FR content (toujours render mais display:none si tab inactive — pour preserver state) */}
      <div className={activeLocale === "fr" ? "admin-tab-content" : "admin-tab-content-hidden"}>
        <TranslationFields prefix="fr" initial={initial?.fr} disabled={pending} />
      </div>
      <div className={activeLocale === "en" ? "admin-tab-content" : "admin-tab-content-hidden"}>
        <TranslationFields prefix="en" initial={initial?.en} disabled={pending} />
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

function TranslationFields({
  prefix,
  initial,
  disabled,
}: {
  prefix: "fr" | "en";
  initial: TranslationInitial | undefined;
  disabled: boolean;
}) {
  const labels =
    prefix === "fr"
      ? { title: "Titre", slug: "Slug", excerpt: "Chapeau", body: "Corps de l'article" }
      : { title: "Titre", slug: "Slug", excerpt: "Chapeau", body: "Corps de l'article" };

  return (
    <>
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor={`${prefix}_title`} className="admin-label">
            {labels.title}
          </label>
          <input
            id={`${prefix}_title`}
            name={`${prefix}_title`}
            type="text"
            required
            minLength={3}
            maxLength={255}
            defaultValue={initial?.title ?? ""}
            className="admin-input"
            disabled={disabled}
          />
        </div>
        <div className="admin-field">
          <label htmlFor={`${prefix}_slug`} className="admin-label">
            {labels.slug}
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
          {labels.excerpt}
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
        <label className="admin-label">{labels.body}</label>
        <TiptapEditor
          name={`${prefix}_body`}
          initialHtml={initial?.body ?? ""}
          placeholder={prefix === "fr" ? "Rédigez l'article…" : "Rédigez l'article…"}
        />
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor={`${prefix}_metaTitle`} className="admin-label">
            Méta-titre (max 70)
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
            Méta-description (max 160)
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
        <div className="admin-field">
          <label htmlFor={`${prefix}_ogImage`} className="admin-label">
            URL de l'image OG
          </label>
          <input
            id={`${prefix}_ogImage`}
            name={`${prefix}_ogImage`}
            type="url"
            defaultValue={initial?.ogImage ?? ""}
            className="admin-input"
            disabled={disabled}
          />
        </div>
      </div>
    </>
  );
}
