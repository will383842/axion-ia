"use client";
// use-client: useActionState bind upsertTestimonialAction.

import { useActionState } from "react";
import {
  upsertTestimonialAction,
  type UpsertTestimonialState,
} from "@/features/admin-testimonials/actions";

const init: UpsertTestimonialState = { ok: false, error: "" };

interface Props {
  initial?: {
    id: string;
    slug: string;
    status: string;
    firstName: string;
    lastName: string;
    role: string | null;
    company: string | null;
    sector: string | null;
    companySize: string | null;
    shortQuoteFr: string;
    shortQuoteEn: string;
    fullQuoteFr: string | null;
    fullQuoteEn: string | null;
    rating: number | null;
    photoUrl: string | null;
    videoUrl: string | null;
    module: string | null;
    resultHighlight: string | null;
    displayOrder: number;
  };
}

export function TestimonialForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState(upsertTestimonialAction, init);
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
            defaultValue={initial?.slug ?? ""}
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
            defaultValue={initial?.status ?? "pending"}
            className="admin-input"
            disabled={pending}
          >
            <option value="pending">En attente</option>
            <option value="published">Publié</option>
            <option value="refused">Refusé</option>
            <option value="archived">Archivé</option>
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
          <label htmlFor="rating" className="admin-label">
            Note (1-5)
          </label>
          <input
            id="rating"
            name="rating"
            type="number"
            min={1}
            max={5}
            defaultValue={initial?.rating ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="firstName" className="admin-label">
            Prénom
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            defaultValue={initial?.firstName ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="lastName" className="admin-label">
            Nom
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            defaultValue={initial?.lastName ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="role" className="admin-label">
            Rôle
          </label>
          <input
            id="role"
            name="role"
            type="text"
            defaultValue={initial?.role ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="company" className="admin-label">
            Société
          </label>
          <input
            id="company"
            name="company"
            type="text"
            defaultValue={initial?.company ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="sector" className="admin-label">
            Secteur
          </label>
          <input
            id="sector"
            name="sector"
            type="text"
            defaultValue={initial?.sector ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="companySize" className="admin-label">
            Taille
          </label>
          <input
            id="companySize"
            name="companySize"
            type="text"
            placeholder="ex: 10-49"
            defaultValue={initial?.companySize ?? ""}
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
            <option value="">—</option>
            <option value="intervention">Intervention</option>
            <option value="implementation">Implémentation</option>
            <option value="audit">Audit</option>
          </select>
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="shortQuoteFr" className="admin-label">
            Citation courte (FR)
          </label>
          <textarea
            id="shortQuoteFr"
            name="shortQuoteFr"
            required
            rows={3}
            minLength={10}
            maxLength={500}
            defaultValue={initial?.shortQuoteFr ?? ""}
            className="admin-input admin-textarea"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="shortQuoteEn" className="admin-label">
            Citation courte (EN)
          </label>
          <textarea
            id="shortQuoteEn"
            name="shortQuoteEn"
            required
            rows={3}
            minLength={10}
            maxLength={500}
            defaultValue={initial?.shortQuoteEn ?? ""}
            className="admin-input admin-textarea"
            disabled={pending}
          />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="fullQuoteFr" className="admin-label">
            Citation longue (FR) — optionnel
          </label>
          <textarea
            id="fullQuoteFr"
            name="fullQuoteFr"
            rows={5}
            maxLength={2000}
            defaultValue={initial?.fullQuoteFr ?? ""}
            className="admin-input admin-textarea"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="fullQuoteEn" className="admin-label">
            Citation longue (EN) — optionnel
          </label>
          <textarea
            id="fullQuoteEn"
            name="fullQuoteEn"
            rows={5}
            maxLength={2000}
            defaultValue={initial?.fullQuoteEn ?? ""}
            className="admin-input admin-textarea"
            disabled={pending}
          />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="resultHighlight" className="admin-label">
            Résultat chiffré (highlight)
          </label>
          <input
            id="resultHighlight"
            name="resultHighlight"
            type="text"
            placeholder="ex: -32% temps admin"
            defaultValue={initial?.resultHighlight ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="photoUrl" className="admin-label">
            Photo URL
          </label>
          <input
            id="photoUrl"
            name="photoUrl"
            type="url"
            defaultValue={initial?.photoUrl ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="videoUrl" className="admin-label">
            Vidéo URL
          </label>
          <input
            id="videoUrl"
            name="videoUrl"
            type="url"
            defaultValue={initial?.videoUrl ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      {state.ok ? (
        <p role="status" className="admin-alert admin-alert-success">
          ✓ {state.created ? "Témoignage créé" : "Témoignage mis à jour"}.
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
