"use client";
// use-client: formulaire interactif (état React multi-champs, upload CV, Turnstile, honeypot, soumission async).
// Candidature à une offre d'emploi — mono-page segmenté (PAS de wizard, cf. plan D8) :
// meilleur pour l'upload CV, le budget INP et le sans-JS. Soumet via
// submitJobApplicationAction (multipart) → JobApplication + Telegram + email + RGPD.

import * as React from "react";
import { useLocale } from "next-intl";
import { Check } from "lucide-react";
import { submitJobApplicationAction } from "@/features/job-application/actions";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { HoneypotField } from "@/components/forms/HoneypotField";

const FIELD =
  "border-border bg-bg focus:border-terracotta focus:ring-terracotta/20 w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-4";
const LABEL = "text-fg mb-1.5 block text-sm font-medium";
const SECTION = "font-serif text-xl font-semibold border-l-4 border-terracotta pl-3 leading-tight";

export interface ScreeningQuestion {
  id: string;
  labelFr?: string;
  labelEn?: string;
  required?: boolean;
}

interface Props {
  offerId: string;
  offerTitle: string;
  requiresDriverLicense: boolean;
  requiresVehicle: boolean;
  screeningQuestions: ScreeningQuestion[];
}

export function JobApplicationForm({
  offerId,
  offerTitle,
  requiresDriverLicense,
  requiresVehicle,
  screeningQuestions,
}: Props) {
  const locale = useLocale();
  const isFr = locale === "fr";
  const cvRef = React.useRef<HTMLInputElement>(null);
  const [cvName, setCvName] = React.useState<string>("");
  const photoRef = React.useRef<HTMLInputElement>(null);
  const [photoName, setPhotoName] = React.useState<string>("");
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [consent, setConsent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
  } = useTurnstileToken("job-application");

  const showMobility = requiresDriverLicense || requiresVehicle;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError(isFr ? "Merci d'accepter le traitement RGPD." : "Please accept the GDPR terms.");
      return;
    }
    const form = e.currentTarget;
    const cvFile = cvRef.current?.files?.[0];
    if (cvFile && cvFile.size > 8 * 1024 * 1024) {
      setError(isFr ? "CV trop volumineux (8 Mo max)." : "CV too large (8 MB max).");
      return;
    }
    const photoFile = photoRef.current?.files?.[0];
    if (photoFile && photoFile.size > 5 * 1024 * 1024) {
      setError(isFr ? "Photo trop volumineuse (5 Mo max)." : "Photo too large (5 MB max).");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData(form);
      fd.set("offerId", offerId);
      fd.set("locale", locale);
      fd.set("consent", "true");
      if (turnstileToken) fd.set("cf-turnstile-response", turnstileToken);

      const result = await submitJobApplicationAction({ ok: false, error: "" }, fd);
      if (!result.ok) {
        resetTurnstile();
        setError(result.error || (isFr ? "Une erreur est survenue." : "Something went wrong."));
        return;
      }
      setDone(result.applicationId || "");
    } catch {
      setError(
        isFr ? "Une erreur est survenue. Réessayez." : "Something went wrong. Please retry.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done !== null) {
    return (
      <div
        className="bg-paper border-terracotta/30 shadow-card rounded-3xl border-2 p-8 sm:p-10"
        role="status"
      >
        <div className="bg-halo-warm border-terracotta/30 mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5">
          <Check aria-hidden="true" strokeWidth={3} className="text-terracotta-deep h-4 w-4" />
          <span className="text-terracotta-deep text-sm font-semibold">
            {isFr ? "Candidature envoyée 🎉" : "Application sent 🎉"}
          </span>
        </div>
        <p className="text-fg text-lg">
          {isFr
            ? "Merci ! On a bien reçu ta candidature et on revient vers toi rapidement."
            : "Thanks! We've received your application and will get back to you shortly."}
        </p>
        {done ? <p className="text-fg-muted mt-2 font-mono text-xs">Réf. {done}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" encType="multipart/form-data">
      <HoneypotField />
      <input type="hidden" name="offerId" value={offerId} />

      {/* 1. Toi & contact */}
      <fieldset className="space-y-4">
        <legend className={SECTION}>{isFr ? "👋 Toi & contact" : "👋 You & contact"}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="civility" className={LABEL}>
              {isFr ? "Civilité" : "Title"}
            </label>
            <select id="civility" name="civility" className={FIELD} disabled={submitting}>
              <option value="">—</option>
              <option value="Mme">{isFr ? "Mme" : "Ms"}</option>
              <option value="M.">{isFr ? "M." : "Mr"}</option>
              <option value="Autre">{isFr ? "Autre" : "Other"}</option>
            </select>
          </div>
          <div>
            <label htmlFor="firstName" className={LABEL}>
              {isFr ? "Prénom *" : "First name *"}
            </label>
            <input
              id="firstName"
              name="firstName"
              required
              maxLength={100}
              className={FIELD}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="lastName" className={LABEL}>
              {isFr ? "Nom *" : "Last name *"}
            </label>
            <input
              id="lastName"
              name="lastName"
              required
              maxLength={100}
              className={FIELD}
              disabled={submitting}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="email" className={LABEL}>
              {isFr ? "Email *" : "Email *"}
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
          </div>
          <div>
            <label htmlFor="phone" className={LABEL}>
              {isFr ? "Téléphone *" : "Phone *"}
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              maxLength={40}
              className={FIELD}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="city" className={LABEL}>
              {isFr ? "Ville / code postal *" : "City / ZIP *"}
            </label>
            <input
              id="city"
              name="city"
              required
              maxLength={120}
              className={FIELD}
              disabled={submitting}
            />
          </div>
        </div>
      </fieldset>

      {/* 2. Mobilité (conditionnel) */}
      {showMobility ? (
        <fieldset className="space-y-4">
          <legend className={SECTION}>{isFr ? "🚗 Mobilité" : "🚗 Mobility"}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {requiresDriverLicense ? (
              <div>
                <label htmlFor="hasDriverLicense" className={LABEL}>
                  {isFr ? "Permis de conduire" : "Driver's license"}
                </label>
                <select
                  id="hasDriverLicense"
                  name="hasDriverLicense"
                  className={FIELD}
                  disabled={submitting}
                >
                  <option value="">—</option>
                  <option value="true">{isFr ? "Oui" : "Yes"}</option>
                  <option value="false">{isFr ? "Non" : "No"}</option>
                </select>
              </div>
            ) : null}
            {requiresVehicle ? (
              <div>
                <label htmlFor="hasVehicle" className={LABEL}>
                  {isFr ? "Véhicule personnel" : "Personal vehicle"}
                </label>
                <select id="hasVehicle" name="hasVehicle" className={FIELD} disabled={submitting}>
                  <option value="">—</option>
                  <option value="true">{isFr ? "Oui" : "Yes"}</option>
                  <option value="false">{isFr ? "Non" : "No"}</option>
                </select>
              </div>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      {/* 3. Profil + questions de l'offre */}
      <fieldset className="space-y-4">
        <legend className={SECTION}>{isFr ? "💼 Ton profil" : "💼 Your profile"}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="currentRole" className={LABEL}>
              {isFr ? "Poste / expérience actuelle" : "Current role / experience"}
            </label>
            <input
              id="currentRole"
              name="currentRole"
              maxLength={200}
              className={FIELD}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="experienceBand" className={LABEL}>
              {isFr ? "Années d'expérience" : "Years of experience"}
            </label>
            <select
              id="experienceBand"
              name="experienceBand"
              className={FIELD}
              disabled={submitting}
            >
              <option value="">—</option>
              <option value="0-2">0–2</option>
              <option value="2-5">2–5</option>
              <option value="5-10">5–10</option>
              <option value="10+">10+</option>
            </select>
          </div>
          <div>
            <label htmlFor="availability" className={LABEL}>
              {isFr ? "Disponibilité" : "Availability"}
            </label>
            <input
              id="availability"
              name="availability"
              maxLength={120}
              className={FIELD}
              disabled={submitting}
              placeholder={isFr ? "immédiate, préavis…" : "immediate, notice…"}
            />
          </div>
          <div>
            <label htmlFor="linkedinUrl" className={LABEL}>
              {isFr ? "LinkedIn / portfolio" : "LinkedIn / portfolio"}
            </label>
            <input
              id="linkedinUrl"
              name="linkedinUrl"
              type="url"
              maxLength={255}
              className={FIELD}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="salaryExpectation" className={LABEL}>
              {isFr ? "Prétention de revenus — optionnel" : "Salary expectation — optional"}
            </label>
            <input
              id="salaryExpectation"
              name="salaryExpectation"
              maxLength={80}
              className={FIELD}
              disabled={submitting}
              placeholder={isFr ? "ex. 35–42 k€ brut/an" : "e.g. 35–42 k€ gross/yr"}
            />
          </div>
        </div>

        {screeningQuestions.map((q) => (
          <div key={q.id}>
            <label htmlFor={`answer_${q.id}`} className={LABEL}>
              {(isFr ? q.labelFr : q.labelEn) ?? q.labelFr ?? q.labelEn}
              {q.required ? " *" : ""}
            </label>
            <textarea
              id={`answer_${q.id}`}
              name={`answer_${q.id}`}
              required={q.required}
              rows={3}
              maxLength={2000}
              className={FIELD}
              disabled={submitting}
              value={answers[q.id] ?? ""}
              onChange={(ev) => setAnswers((p) => ({ ...p, [q.id]: ev.target.value }))}
            />
          </div>
        ))}
      </fieldset>

      {/* 4. Pour finir */}
      <fieldset className="space-y-4">
        <legend className={SECTION}>{isFr ? "🚀 Pour finir" : "🚀 Finishing up"}</legend>
        <div>
          <label htmlFor="cv" className={LABEL}>
            {isFr ? "CV (PDF, DOC, DOCX) — optionnel" : "CV (PDF, DOC, DOCX) — optional"}
          </label>
          <input
            id="cv"
            name="cv"
            type="file"
            accept=".pdf,.doc,.docx"
            ref={cvRef}
            className="text-sm"
            disabled={submitting}
            onChange={(ev) => setCvName(ev.target.files?.[0]?.name ?? "")}
          />
          {cvName ? (
            <p className="text-fg-muted mt-1 text-xs">
              {isFr ? "Sélectionné :" : "Selected:"} {cvName}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="photo" className={LABEL}>
            {isFr ? "Photo (JPG, PNG) — optionnel" : "Photo (JPG, PNG) — optional"}
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
          <p className="text-fg-muted mt-1 text-xs">
            {isFr
              ? "Totalement facultative — ne pas en mettre ne te pénalise pas."
              : "Entirely optional — leaving it out won't penalise you."}
          </p>
          {photoName ? (
            <p className="text-fg-muted mt-1 text-xs">
              {isFr ? "Sélectionnée :" : "Selected:"} {photoName}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="motivation" className={LABEL}>
            {isFr ? "Dis-nous un petit mot sur toi 👋" : "Tell us a bit about you 👋"}
          </label>
          <textarea
            id="motivation"
            name="motivation"
            rows={4}
            maxLength={4000}
            className={FIELD}
            disabled={submitting}
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(ev) => setConsent(ev.target.checked)}
            className="mt-1"
            disabled={submitting}
          />
          <span>
            {isFr
              ? `J'accepte que mes données (et mon CV) soient traitées par Axion-IA pour le suivi de ma candidature à « ${offerTitle} » (RGPD).`
              : `I agree that my data (and CV) be processed by Axion-IA to handle my application to "${offerTitle}" (GDPR).`}
          </span>
        </label>
      </fieldset>

      {turnstileWidget}

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="bg-terracotta hover:bg-terracotta-deep inline-flex items-center gap-2 rounded-full px-6 py-3 font-medium text-white transition-colors disabled:opacity-60"
      >
        {submitting
          ? isFr
            ? "Envoi…"
            : "Sending…"
          : isFr
            ? "Envoyer ma candidature"
            : "Send my application"}
      </button>
    </form>
  );
}
