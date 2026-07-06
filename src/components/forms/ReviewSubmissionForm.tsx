"use client";
// use-client: formulaire interactif (note étoiles, compteur de commentaire, upload
// photo optionnel, Turnstile, honeypot, soumission async). Dépose un avis client →
// submitReviewAction → CustomerReview (status "pending") + Telegram + email + RGPD.
// L’avis N’EST PAS publié : il attend la modération admin.

import * as React from "react";
import { useLocale } from "next-intl";
import { Check, Star } from "lucide-react";
import { submitReviewAction } from "@/features/review-submission/actions";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { CLIENT_SECTORS } from "@/content/sectors";
import { SERVICE_LINES } from "@/lib/reviews/service-lines";
import { REVIEW_COMMENT_MIN, REVIEW_COMMENT_MAX } from "@/lib/schemas/review-submission-schema";

const FIELD =
  "border-border bg-bg focus:border-terracotta focus:ring-terracotta/20 w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-4";
const LABEL = "text-fg mb-1.5 block text-sm font-medium";
const SECTION = "font-serif text-xl font-semibold border-l-4 border-terracotta pl-3 leading-tight";

/** Sélecteur de note accessible (radios stylés en étoiles). */
function RatingInput({ disabled }: { disabled: boolean }) {
  const [value, setValue] = React.useState(0);
  return (
    <fieldset className="space-y-1.5">
      <legend className={LABEL}>Votre note *</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="focus-within:ring-terracotta/40 hover:bg-sand/60 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md focus-within:ring-2"
          >
            <input
              type="radio"
              name="rating"
              value={n}
              required
              disabled={disabled}
              checked={value === n}
              onChange={() => setValue(n)}
              className="sr-only"
            />
            <Star
              aria-hidden="true"
              className={
                n <= value ? "text-terracotta fill-current" : "text-border-strong fill-transparent"
              }
              strokeWidth={1.75}
              width={28}
              height={28}
            />
            <span className="sr-only">
              {n} étoile{n > 1 ? "s" : ""} sur 5
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewSubmissionForm() {
  const locale = useLocale();
  const isFr = locale === "fr";
  const photoRef = React.useRef<HTMLInputElement>(null);
  const [photoName, setPhotoName] = React.useState("");
  const [commentLen, setCommentLen] = React.useState(0);
  const [consent, setConsent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
  } = useTurnstileToken("review");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Merci d’accepter le traitement RGPD.");
      return;
    }
    if (commentLen < REVIEW_COMMENT_MIN) {
      setError(`Votre avis doit contenir au moins ${REVIEW_COMMENT_MIN} caractères.`);
      return;
    }
    const form = e.currentTarget;
    const photoFile = photoRef.current?.files?.[0];
    if (photoFile && photoFile.size > 5 * 1024 * 1024) {
      setError("Photo trop volumineuse (5 Mo max).");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData(form);
      fd.set("locale", locale);
      fd.set("consent", "true");
      if (turnstileToken) fd.set("cf-turnstile-response", turnstileToken);
      const result = await submitReviewAction({ ok: false, error: "" }, fd);
      if (!result.ok) {
        resetTurnstile();
        setError(result.error || "Une erreur est survenue.");
        return;
      }
      setDone(true);
    } catch {
      setError("Une erreur est survenue. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        className="bg-paper border-terracotta/30 shadow-card rounded-3xl border-2 p-8 sm:p-10"
        role="status"
      >
        <div className="bg-halo-warm border-terracotta/30 mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5">
          <Check aria-hidden="true" strokeWidth={3} className="text-terracotta-deep h-4 w-4" />
          <span className="text-terracotta-deep text-sm font-semibold">Avis reçu — merci ! 🙏</span>
        </div>
        <p className="text-fg text-lg">
          Votre avis a bien été enregistré. Il sera publié après une vérification de notre équipe
          (nous contrôlons l’authenticité de chaque avis avant mise en ligne).
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" encType="multipart/form-data">
      <HoneypotField />

      {/* 1. Votre note + votre avis */}
      <fieldset className="space-y-4">
        <legend className={SECTION}>⭐ Votre avis</legend>
        <RatingInput disabled={submitting} />
        <div>
          <label htmlFor="title" className={LABEL}>
            Titre (optionnel)
          </label>
          <input
            id="title"
            name="title"
            maxLength={160}
            className={FIELD}
            disabled={submitting}
            placeholder="En quelques mots…"
          />
        </div>
        <div>
          <label htmlFor="comment" className={LABEL}>
            Votre retour d’expérience *
          </label>
          <textarea
            id="comment"
            name="comment"
            required
            rows={6}
            minLength={REVIEW_COMMENT_MIN}
            maxLength={REVIEW_COMMENT_MAX}
            className={FIELD}
            disabled={submitting}
            onChange={(ev) => setCommentLen(ev.target.value.trim().length)}
            placeholder="Décrivez votre expérience avec Axion-IA : le contexte, ce qui a été fait, les résultats obtenus…"
          />
          <p
            className={`mt-1 text-xs ${commentLen < REVIEW_COMMENT_MIN ? "text-fg-muted" : "text-sage"}`}
            aria-live="polite"
          >
            {commentLen < REVIEW_COMMENT_MIN
              ? `Encore ${REVIEW_COMMENT_MIN - commentLen} caractère(s) minimum.`
              : `${commentLen} / ${REVIEW_COMMENT_MAX} caractères ✓`}
          </p>
        </div>
      </fieldset>

      {/* 2. Vous & votre entreprise */}
      <fieldset className="space-y-4">
        <legend className={SECTION}>👤 Vous</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="firstName" className={LABEL}>
              Prénom *
            </label>
            <input
              id="firstName"
              name="firstName"
              required
              maxLength={80}
              className={FIELD}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="lastName" className={LABEL}>
              Nom *
            </label>
            <input
              id="lastName"
              name="lastName"
              required
              maxLength={80}
              className={FIELD}
              disabled={submitting}
            />
            <p className="text-fg-muted mt-1 text-xs">
              Seule l’initiale sera affichée publiquement (ex. « Marie D. »).
            </p>
          </div>
          <div>
            <label htmlFor="email" className={LABEL}>
              Email *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={180}
              className={FIELD}
              disabled={submitting}
            />
            <p className="text-fg-muted mt-1 text-xs">Jamais publié — sert à vérifier l’avis.</p>
          </div>
          <div>
            <label htmlFor="companyName" className={LABEL}>
              Entreprise
            </label>
            <input
              id="companyName"
              name="companyName"
              maxLength={200}
              className={FIELD}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="clientSector" className={LABEL}>
              Secteur d’activité
            </label>
            <select id="clientSector" name="clientSector" className={FIELD} disabled={submitting}>
              <option value="">—</option>
              {CLIENT_SECTORS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.emoji} {s.labelFr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="city" className={LABEL}>
              Ville
            </label>
            <input id="city" name="city" maxLength={120} className={FIELD} disabled={submitting} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="serviceLine" className={LABEL}>
              Service concerné
            </label>
            <select id="serviceLine" name="serviceLine" className={FIELD} disabled={submitting}>
              <option value="">—</option>
              {SERVICE_LINES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.labelFr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      {/* 3. Photo optionnelle */}
      <fieldset className="space-y-4">
        <legend className={SECTION}>📷 Photo (facultative)</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="photo" className={LABEL}>
              Portrait ou logo (JPG, PNG, WebP) — optionnel
            </label>
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/*"
              ref={photoRef}
              className="text-sm"
              disabled={submitting}
              onChange={(ev) => setPhotoName(ev.target.files?.[0]?.name ?? "")}
            />
            {photoName ? (
              <p className="text-fg-muted mt-1 text-xs">Sélectionnée : {photoName}</p>
            ) : (
              <p className="text-fg-muted mt-1 text-xs">
                Sans photo, un avatar Axion-IA sera généré automatiquement.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="photoKind" className={LABEL}>
              Type de photo
            </label>
            <select id="photoKind" name="photoKind" className={FIELD} disabled={submitting}>
              <option value="portrait">Portrait</option>
              <option value="logo">Logo d’entreprise</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* 4. Consentement */}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(ev) => setConsent(ev.target.checked)}
          className="mt-1 h-4 w-4"
          disabled={submitting}
        />
        <span>
          J’accepte que mon avis et mes données soient traités par Axion-IA pour publication après
          modération, conformément au RGPD. Je certifie être un client réel.
        </span>
      </label>

      {turnstileWidget}

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="bg-terracotta hover:bg-terracotta-deep inline-flex h-11 items-center gap-2 rounded-full px-6 font-medium text-white transition-colors disabled:opacity-60"
      >
        {submitting ? "Envoi…" : "Publier mon avis"}
      </button>
      <p className="text-fg-muted text-xs">
        {isFr
          ? "Votre avis sera vérifié par notre équipe avant publication."
          : "Your review will be checked by our team before publication."}
      </p>
    </form>
  );
}
