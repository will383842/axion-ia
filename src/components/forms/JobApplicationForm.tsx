"use client";
// use-client: formulaire interactif (état React multi-champs, upload CV, Turnstile, honeypot, soumission async).
// Candidature à une offre d'emploi — mono-page segmenté (PAS de wizard, cf. plan D8) :
// meilleur pour l'upload CV, le budget INP et le sans-JS. Soumet via
// submitJobApplicationAction (multipart) → JobApplication + Telegram + email + RGPD.

import * as React from "react";
import { useLocale } from "next-intl";
import { Check, FileUp, ImageUp, X } from "lucide-react";
import { submitJobApplicationAction } from "@/features/job-application/actions";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { HoneypotField } from "@/components/forms/HoneypotField";

const FIELD =
  "border-border bg-bg focus:border-terracotta focus:ring-terracotta/20 w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-4";
const LABEL = "text-fg mb-1.5 block text-sm font-medium";
const SECTION = "font-serif text-xl font-semibold border-l-4 border-terracotta pl-3 leading-tight";

/**
 * 🔴 `min-w-0` sur CHAQUE `<fieldset>` — ce n'est pas cosmétique.
 *
 * La feuille de style du navigateur pose `min-inline-size: min-content` sur
 * `fieldset`, et sur lui seul. Un `fieldset` REFUSE donc de descendre sous la
 * largeur minimale de son contenu, quoi qu'en dise son parent.
 *
 * Mesuré le 2026-08-22 sur `/fr/carrieres/<offre>/postuler` en 360 px : le
 * champ `<input type="file">` natif de Chrome mesure 312 px incompressibles
 * (bouton « Choisir un fichier » + « Aucun fichier sélectionné »). Le fieldset
 * se calait donc à 312 px dans un `<form>` de 246 px, et toute la colonne
 * partait 9 px au-delà du bord droit de l'écran — 49 px en 320 px. Comme la
 * `<section>` porte `overflow-hidden`, le débordement n'était pas
 * scrollable : le texte était COUPÉ, pas déplaçable. C'est ce que voit un
 * candidat sur un téléphone d'entrée de gamme.
 *
 * Le champ fichier est corrigé plus bas (patron `sr-only` + label stylé), mais
 * `min-w-0` reste la garde structurelle : le jour où un enfant large revient
 * (tableau, `<pre>`, embed), c'est lui qui empêchera le fieldset de pousser
 * toute la page hors de l'écran.
 */
const FIELDSET = "min-w-0 space-y-4";

/**
 * Déclencheur de sélection de fichier — patron repris À L'IDENTIQUE de
 * `ReviewSubmissionForm` (même dépôt, déjà en production).
 *
 * Le `<input type="file">` natif est masqué en `sr-only` (présent pour le
 * clavier et les lecteurs d'écran, invisible et sans largeur imposée), et
 * c'est ce `<label htmlFor>` qui est vu et touché. Deux gains :
 *   1. il se plie à la largeur disponible — plus aucun plancher de 312 px ;
 *   2. c'est une cible tactile pleine largeur au lieu du petit bouton natif,
 *      ce que demande un formulaire pensé pour le téléphone d'abord.
 */
const FILE_TRIGGER =
  "border-terracotta/45 bg-terracotta-soft/40 text-terracotta-deep hover:bg-terracotta-soft hover:border-terracotta focus-within:ring-terracotta/30 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3.5 text-center text-sm font-semibold shadow-sm transition-colors focus-within:ring-4";

export interface ScreeningQuestion {
  id: string;
  labelFr?: string;
  labelEn?: string;
  required?: boolean;
}

interface Props {
  offerId: string;
  requiresDriverLicense: boolean;
  requiresVehicle: boolean;
  screeningQuestions: ScreeningQuestion[];
}

export function JobApplicationForm({
  offerId,
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
  // Accord VIVIER — optionnel, et donc `false` au départ. Une case pré-cochée
  // ne serait pas un consentement (RGPD art. 4.11 : « acte positif clair »).
  const [consentVivier, setConsentVivier] = React.useState(false);
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
      // Les cases n'ont pas d'attribut `name` (motif existant du formulaire) :
      // les valeurs sont posées explicitement ici.
      fd.set("consentVivier", consentVivier ? "true" : "false");
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
      <fieldset className={FIELDSET}>
        <legend className={SECTION}>{isFr ? "👋 Toi & contact" : "👋 You & contact"}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="civility" className={LABEL}>
              {isFr ? "Civilité" : "Title"}
            </label>
            {/* Facultative, et AUCUNE valeur présélectionnée : la CJUE
                (Mousse c. SNCF, C-394/23, janvier 2025) a jugé que collecter
                systématiquement la civilité n'est pas « nécessaire à
                l'exécution du contrat ». Un champ vide par défaut est la
                preuve qu'il ne l'est pas.
                Les valeurs STOCKÉES restent « Mme » et « M. » : les
                candidatures déjà en base les utilisent, et changer la valeur
                rendrait les anciennes lignes incohérentes avec les nouvelles.
                Seuls les libellés affichés sont en toutes lettres. */}
            <select id="civility" name="civility" className={FIELD} disabled={submitting}>
              <option value="">{isFr ? "— non précisé" : "— not specified"}</option>
              <option value="Mme">{isFr ? "Madame" : "Ms"}</option>
              <option value="M.">{isFr ? "Monsieur" : "Mr"}</option>
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
        <fieldset className={FIELDSET}>
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
      <fieldset className={FIELDSET}>
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
              placeholder={
                isFr
                  ? "ex. 35–42 k€ brut/an" /* price-exempt: fourchette salariale marché candidat, pas un prix Axion-IA */
                  : "e.g. 35–42 k€ gross/yr" /* price-exempt: market salary range, not an Axion-IA price */
              }
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
      <fieldset className={FIELDSET}>
        <legend className={SECTION}>{isFr ? "🚀 Pour finir" : "🚀 Finishing up"}</legend>
        <div>
          {/* `<span>` et non `<label>` : le libellé de section ne doit pas
              voler le `for` au déclencheur ci-dessous, sinon un clic dessus
              ouvrirait le sélecteur de fichiers sans qu'on l'ait demandé. */}
          <span className={LABEL}>
            {isFr ? "CV (PDF, DOC, DOCX) — optionnel" : "CV (PDF, DOC, DOCX) — optional"}
          </span>
          <label
            htmlFor="cv"
            className={`${FILE_TRIGGER} ${submitting ? "pointer-events-none opacity-60" : ""}`}
          >
            <FileUp aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2} />
            {cvName
              ? isFr
                ? "Changer de CV"
                : "Change CV"
              : isFr
                ? "Choisir mon CV"
                : "Choose my CV"}
          </label>
          <input
            id="cv"
            name="cv"
            type="file"
            accept=".pdf,.doc,.docx"
            ref={cvRef}
            className="sr-only"
            disabled={submitting}
            onChange={(ev) => setCvName(ev.target.files?.[0]?.name ?? "")}
          />
          {cvName ? (
            <p className="text-fg-soft mt-2 flex items-center gap-1.5 text-xs">
              <Check
                aria-hidden="true"
                className="text-sage h-3.5 w-3.5 shrink-0"
                strokeWidth={2.5}
              />
              {/* `truncate` + `min-w-0` : un nom de fichier n'a pas d'espace où
                  se couper. Sans ça, « Mon-CV-Prenom-Nom-2026-version-finale.pdf »
                  ressortait de la carte au lieu de s'abréger. */}
              <span className="min-w-0 truncate font-medium">{cvName}</span>
              <button
                type="button"
                onClick={() => {
                  if (cvRef.current) cvRef.current.value = "";
                  setCvName("");
                }}
                className="text-fg-muted hover:text-terracotta ml-auto inline-flex shrink-0 items-center gap-0.5"
                aria-label={isFr ? "Retirer le CV" : "Remove CV"}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" /> {isFr ? "retirer" : "remove"}
              </button>
            </p>
          ) : null}
        </div>
        <div>
          <span className={LABEL}>
            {isFr
              ? "Photo (JPG, PNG, WebP, HEIC) — facultative"
              : "Photo (JPG, PNG, WebP, HEIC) — optional"}
          </span>
          {/* `accept` aligné sur ce que le serveur valide réellement
              (`validatePhoto`). Avec `image/*`, le sélecteur laissait choisir
              un GIF ou un AVIF : le fichier partait, puis était refusé APRÈS
              le téléversement. Sur mobile, c'est plusieurs mégaoctets envoyés
              en 4G pour un message d'erreur — le genre de friction qui fait
              abandonner une candidature.
              HEIC est explicite : c'est le format par défaut des iPhone. */}
          <label
            htmlFor="photo"
            className={`${FILE_TRIGGER} ${submitting ? "pointer-events-none opacity-60" : ""}`}
          >
            <ImageUp aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2} />
            {photoName
              ? isFr
                ? "Changer la photo"
                : "Change photo"
              : isFr
                ? "Choisir une photo"
                : "Choose a photo"}
          </label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            ref={photoRef}
            className="sr-only"
            disabled={submitting}
            onChange={(ev) => setPhotoName(ev.target.files?.[0]?.name ?? "")}
          />
          <p className="text-fg-muted mt-2 text-xs">
            {isFr
              ? "Totalement facultative — ne pas en mettre ne te pénalise pas."
              : "Entirely optional — leaving it out won't penalise you."}
          </p>
          {photoName ? (
            <p className="text-fg-soft mt-2 flex items-center gap-1.5 text-xs">
              <Check
                aria-hidden="true"
                className="text-sage h-3.5 w-3.5 shrink-0"
                strokeWidth={2.5}
              />
              <span className="min-w-0 truncate font-medium">{photoName}</span>
              <button
                type="button"
                onClick={() => {
                  if (photoRef.current) photoRef.current.value = "";
                  setPhotoName("");
                }}
                className="text-fg-muted hover:text-terracotta ml-auto inline-flex shrink-0 items-center gap-0.5"
                aria-label={isFr ? "Retirer la photo" : "Remove photo"}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" /> {isFr ? "retirer" : "remove"}
              </button>
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
        {/*
          CONSENTEMENTS v2 (lot L4, plan §2.3) — textes VALIDÉS, repris MOT POUR
          MOT. Ne pas les reformuler : c'est la version `careers-v2-2026-08-13`
          qui atteste de ce libellé précis, et le CRM refuse toute fiche portant
          une autre version.

          Deux cases, deux finalités, et c'est tout l'enjeu :
            · la première est OBLIGATOIRE — sans elle, pas d'étude possible ;
            · la seconde est OPTIONNELLE et DÉCOCHÉE PAR DÉFAUT. Elle ne
              conditionne RIEN : on peut postuler en la laissant vide. C'est
              précisément ce qui rend ce consentement libre, donc valide — une
              case pré-cochée ou bloquante ne vaudrait rien juridiquement.

          Texte français uniquement : il a été validé en français et lui seul.
          En produire une traduction reviendrait à fabriquer un second texte
          juridique non validé, sur lequel reposerait la licéité d'un
          traitement. (La locale EN est de toute façon redirigée en 301.)
        */}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(ev) => setConsent(ev.target.checked)}
            className="mt-1"
            disabled={submitting}
          />
          <span>
            J&apos;accepte que mes informations soient utilisées pour l&apos;étude de ma
            candidature.
          </span>
        </label>

        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={consentVivier}
            onChange={(ev) => setConsentVivier(ev.target.checked)}
            className="mt-1"
            disabled={submitting}
          />
          <span className="text-fg-soft">
            J&apos;accepte qu&apos;Axion-IA conserve ma candidature dans son vivier pendant 2 ans
            afin de me recontacter pour d&apos;autres opportunités correspondant à mon profil. Je
            peux retirer cet accord à tout moment (contact@axion-ia.com ou le lien présent dans
            chaque message). Détails :{" "}
            <a
              href="/fr/politique-confidentialite"
              className="underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              politique de confidentialité
            </a>
            .
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
