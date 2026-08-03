"use client";
// use-client: useActionState bind upsertCategoryAction.

import { useActionState } from "react";
import {
  upsertCategoryAction,
  type UpsertCategoryState,
} from "@/features/admin-categories/actions";

const init: UpsertCategoryState = { ok: false, error: "" };

interface ParentOption {
  id: string;
  slug: string;
  nameFr: string;
  module: string | null;
}

interface Props {
  parents: ReadonlyArray<ParentOption>;
  initial?: {
    id: string;
    slug: string;
    nameFr: string;
    nameEn: string;
    descriptionFr: string | null;
    descriptionEn: string | null;
    parentId: string | null;
    module: string | null;
    icon: string | null;
    colorAccent: string | null;
    displayOrder: number;
    status: string;
    seoTitleFr: string | null;
    seoTitleEn: string | null;
    seoDescFr: string | null;
    seoDescEn: string | null;
    pageContentFr: string | null;
    pageContentEn: string | null;
  };
}

export function CategoryForm({ parents, initial }: Props) {
  const [state, formAction, pending] = useActionState(upsertCategoryAction, init);
  return (
    <form action={formAction} className="admin-form">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="slug" className="admin-label">
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            pattern="[a-z0-9-]+"
            title="Minuscules, chiffres et tirets uniquement — sans espace ni accent."
            defaultValue={initial?.slug ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="module" className="admin-label">
            Module
          </label>
          <select
            id="module"
            name="module"
            defaultValue={initial?.module ?? ""}
            className="admin-input"
            disabled={pending}
          >
            <option value="">— (Blog)</option>
            <option value="intervention">Intervention</option>
            <option value="implementation">Implémentation</option>
            <option value="audit">Audit</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="parentId" className="admin-label">
            Parent
          </label>
          <select
            id="parentId"
            name="parentId"
            defaultValue={initial?.parentId ?? ""}
            className="admin-input"
            disabled={pending}
          >
            <option value="">— (racine)</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameFr} ({p.slug})
              </option>
            ))}
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
            defaultValue={initial?.status ?? "published"}
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
          <label htmlFor="nameFr" className="admin-label">
            Nom (FR)
          </label>
          <input
            id="nameFr"
            name="nameFr"
            type="text"
            required
            defaultValue={initial?.nameFr ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="nameEn" className="admin-label">
            Nom (EN)
          </label>
          <input
            id="nameEn"
            name="nameEn"
            type="text"
            required
            defaultValue={initial?.nameEn ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="descriptionFr" className="admin-label">
            Description (FR)
          </label>
          <textarea
            id="descriptionFr"
            name="descriptionFr"
            rows={3}
            defaultValue={initial?.descriptionFr ?? ""}
            className="admin-input admin-textarea"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="descriptionEn" className="admin-label">
            Description (EN)
          </label>
          <textarea
            id="descriptionEn"
            name="descriptionEn"
            rows={3}
            defaultValue={initial?.descriptionEn ?? ""}
            className="admin-input admin-textarea"
            disabled={pending}
          />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="icon" className="admin-label">
            Icône (nom lucide-react)
          </label>
          <input
            id="icon"
            name="icon"
            type="text"
            placeholder="ex: users-round"
            defaultValue={initial?.icon ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="colorAccent" className="admin-label">
            Couleur accent (#RRGGBB) — optionnel
          </label>
          <input
            id="colorAccent"
            name="colorAccent"
            type="text"
            pattern="#[0-9a-fA-F]{6}"
            title="Un dièse suivi de six caractères hexadécimaux, au format #RRGGBB."
            placeholder="#RRGGBB" // hex-ok: placeholder texte d'aide
            defaultValue={initial?.colorAccent ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      <details className="admin-details">
        <summary className="admin-details-summary">SEO + page dédiée (optionnel)</summary>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="seoTitleFr" className="admin-label">
              SEO title FR (max 70)
            </label>
            <input
              id="seoTitleFr"
              name="seoTitleFr"
              type="text"
              maxLength={70}
              defaultValue={initial?.seoTitleFr ?? ""}
              className="admin-input"
              disabled={pending}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="seoTitleEn" className="admin-label">
              SEO title EN (max 70)
            </label>
            <input
              id="seoTitleEn"
              name="seoTitleEn"
              type="text"
              maxLength={70}
              defaultValue={initial?.seoTitleEn ?? ""}
              className="admin-input"
              disabled={pending}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="seoDescFr" className="admin-label">
              SEO description FR (max 160)
            </label>
            <input
              id="seoDescFr"
              name="seoDescFr"
              type="text"
              maxLength={160}
              defaultValue={initial?.seoDescFr ?? ""}
              className="admin-input"
              disabled={pending}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="seoDescEn" className="admin-label">
              SEO description EN (max 160)
            </label>
            <input
              id="seoDescEn"
              name="seoDescEn"
              type="text"
              maxLength={160}
              defaultValue={initial?.seoDescEn ?? ""}
              className="admin-input"
              disabled={pending}
            />
          </div>
        </div>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="pageContentFr" className="admin-label">
              Contenu page dédiée (FR) — HTML brut
            </label>
            <textarea
              id="pageContentFr"
              name="pageContentFr"
              rows={5}
              defaultValue={initial?.pageContentFr ?? ""}
              className="admin-input admin-textarea"
              disabled={pending}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="pageContentEn" className="admin-label">
              Contenu page dédiée (EN) — HTML brut
            </label>
            <textarea
              id="pageContentEn"
              name="pageContentEn"
              rows={5}
              defaultValue={initial?.pageContentEn ?? ""}
              className="admin-input admin-textarea"
              disabled={pending}
            />
          </div>
        </div>
      </details>

      {state.ok ? (
        <p role="status" className="admin-alert admin-alert-success">
          {state.created ? "Catégorie créée" : "Catégorie mise à jour"}.
        </p>
      ) : state.error ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="admin-button">
        {pending ? "Enregistrement…" : initial?.id ? "Mettre à jour" : "Créer"}
      </button>
    </form>
  );
}
