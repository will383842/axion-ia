"use client";
// use-client: formulaire interactif (état React multi-champs, Turnstile, honeypot, soumission async).
// Formulaire de candidature commercial (page /devenir-commercial-ia/candidature).
//
// Réutilise l'infrastructure existante SANS nouvelle Server Action : soumet via
// `submitUnifiedContactAction` avec `type="recrutement"` → Submission (console
// admin) + Telegram (catégorie RECRUITMENT_RECEIVED) + email de confirmation +
// RGPD (PII chiffrées, IP hashée). Les champs spécifiques au recrutement
// commercial (adresse, portefeuille, outils, locomotion, déplacement siège…)
// sont packés dans `message` (structuré et lisible en console + Telegram).
//
// Sécurité réutilisée : HoneypotField + Turnstile + rate-limit serveur.

import * as React from "react";
import { useLocale } from "next-intl";
import { ArrowRight, Check } from "lucide-react";
import { submitUnifiedContactAction } from "@/features/unified-contact/actions";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { HoneypotField } from "@/components/forms/HoneypotField";

const FIELD =
  "border-border bg-bg focus:border-terracotta focus:ring-terracotta/20 w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-4";
const LABEL = "text-fg mb-1.5 block text-sm font-medium";

interface FormState {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  ville: string;
  secteur: string;
  portefeuille: string; // "oui" | "non"
  outils: string;
  locomotion: string;
  deplacementSiege: string; // "oui" | "non"
  experience: string;
  iaKnowledge: string;
  statut: string;
  disponibilite: string;
  motivation: string;
  consent: boolean;
}

const EMPTY: FormState = {
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  adresse: "",
  ville: "",
  secteur: "",
  portefeuille: "",
  outils: "",
  locomotion: "",
  deplacementSiege: "",
  experience: "",
  iaKnowledge: "",
  statut: "",
  disponibilite: "",
  motivation: "",
  consent: false,
};

export interface CommercialApplicationFormProps {
  readonly isFr: boolean;
}

export function CommercialApplicationForm({
  isFr,
}: CommercialApplicationFormProps): React.ReactNode {
  const locale = useLocale();
  const [f, setF] = React.useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
  } = useTurnstileToken("commercial-application");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  function buildMessage(): string {
    const yn = (v: string) =>
      v === "oui" ? (isFr ? "Oui" : "Yes") : v === "non" ? (isFr ? "Non" : "No") : "—";
    const lines = isFr
      ? [
          f.motivation.trim(),
          "",
          "— Profil candidat —",
          `Adresse : ${f.adresse || "—"}`,
          `Secteur souhaité : ${f.secteur || "—"}`,
          `Possède un portefeuille d'entreprises : ${yn(f.portefeuille)}`,
          `Outils disponibles : ${f.outils || "—"}`,
          `Moyen de locomotion : ${f.locomotion || "—"}`,
          `Peut se déplacer au siège Axion-IA : ${yn(f.deplacementSiege)}`,
          `Expérience commerciale : ${f.experience || "—"}`,
          `Connaissances en IA : ${f.iaKnowledge || "—"}`,
          `Statut actuel : ${f.statut || "—"}`,
          `Disponibilité : ${f.disponibilite || "—"}`,
        ]
      : [
          f.motivation.trim(),
          "",
          "— Candidate profile —",
          `Address: ${f.adresse || "—"}`,
          `Desired sector: ${f.secteur || "—"}`,
          `Has a company portfolio: ${yn(f.portefeuille)}`,
          `Available tools: ${f.outils || "—"}`,
          `Means of transport: ${f.locomotion || "—"}`,
          `Can travel to Axion-IA HQ: ${yn(f.deplacementSiege)}`,
          `Sales experience: ${f.experience || "—"}`,
          `AI knowledge: ${f.iaKnowledge || "—"}`,
          `Current status: ${f.statut || "—"}`,
          `Availability: ${f.disponibilite || "—"}`,
        ];
    return lines.join("\n").slice(0, 1990);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.consent) {
      setError(
        isFr
          ? "Merci d'accepter la politique de confidentialité."
          : "Please accept the privacy policy.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("type", "recrutement");
      fd.set("nom", `${f.prenom} ${f.nom}`.trim().slice(0, 80));
      fd.set("email", f.email);
      fd.set("telephone", f.telephone);
      fd.set("ville", f.ville);
      fd.set("message", buildMessage());
      if (f.secteur) fd.set("companySector", f.secteur.slice(0, 80));
      fd.set("locale", locale);
      fd.set("source", "/devenir-commercial-ia/candidature");
      fd.set("subType", "commercial-ville");
      fd.set("consent", "true");
      if (turnstileToken) fd.set("cf-turnstile-response", turnstileToken);

      const result = await submitUnifiedContactAction({ ok: false, error: "" }, fd);
      if (!result.ok) {
        resetTurnstile();
        setError(result.error || (isFr ? "Une erreur est survenue." : "Something went wrong."));
        return;
      }
      setDone(result.submissionId || "");
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
            {isFr ? "Candidature envoyée" : "Application sent"}
          </span>
        </div>
        <p className="text-fg text-lg">
          {isFr
            ? "Merci ! Nous avons bien reçu votre candidature et revenons vers vous rapidement."
            : "Thank you! We've received your application and will get back to you shortly."}
        </p>
        {done ? <p className="text-fg-muted mt-2 font-mono text-xs">Réf. {done}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <HoneypotField />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="prenom">
            {isFr ? "Prénom" : "First name"} *
          </label>
          <input
            id="prenom"
            required
            maxLength={38}
            className={FIELD}
            value={f.prenom}
            onChange={(e) => set("prenom", e.target.value)}
            autoComplete="given-name"
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="nom">
            {isFr ? "Nom" : "Last name"} *
          </label>
          <input
            id="nom"
            required
            maxLength={38}
            className={FIELD}
            value={f.nom}
            onChange={(e) => set("nom", e.target.value)}
            autoComplete="family-name"
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="email">
            Email *
          </label>
          <input
            id="email"
            type="email"
            required
            className={FIELD}
            value={f.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="telephone">
            {isFr ? "Téléphone" : "Phone"} *
          </label>
          <input
            id="telephone"
            type="tel"
            required
            className={FIELD}
            value={f.telephone}
            onChange={(e) => set("telephone", e.target.value)}
            autoComplete="tel"
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="ville">
            {isFr ? "Ville" : "City"} *
          </label>
          <input
            id="ville"
            required
            className={FIELD}
            value={f.ville}
            onChange={(e) => set("ville", e.target.value)}
            autoComplete="address-level2"
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="adresse">
            {isFr ? "Adresse" : "Address"}
          </label>
          <input
            id="adresse"
            className={FIELD}
            value={f.adresse}
            onChange={(e) => set("adresse", e.target.value)}
            autoComplete="street-address"
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="secteur">
            {isFr ? "Secteur souhaité" : "Desired sector"}
          </label>
          <input
            id="secteur"
            className={FIELD}
            value={f.secteur}
            onChange={(e) => set("secteur", e.target.value)}
            placeholder={isFr ? "ex. industrie, services…" : "e.g. industry, services…"}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="portefeuille">
            {isFr
              ? "Avez-vous un portefeuille d'entreprises ?"
              : "Do you have a company portfolio?"}
          </label>
          <select
            id="portefeuille"
            className={FIELD}
            value={f.portefeuille}
            onChange={(e) => set("portefeuille", e.target.value)}
          >
            <option value="">—</option>
            <option value="oui">{isFr ? "Oui" : "Yes"}</option>
            <option value="non">{isFr ? "Non" : "No"}</option>
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="locomotion">
            {isFr ? "Moyen de locomotion" : "Means of transport"}
          </label>
          <input
            id="locomotion"
            className={FIELD}
            value={f.locomotion}
            onChange={(e) => set("locomotion", e.target.value)}
            placeholder={isFr ? "ex. voiture, transports…" : "e.g. car, public transit…"}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="deplacementSiege">
            {isFr
              ? "Pouvez-vous vous déplacer au siège Axion-IA ?"
              : "Can you travel to Axion-IA HQ?"}
          </label>
          <select
            id="deplacementSiege"
            className={FIELD}
            value={f.deplacementSiege}
            onChange={(e) => set("deplacementSiege", e.target.value)}
          >
            <option value="">—</option>
            <option value="oui">{isFr ? "Oui" : "Yes"}</option>
            <option value="non">{isFr ? "Non" : "No"}</option>
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="experience">
            {isFr ? "Expérience commerciale" : "Sales experience"}
          </label>
          <select
            id="experience"
            className={FIELD}
            value={f.experience}
            onChange={(e) => set("experience", e.target.value)}
          >
            <option value="">—</option>
            <option value={isFr ? "Pas commercial" : "Not a sales rep"}>
              {isFr ? "Pas commercial" : "Not a sales rep"}
            </option>
            <option value={isFr ? "Moins de 2 ans" : "Under 2 years"}>
              {isFr ? "Moins de 2 ans" : "Under 2 years"}
            </option>
            <option value={isFr ? "2 à 5 ans" : "2 to 5 years"}>
              {isFr ? "2 à 5 ans" : "2 to 5 years"}
            </option>
            <option value={isFr ? "Plus de 5 ans" : "Over 5 years"}>
              {isFr ? "Plus de 5 ans" : "Over 5 years"}
            </option>
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="iaKnowledge">
            {isFr ? "Connaissances en IA" : "AI knowledge"}
          </label>
          <select
            id="iaKnowledge"
            className={FIELD}
            value={f.iaKnowledge}
            onChange={(e) => set("iaKnowledge", e.target.value)}
          >
            <option value="">—</option>
            <option value={isFr ? "Aucune" : "None"}>{isFr ? "Aucune" : "None"}</option>
            <option value={isFr ? "Quelques notions" : "Some notions"}>
              {isFr ? "Quelques notions" : "Some notions"}
            </option>
            <option value={isFr ? "Intermédiaire" : "Intermediate"}>
              {isFr ? "Intermédiaire" : "Intermediate"}
            </option>
            <option value={isFr ? "Avancées" : "Advanced"}>{isFr ? "Avancées" : "Advanced"}</option>
            <option value={isFr ? "Expert" : "Expert"}>{isFr ? "Expert" : "Expert"}</option>
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="statut">
            {isFr ? "Statut actuel" : "Current status"}
          </label>
          <select
            id="statut"
            className={FIELD}
            value={f.statut}
            onChange={(e) => set("statut", e.target.value)}
          >
            <option value="">—</option>
            <option value={isFr ? "Indépendant" : "Self-employed"}>
              {isFr ? "Indépendant" : "Self-employed"}
            </option>
            <option value={isFr ? "Salarié" : "Employed"}>{isFr ? "Salarié" : "Employed"}</option>
            <option value={isFr ? "Demandeur d'emploi" : "Job seeker"}>
              {isFr ? "Demandeur d'emploi" : "Job seeker"}
            </option>
            <option value={isFr ? "Autre" : "Other"}>{isFr ? "Autre" : "Other"}</option>
          </select>
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="outils">
          {isFr ? "Outils dont vous disposez" : "Tools you have"}
        </label>
        <input
          id="outils"
          className={FIELD}
          value={f.outils}
          onChange={(e) => set("outils", e.target.value)}
          placeholder={
            isFr ? "ex. ordinateur, CRM, téléphone pro…" : "e.g. laptop, CRM, work phone…"
          }
        />
      </div>

      <div>
        <label className={LABEL} htmlFor="disponibilite">
          {isFr ? "Disponibilité" : "Availability"}
        </label>
        <input
          id="disponibilite"
          className={FIELD}
          value={f.disponibilite}
          onChange={(e) => set("disponibilite", e.target.value)}
          placeholder={isFr ? "ex. immédiate, temps partiel…" : "e.g. immediate, part-time…"}
        />
      </div>

      <div>
        <label className={LABEL} htmlFor="motivation">
          {isFr
            ? "Pourquoi devenir commercial Axion-IA vous intéresse ?"
            : "Why does becoming an Axion-IA sales rep interest you?"}
        </label>
        <textarea
          id="motivation"
          rows={4}
          maxLength={1200}
          className={FIELD}
          value={f.motivation}
          onChange={(e) => set("motivation", e.target.value)}
          placeholder={
            isFr ? "En quelques mots, votre motivation." : "In a few words, your motivation."
          }
        />
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={f.consent}
          onChange={(e) => set("consent", e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0"
        />
        <span className="text-fg-soft">
          {isFr
            ? "J'accepte que mes données soient traitées par Axion-IA pour le suivi de ma candidature (RGPD)."
            : "I agree that my data is processed by Axion-IA to follow up on my application (GDPR)."}
        </span>
      </label>

      {error ? (
        <p
          className="text-terracotta-deep bg-terracotta-soft rounded-lg px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {turnstileWidget}

      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-primary-fg hover:bg-primary-hover inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] transition-colors disabled:opacity-60"
      >
        {submitting
          ? isFr
            ? "Envoi…"
            : "Sending…"
          : isFr
            ? "Envoyer ma candidature"
            : "Send my application"}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </button>

      <p className="text-fg-muted text-xs">
        {isFr
          ? "RGPD · UE — réponse sous quelques jours ouvrés."
          : "GDPR · EU — reply within a few business days."}
      </p>
    </form>
  );
}
