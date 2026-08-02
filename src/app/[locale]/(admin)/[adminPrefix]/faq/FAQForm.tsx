"use client";
// use-client: useActionState bind upsertFAQAction.

import { useActionState } from "react";
import { upsertFAQAction, type UpsertFAQState } from "@/features/admin-faq/actions";

const init: UpsertFAQState = { ok: false, error: "" };

interface Props {
  initial?: {
    id: string;
    slug: string;
    category: string;
    status: string;
    questionFr: string;
    questionEn: string;
    answerFr: string;
    answerEn: string;
    metaTitle: string | null;
    metaDescription: string | null;
    displayOrder: number;
  };
}

export function FAQForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState(upsertFAQAction, init);
  return (
    <form action={formAction} className="admin-form">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="slug" className="admin-label">
            Slug (URL)
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            pattern="[a-z0-9-]+"
            defaultValue={initial?.slug ?? ""}
            className="admin-input"
            disabled={pending}
            placeholder="ex: comment-reserver-essentielle"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="category" className="admin-label">
            Catégorie
          </label>
          <select
            id="category"
            name="category"
            defaultValue={initial?.category ?? "general"}
            className="admin-input"
            disabled={pending}
          >
            <option value="general">Général</option>
            <option value="interventions">Interventions</option>
            <option value="implementation">Implémentation</option>
            <option value="audit">Audit</option>
            <option value="pricing">Tarifs</option>
            <option value="process">Processus</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="displayOrder" className="admin-label">
            Ordre
          </label>
          <input
            id="displayOrder"
            name="displayOrder"
            type="number"
            min={0}
            defaultValue={initial?.displayOrder ?? 0}
            className="admin-input"
            disabled={pending}
          />
        </div>
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
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="questionFr" className="admin-label">
            Question (FR)
          </label>
          <input
            id="questionFr"
            name="questionFr"
            type="text"
            required
            minLength={5}
            maxLength={500}
            defaultValue={initial?.questionFr ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="questionEn" className="admin-label">
            Question (EN)
          </label>
          <input
            id="questionEn"
            name="questionEn"
            type="text"
            required
            minLength={5}
            maxLength={500}
            defaultValue={initial?.questionEn ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      <div className="admin-field">
        <label htmlFor="answerFr" className="admin-label">
          Réponse (FR) — texte libre
        </label>
        <textarea
          id="answerFr"
          name="answerFr"
          required
          rows={6}
          minLength={10}
          defaultValue={initial?.answerFr ?? ""}
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="answerEn" className="admin-label">
          Réponse (EN) — texte libre
        </label>
        <textarea
          id="answerEn"
          name="answerEn"
          required
          rows={6}
          minLength={10}
          defaultValue={initial?.answerEn ?? ""}
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="metaTitle" className="admin-label">
            Meta title (SEO, max 70 caractères) — optionnel
          </label>
          <input
            id="metaTitle"
            name="metaTitle"
            type="text"
            maxLength={70}
            defaultValue={initial?.metaTitle ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="metaDescription" className="admin-label">
            Meta description (SEO, max 160) — optionnel
          </label>
          <input
            id="metaDescription"
            name="metaDescription"
            type="text"
            maxLength={160}
            defaultValue={initial?.metaDescription ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      {state.ok ? (
        <p role="status" className="admin-alert admin-alert-success">
          {state.created ? "Question créée" : "Question mise à jour"}.
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
