"use client";
// use-client: formulaire interactif (Turnstile, honeypot, CV facultatif, soumission async).
//
// Candidature de formateur indépendant — une page, quatre blocs (lot L0c-1,
// maquette `maquette-formateur-candidature.html`) : Vous · Votre activité ·
// Vos formations · Pour finir. Rendu SEULEMENT quand l'interrupteur
// `formateurs.formulaire_freelance` est allumé et que l'offre est une offre de
// formateur freelance ; c'est le serveur qui le décide, et l'action le revérifie.
//
// Même action, même anti-spam et mêmes consentements (textes validés,
// version `careers-v2-2026-08-13`) que `JobApplicationForm`.

import * as React from "react";
import { Check, FileUp, X } from "lucide-react";

import { submitJobApplicationAction } from "@/features/job-application/actions";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { isStaleServerActionError } from "@/lib/forms/form-errors";

// 18 px et des cibles de 48 px : pensé pour le téléphone d'abord.
const FIELD =
  "border-border bg-bg focus:border-terracotta focus:ring-terracotta/20 min-h-12 w-full rounded-lg border px-3.5 py-2.5 text-[18px] outline-none focus:ring-4";
const LABEL = "text-fg mb-1.5 block text-base font-medium";
const AIDE = "text-fg-muted mt-1.5 text-sm";
const SECTION = "font-serif text-xl font-semibold border-l-4 border-terracotta pl-3 leading-tight";
const FIELDSET = "min-w-0 space-y-4";
const FILE_TRIGGER =
  "border-terracotta/45 bg-terracotta-soft/40 text-terracotta-deep hover:bg-terracotta-soft hover:border-terracotta focus-within:ring-terracotta/30 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3.5 text-center text-base font-semibold shadow-sm transition-colors focus-within:ring-4";

const CAPTCHA_AIDE =
  "La vérification anti-spam (Cloudflare) n'a pas abouti. Si une case « Vérifiez que vous êtes humain » s'affiche au-dessus du bouton, cochez-la puis renvoyez. Sinon, écrivez-nous à contact@axion-ia.com.";
const PAGE_EXPIREE =
  "Cette page a expiré à la suite d'une mise à jour du site. Rechargez-la, puis renvoyez votre candidature : votre saisie est gardée tant que vous ne rechargez pas.";

interface Props {
  offerId: string;
  /** `formateurs.invitation_auto` : dit ce qui suit l'envoi, sans rien promettre de faux. */
  invitationAuto: boolean;
}

export function FormulaireFormateurFreelance({ offerId, invitationAuto }: Props) {
  const cvRef = React.useRef<HTMLInputElement>(null);
  const [cvName, setCvName] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [consentVivier, setConsentVivier] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
    blocked: turnstileBlocked,
  } = useTurnstileToken("job-application");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Cochez la case qui permet d'étudier votre candidature.");
      return;
    }
    const cvFile = cvRef.current?.files?.[0];
    if (cvFile && cvFile.size > 8 * 1024 * 1024) {
      setError("CV trop volumineux (8 Mo au plus).");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("offerId", offerId);
      fd.set("locale", "fr");
      fd.set("consent", "true");
      fd.set("landingPath", window.location.pathname);
      fd.set("consentVivier", consentVivier ? "true" : "false");
      if (turnstileToken) fd.set("cf-turnstile-response", turnstileToken);
      const result = await submitJobApplicationAction({ ok: false, error: "" }, fd);
      if (!result.ok) {
        const antiSpam = !turnstileToken || turnstileBlocked;
        resetTurnstile();
        setError(antiSpam ? CAPTCHA_AIDE : result.error || "Envoi impossible pour l'instant.");
        return;
      }
      setDone(true);
    } catch (err) {
      setError(
        isStaleServerActionError(err)
          ? PAGE_EXPIREE
          : "Envoi impossible pour l'instant ? Votre saisie est gardée. Réessayez dans un instant.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center" role="status">
        <div className="bg-halo-warm border-terracotta/30 mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full border">
          <Check aria-hidden="true" strokeWidth={3} className="text-terracotta-deep h-6 w-6" />
        </div>
        <p className="font-serif text-2xl font-semibold">C&apos;est noté</p>
        <p className="text-fg mt-3 text-lg">
          {invitationAuto
            ? "Nous vous écrivons dans quelques minutes pour vous proposer un échange de 20 minutes."
            : "Nous revenons vers vous pour vous proposer un échange."}
        </p>
        <p className="text-fg-muted mt-2 text-sm">Vous pouvez fermer cette page.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" encType="multipart/form-data">
      <HoneypotField />
      {/* Dit au serveur lequel des deux formulaires est envoyé (pages en cache). */}
      <input type="hidden" name="formulaire" value="formateur-freelance" />

      <fieldset className={FIELDSET}>
        <legend className={SECTION}>Vous</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className={LABEL}>
              Prénom
            </label>
            <input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              required
              maxLength={100}
              className={FIELD}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="lastName" className={LABEL}>
              Nom
            </label>
            <input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              required
              maxLength={100}
              className={FIELD}
              disabled={submitting}
            />
          </div>
        </div>
        <div>
          <label htmlFor="email" className={LABEL}>
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={180}
            className={FIELD}
            disabled={submitting}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className={LABEL}>
              Téléphone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required
              maxLength={40}
              className={FIELD}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="codePostal" className={LABEL}>
              Code postal
            </label>
            <input
              id="codePostal"
              name="codePostal"
              autoComplete="postal-code"
              inputMode="numeric"
              required
              maxLength={5}
              pattern="[0-9]{5}"
              className={FIELD}
              disabled={submitting}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={FIELDSET}>
        <legend className={SECTION}>Votre activité</legend>
        <div>
          <label htmlFor="siret" className={LABEL}>
            Numéro SIRET <span className="text-fg-muted font-normal">(facultatif)</span>
          </label>
          <input
            id="siret"
            name="siret"
            inputMode="numeric"
            maxLength={20}
            className={FIELD}
            disabled={submitting}
          />
          <p className={AIDE}>Pas encore ? Laissez vide.</p>
        </div>
        <div>
          <label htmlFor="numeroDeclaration" className={LABEL}>
            Numéro de déclaration d&apos;activité
          </label>
          <input
            id="numeroDeclaration"
            name="numeroDeclaration"
            inputMode="numeric"
            maxLength={14}
            placeholder="11 chiffres"
            required
            className={FIELD}
            disabled={submitting}
          />
        </div>
      </fieldset>

      <fieldset className={FIELDSET}>
        <legend className={SECTION}>Vos formations</legend>
        <div>
          <label htmlFor="formations" className={LABEL}>
            Les formations que vous animez, en une phrase
          </label>
          <textarea
            id="formations"
            name="formations"
            rows={3}
            required
            maxLength={600}
            placeholder="Ex. : IA générative pour les équipes…"
            className={FIELD}
            disabled={submitting}
          />
        </div>
        <div>
          <label htmlFor="linkedinUrl" className={LABEL}>
            Lien LinkedIn ou site <span className="text-fg-muted font-normal">(facultatif)</span>
          </label>
          <input
            id="linkedinUrl"
            name="linkedinUrl"
            type="url"
            inputMode="url"
            maxLength={255}
            placeholder="https://"
            className={FIELD}
            disabled={submitting}
          />
        </div>
        <div>
          <span className={LABEL}>
            CV <span className="text-fg-muted font-normal">(facultatif)</span>
          </span>
          <label
            htmlFor="cv"
            className={`${FILE_TRIGGER} ${submitting ? "pointer-events-none opacity-60" : ""}`}
          >
            <FileUp aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2} />
            {cvName ? "Changer le fichier" : "Ajouter un fichier"}
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
            <p className="text-fg-soft mt-2 flex items-center gap-1.5 text-sm">
              <span className="min-w-0 truncate font-medium">{cvName}</span>
              <button
                type="button"
                onClick={() => {
                  if (cvRef.current) cvRef.current.value = "";
                  setCvName("");
                }}
                className="text-fg-muted hover:text-terracotta ml-auto inline-flex min-h-12 shrink-0 items-center gap-0.5"
                aria-label="Retirer le CV"
              >
                <X aria-hidden="true" className="h-4 w-4" /> retirer
              </button>
            </p>
          ) : (
            <p className={AIDE}>Il aide à préparer notre échange.</p>
          )}
        </div>
      </fieldset>

      <fieldset className={FIELDSET}>
        <legend className={SECTION}>Pour finir</legend>
        <label className="flex min-h-12 items-start gap-3 text-base">
          <input type="checkbox" name="interviews" className="mt-1 h-5 w-5" disabled={submitting} />
          <span>
            Des interviews filmées pourraient m&apos;être proposées.
            <span className="text-fg-muted block text-sm">
              Facultatif · un refus est sans conséquence.
            </span>
          </span>
        </label>
        {/* Consentements : textes VALIDÉS de `JobApplicationForm`, mot pour mot
            (version `careers-v2-2026-08-13`, exigée par le CRM). */}
        <label className="flex min-h-12 items-start gap-3 text-base">
          <input
            type="checkbox"
            checked={consent}
            onChange={(ev) => setConsent(ev.target.checked)}
            className="mt-1 h-5 w-5"
            disabled={submitting}
          />
          <span>
            J&apos;accepte que mes informations soient utilisées pour l&apos;étude de ma
            candidature.
          </span>
        </label>
        <label className="flex min-h-12 items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={consentVivier}
            onChange={(ev) => setConsentVivier(ev.target.checked)}
            className="mt-1 h-5 w-5"
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
        {/* Information RGPD art. 13, pas un consentement. */}
        <details className="text-fg-muted text-sm">
          <summary className="min-h-12 cursor-pointer py-3">
            Comment nous traitons vos informations : lire en 2 lignes
          </summary>
          <p>
            Axion-IA les utilise pour étudier votre candidature et vous proposer un échange. Votre
            candidature et votre CV sont conservés 2 ans après notre dernier échange, puis effacés ;
            vous pouvez en demander l&apos;effacement plus tôt à contact@axion-ia.com.
          </p>
        </details>
      </fieldset>

      <div className="space-y-2">
        {turnstileWidget}
        {turnstileBlocked ? <p className="text-sm text-amber-700">{CAPTCHA_AIDE}</p> : null}
      </div>

      {error ? (
        <p role="alert" className="text-base text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="bg-terracotta hover:bg-terracotta-deep inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 py-3 text-lg font-medium text-white transition-colors disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "Envoi…" : "Envoyer ma candidature"}
      </button>
    </form>
  );
}
