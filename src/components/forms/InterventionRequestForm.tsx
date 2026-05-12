"use client";
// use-client: useForm + Turnstile widget + RHF client-side validation.
// Sprint 14.10.7 (Will 2026-05-12) — formulaire dédié /interventions/demande
// avec champs étendus (prénom, nom, société, email, téléphone+indicatif,
// objet, description). Réutilise la server action `submitContactAction`
// existante en mappant les champs dans le `message` (zéro changement
// backend, déploiement immédiat).

import * as React from "react";
import { useForm } from "react-hook-form";
import { useLocale } from "next-intl";
import { ArrowRight, Mail } from "lucide-react";
import { submitContactAction } from "@/features/contact/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";

// Indicatifs téléphoniques courants — Will pourra étendre. Liste ordonnée
// par pertinence pour la cible Axion-IA (FR + UE + grands marchés).
const PHONE_COUNTRY_CODES: ReadonlyArray<{ code: string; label: string }> = [
  { code: "+33", label: "🇫🇷 +33 France" },
  { code: "+32", label: "🇧🇪 +32 Belgique" },
  { code: "+41", label: "🇨🇭 +41 Suisse" },
  { code: "+352", label: "🇱🇺 +352 Luxembourg" },
  { code: "+1", label: "🇨🇦 +1 Canada/USA" },
  { code: "+44", label: "🇬🇧 +44 Royaume-Uni" },
  { code: "+34", label: "🇪🇸 +34 Espagne" },
  { code: "+39", label: "🇮🇹 +39 Italie" },
  { code: "+49", label: "🇩🇪 +49 Allemagne" },
  { code: "+31", label: "🇳🇱 +31 Pays-Bas" },
  { code: "+351", label: "🇵🇹 +351 Portugal" },
  { code: "+212", label: "🇲🇦 +212 Maroc" },
  { code: "+213", label: "🇩🇿 +213 Algérie" },
  { code: "+216", label: "🇹🇳 +216 Tunisie" },
  { code: "+225", label: "🇨🇮 +225 Côte d'Ivoire" },
  { code: "+221", label: "🇸🇳 +221 Sénégal" },
  { code: "+971", label: "🇦🇪 +971 Émirats" },
];

interface FormValues {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  subject: string;
  description: string;
  consent: boolean;
}

interface SubjectOption {
  value: string;
  labelFr: string;
  labelEn: string;
}

const SUBJECT_OPTIONS: ReadonlyArray<SubjectOption> = [
  {
    value: "formation-equipe",
    labelFr: "Formation équipe (4 h à 3 j)",
    labelEn: "Team training (4 h to 3 d)",
  },
  {
    value: "coaching-individuel",
    labelFr: "Coaching individuel 1-to-1",
    labelEn: "1-on-1 individual coaching",
  },
  {
    value: "journee-dirigeant",
    labelFr: "Journée stratégique dirigeant",
    labelEn: "Executive strategic day",
  },
  { value: "conference", labelFr: "Conférence plénière", labelEn: "Plenary talk" },
  {
    value: "devis-sur-mesure",
    labelFr: "Devis sur mesure (multi-jours, multi-sites)",
    labelEn: "Bespoke quote (multi-day, multi-site)",
  },
  { value: "question-generale", labelFr: "Question générale", labelEn: "General question" },
];

interface Labels {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  subject: string;
  subjectPlaceholder: string;
  description: string;
  descriptionPlaceholder: string;
  consent: string;
  submit: string;
  sending: string;
  success: string;
  failure: string;
}

interface Props {
  labels: Labels;
  /** Objet pré-sélectionné depuis `?objet=...`. Mappé vers SUBJECT_OPTIONS.value. */
  defaultSubject?: string;
  /** Message contextuel pré-rempli (depuis lecture serveur du query). */
  defaultDescription?: string;
}

export function InterventionRequestForm({ labels, defaultSubject, defaultDescription }: Props) {
  const locale = useLocale();
  const isFr = locale === "fr";
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<FormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      company: "",
      email: "",
      phoneCountryCode: "+33",
      phoneNumber: "",
      subject: defaultSubject ?? "",
      description: defaultDescription ?? "",
      consent: false,
    },
  });
  const consent = watch("consent");
  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
  } = useTurnstileToken("intervention-request");

  const [serverError, setServerError] = React.useState<string | null>(null);

  async function onSubmit(values: FormValues): Promise<void> {
    setServerError(null);
    if (!values.consent) {
      setServerError(labels.failure);
      return;
    }
    try {
      // Mapping vers le schema `contactSchema` existant pour réutiliser
      // l'action serveur sans toucher au backend.
      const fullName = `${values.firstName.trim()} ${values.lastName.trim()}`.trim();
      const subjectOpt = SUBJECT_OPTIONS.find((s) => s.value === values.subject);
      const subjectLabel = subjectOpt
        ? isFr
          ? subjectOpt.labelFr
          : subjectOpt.labelEn
        : values.subject;

      const messageBlocks = [
        `[Objet] ${subjectLabel}`,
        `[Téléphone] ${values.phoneCountryCode} ${values.phoneNumber.trim()}`,
        "",
        values.description.trim(),
      ];

      const fd = new FormData();
      fd.set("name", fullName);
      fd.set("email", values.email.trim());
      fd.set("company", values.company.trim());
      fd.set("message", messageBlocks.join("\n"));
      fd.set("consent", "true");
      fd.set("locale", locale);
      if (turnstileToken) fd.set("cf-turnstile-response", turnstileToken);

      const result = await submitContactAction({ ok: false, error: "" }, fd);
      if (!result.ok) {
        resetTurnstile();
        setServerError(result.error || labels.failure);
        throw new Error(result.error || labels.failure);
      }
    } catch (err) {
      if (!serverError) setServerError(labels.failure);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  if (isSubmitSuccessful && !serverError) {
    return (
      <Alert variant="success" role="status">
        <AlertDescription>{labels.success}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Ligne 1 : Prénom + Nom */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">{labels.firstName}</Label>
          <Input
            id="firstName"
            autoComplete="given-name"
            {...register("firstName", { required: true, minLength: 1 })}
            aria-invalid={errors.firstName ? "true" : undefined}
          />
        </div>
        <div>
          <Label htmlFor="lastName">{labels.lastName}</Label>
          <Input
            id="lastName"
            autoComplete="family-name"
            {...register("lastName", { required: true, minLength: 1 })}
            aria-invalid={errors.lastName ? "true" : undefined}
          />
        </div>
      </div>

      {/* Ligne 2 : Société (obligatoire pour B2B) */}
      <div>
        <Label htmlFor="company">{labels.company}</Label>
        <Input
          id="company"
          autoComplete="organization"
          {...register("company", { required: true, minLength: 1 })}
          aria-invalid={errors.company ? "true" : undefined}
        />
      </div>

      {/* Ligne 3 : Email */}
      <div>
        <Label htmlFor="email">{labels.email}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email", {
            required: true,
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          })}
          aria-invalid={errors.email ? "true" : undefined}
        />
      </div>

      {/* Ligne 4 : Téléphone (indicatif + numéro) */}
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <div>
          <Label htmlFor="phoneCountryCode">{labels.phoneCountryCode}</Label>
          <select
            id="phoneCountryCode"
            className="border-border bg-paper text-fg focus-visible:ring-terracotta h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            {...register("phoneCountryCode", { required: true })}
          >
            {PHONE_COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="phoneNumber">{labels.phoneNumber}</Label>
          <Input
            id="phoneNumber"
            type="tel"
            autoComplete="tel-national"
            inputMode="tel"
            placeholder="6 12 34 56 78"
            {...register("phoneNumber", { required: true, minLength: 6 })}
            aria-invalid={errors.phoneNumber ? "true" : undefined}
          />
        </div>
      </div>

      {/* Ligne 5 : Objet (select) */}
      <div>
        <Label htmlFor="subject">{labels.subject}</Label>
        <select
          id="subject"
          className="border-border bg-paper text-fg focus-visible:ring-terracotta h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
          {...register("subject", { required: true })}
          aria-invalid={errors.subject ? "true" : undefined}
        >
          <option value="">{labels.subjectPlaceholder}</option>
          {SUBJECT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {isFr ? o.labelFr : o.labelEn}
            </option>
          ))}
        </select>
      </div>

      {/* Ligne 6 : Description */}
      <div>
        <Label htmlFor="description">{labels.description}</Label>
        <Textarea
          id="description"
          rows={6}
          placeholder={labels.descriptionPlaceholder}
          {...register("description", { required: true, minLength: 10 })}
          aria-invalid={errors.description ? "true" : undefined}
        />
      </div>

      {/* Consent */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="consent"
          checked={consent}
          onCheckedChange={(v) => setValue("consent", v === true, { shouldValidate: true })}
        />
        <Label
          htmlFor="consent"
          className="text-fg-soft cursor-pointer text-[13px] leading-relaxed"
        >
          {labels.consent}
        </Label>
      </div>

      {/* Turnstile widget (invisible) */}
      {turnstileWidget}

      {/* Submit */}
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !consent}>
        <Mail aria-hidden="true" className="h-4 w-4" />
        {isSubmitting ? labels.sending : labels.submit}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Button>

      {serverError ? (
        <Alert variant="danger" role="alert">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}

// Mapping query string `?objet=<slug>` (depuis taxonomy ou ad-hoc) vers
// SUBJECT_OPTIONS.value pour pré-sélectionner le select. Si pas de match,
// le select reste vide et le slug brut sera repris dans la description
// pré-remplie par la page server.
export function mapObjetToSubject(objet: string | undefined): string {
  if (!objet) return "";
  // Mappings explicites
  if (
    objet.includes("formation") ||
    objet.includes("collective") ||
    objet.includes("cadrage-4h") ||
    objet.includes("cadrage-1-jour") ||
    objet.includes("cadrage-2-jours") ||
    objet.includes("cadrage-3-jours") ||
    objet.includes("demarrage-ia-express") ||
    objet.includes("atelier-ia-cible") ||
    objet.includes("essentielle") ||
    objet.includes("approfondie") ||
    objet.includes("gagner-du-temps") ||
    objet.includes("claude")
  ) {
    return "formation-equipe";
  }
  if (objet.includes("coaching")) return "coaching-individuel";
  if (objet.includes("dirigeant")) return "journee-dirigeant";
  if (objet.includes("conference")) return "conference";
  if (objet.includes("sur-mesure") || objet.includes("devis")) return "devis-sur-mesure";
  return "";
}
