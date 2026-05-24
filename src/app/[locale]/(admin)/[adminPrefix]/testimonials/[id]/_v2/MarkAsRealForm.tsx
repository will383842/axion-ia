"use client";
// use-client: useState + form onSubmit handler require browser DOM.

// Sprint v7 Phase 15 (F5) — wiring UI MVP `markAsRealTestimonial`.
//
// Petit formulaire d'authentification d'un testimonial (Source URL +
// Date de consentement + Verifié par optionnel). Bind sur server action
// wrapper qui appelle `markAsRealTestimonial` (Sentry + revalidatePath FR
// presse + admin testimonials gérés côté action).
//
// Doctrine v2.1 : on n'invente JAMAIS de données. Champs vides = la source
// reste non vérifiable, l'admin doit fournir une URL vérifiable + date
// de consentement RGPD signée hors-app.

import { useActionState } from "react";
import { markAsRealTestimonialFormAction, type MarkAsRealState } from "./mark-as-real-action";

const init: MarkAsRealState = { ok: false, error: "" };

interface Props {
  testimonialId: string;
  currentRealMeta: {
    source?: string;
    consentDate?: string;
    verifiedBy?: string;
  } | null;
}

export function MarkAsRealForm({ testimonialId, currentRealMeta }: Props) {
  const [state, formAction, pending] = useActionState(markAsRealTestimonialFormAction, init);
  const isAlreadyReal = currentRealMeta !== null;

  return (
    <form action={formAction} className="admin-form">
      <input type="hidden" name="testimonialId" value={testimonialId} />

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="source" className="admin-label">
            Source vérifiable (URL) *
          </label>
          <input
            id="source"
            name="source"
            type="url"
            required
            maxLength={500}
            defaultValue={currentRealMeta?.source ?? ""}
            placeholder="https://linkedin.com/in/... ou https://example.com/page-temoignage"
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="consentDate" className="admin-label">
            Date du consentement RGPD *
          </label>
          <input
            id="consentDate"
            name="consentDate"
            type="date"
            required
            defaultValue={currentRealMeta?.consentDate?.slice(0, 10) ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="verifiedBy" className="admin-label">
            Vérifié par (optionnel)
          </label>
          <input
            id="verifiedBy"
            name="verifiedBy"
            type="text"
            maxLength={120}
            defaultValue={currentRealMeta?.verifiedBy ?? ""}
            placeholder="ex: Will (compliance)"
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      {state.ok ? (
        <p role="status" className="admin-alert admin-alert-success">
          ✓ Testimonial marqué comme authentifié.
        </p>
      ) : state.error ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="admin-button">
        {pending
          ? "Enregistrement..."
          : isAlreadyReal
            ? "Mettre à jour l'authentification"
            : "Marquer comme authentifié"}
      </button>
    </form>
  );
}
