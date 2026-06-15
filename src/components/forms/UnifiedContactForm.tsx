"use client";
// use-client: react-hook-form + Zod + Turnstile + segmented control state.
// Unified contact form — composant unifié (2026-05-24).
//
// Remplace ContactForm, AuditForm (legacy), AuditRequestForm,
// ImplementationForm, QuoteRequestForm et InterventionRequestForm.
// NewsletterForm est conservé séparément (double opt-in distinct).
//
// Pattern :
//   - Segmented control `type` (5 boutons) en tête, masquable via lockType.
//   - 5 champs base toujours visibles : nom, email, téléphone, ville, message.
//   - Toggle "Aller plus loin" qui révèle 5 champs avancés (entreprise, taille,
//     secteur, budget, timing). Ouvert automatiquement pour type=audit |
//     type=implementation OU si advancedOpenByDefault.
//   - Honeypot + Turnstile + react-hook-form + Zod côté client.
//   - Submit via server action `submitUnifiedContactAction`.

import * as React from "react";
import { useForm } from "react-hook-form";
import { useLocale } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import {
  unifiedContactSchema,
  UNIFIED_CONTACT_TYPES,
  TYPE_GROUPS,
  COMPANY_SIZES,
  TIMING_WEEKS,
  type UnifiedContactInput,
  type UnifiedContactType,
} from "@/lib/schemas/unified-contact-schema";
import { submitUnifiedContactAction } from "@/features/unified-contact/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { cn } from "@/lib/utils";

// ---- Labels i18n ----------------------------------------------------------

const LABELS = {
  fr: {
    eyebrow: "Démarrer un échange",
    title: "Décrivez votre besoin",
    titleEm: "en quelques secondes",
    subtitle:
      "Chaque demande est lue personnellement par un consultant senior Axion-IA. Réponse sous 24 h ouvrées. Sans engagement.",
    typeLabel: "Objet de votre demande",
    typeHelp: "Vous ne trouvez pas votre cas ? Choisissez « Autre » — le formulaire sert à tout.",
    typeOptions: {
      // Groupe 1 — Projet IA pour mon entreprise
      audit: "Audit IA",
      implementation: "Intégration sur-mesure",
      formation: "Formation IA",
      un_a_un: "Coaching 1 to 1",
      devis: "Devis sur projet",
      // Groupe 2 — Autres demandes
      partenariat: "Partenariat",
      presse: "Presse / média",
      recrutement: "Recrutement",
      speaker: "Invitation conférence",
      investisseur: "Investisseur / M&A",
      support_client: "Support client",
      autre: "Autre demande",
    },
    typeGroups: {
      projet: "Projet IA pour mon entreprise",
      autre: "Autre demande",
    },
    nom: "Nom complet",
    nomPlaceholder: "Prénom Nom",
    email: "Email professionnel",
    emailPlaceholder: "vous@entreprise.com",
    telephone: "Téléphone (avec indicatif pays)",
    telephonePlaceholder: "+33 6 12 34 56 78",
    ville: "Ville",
    villePlaceholder: "Paris",
    message: "Votre message",
    messagePlaceholder: "Décrivez votre contexte, vos objectifs, vos contraintes éventuelles…",
    advancedToggle: "Aller plus loin (recommandé pour audit / projet sur-mesure)",
    advancedHint: "Quelques infos en plus = devis plus précis et call de cadrage plus efficace.",
    companyName: "Société",
    companyNamePlaceholder: "Raison sociale",
    companySize: "Taille (INSEE)",
    companySizeOptions: {
      tpe: "TPE — 1 à 19",
      pme: "PME — 20 à 250",
      eti: "ETI — 250 à 5 000",
      grande_entreprise: "Grande entreprise — 5 000+",
    },
    companySector: "Secteur d'activité",
    companySectorPlaceholder: "Ex : industrie, retail, santé…",
    budgetIndicative: "Budget pressenti (optionnel)",
    budgetIndicativePlaceholder:
      "Ex : 10-20 k€, à définir" /* price-exempt: placeholder budget saisi par le visiteur, pas un tarif Axion-IA */,
    timingWeeks: "Timing souhaité",
    timingWeeksOptions: {
      "0-4": "0-4 semaines",
      "4-8": "4-8 semaines",
      "8-12": "8-12 semaines",
      "12+": "12+ semaines",
    },
    consent:
      "J'accepte que mes données soient utilisées pour traiter cette demande conformément à la politique de confidentialité. Aucune revente, aucun profilage, désinscription à tout moment.",
    submit: "Envoyer ma demande",
    sending: "Envoi…",
    success:
      "Demande reçue. Un consultant senior Axion-IA vous recontacte personnellement sous 24 h ouvrées. Votre projet a notre entière attention.",
    failure: "Une erreur est survenue. Réessayez ou écrivez à contact@axion-ia.com.",
    typeRequired: "Choisissez un type pour continuer.",
    submitAgain: "Faire une autre demande",
    referenceLabel: "Référence",
    trustPills: ["RGPD · UE", "Réponse 24 h ouvrées", "Sans engagement"],
  },
  en: {
    eyebrow: "Start a conversation",
    title: "Tell us about your need",
    titleEm: "in seconds",
    subtitle:
      "Chaque demande est lue personnellement par un consultant senior Axion-IA. Réponse sous 24 h ouvrées. Sans engagement.",
    typeLabel: "What is your request about?",
    typeHelp: "Not sure where you fit? Pick « Other » — this form covers everything.",
    typeOptions: {
      // Group 1 — AI project for my company
      audit: "AI audit",
      implementation: "Bespoke integration",
      formation: "AI training",
      un_a_un: "1-to-1 coaching",
      devis: "Project quote",
      // Group 2 — Other requests
      partenariat: "Partnership",
      presse: "Press / media",
      recrutement: "Recruitment",
      speaker: "Speaking invitation",
      investisseur: "Investor / M&A",
      support_client: "Customer support",
      autre: "Other request",
    },
    typeGroups: {
      projet: "AI project for my company",
      autre: "Other request",
    },
    nom: "Full name",
    nomPlaceholder: "First Last",
    email: "Work email",
    emailPlaceholder: "you@company.com",
    telephone: "Phone",
    telephonePlaceholder: "+33 6 12 34 56 78",
    ville: "City",
    villePlaceholder: "Paris",
    message: "Your message",
    messagePlaceholder: "Describe your context, goals, constraints…",
    advancedToggle: "Go further (recommended for audit / custom project)",
    advancedHint: "A few more facts = sharper quote and faster scoping call.",
    companyName: "Company",
    companyNamePlaceholder: "Company name",
    companySize: "Size (INSEE)",
    companySizeOptions: {
      tpe: "Small — 1 to 19",
      pme: "SME — 20 to 250",
      eti: "Mid-cap — 250 to 5,000",
      grande_entreprise: "Enterprise — 5,000+",
    },
    companySector: "Sector",
    companySectorPlaceholder: "e.g. industry, retail, healthcare…",
    budgetIndicative: "Indicative budget (optional)",
    budgetIndicativePlaceholder:
      "e.g. 10-20 k€, TBD" /* price-exempt: visitor-entered budget placeholder, not an Axion-IA price */,
    timingWeeks: "Desired timing",
    timingWeeksOptions: {
      "0-4": "0-4 weeks",
      "4-8": "4-8 weeks",
      "8-12": "8-12 weeks",
      "12+": "12+ weeks",
    },
    consent:
      "I agree to my data being used to handle this request per the privacy policy. No resale, no profiling, one-click unsubscribe.",
    submit: "Send my request",
    sending: "Sending…",
    success:
      "Demande reçue. Un consultant senior Axion-IA vous recontacte personnellement sous 24 h ouvrées. Votre projet a notre entière attention.",
    failure: "An error occurred. Try again or email contact@axion-ia.com.",
    typeRequired: "Pick a type to continue.",
    submitAgain: "Send another request",
    referenceLabel: "Reference",
    trustPills: ["RGPD · UE", "Réponse 24 h ouvrées", "Sans engagement"],
  },
} as const;

// ---- Props -----------------------------------------------------------------

export interface UnifiedContactFormProps {
  /** Pré-sélectionne le type. */
  defaultType?: UnifiedContactType;
  /** Bloque la modification du type — masque le segmented control. */
  lockType?: boolean;
  /** Granularité fine (audit-flash, chatbot, etc.) — stockée en details.subType. */
  defaultSubType?: string;
  /** Message pré-rempli. */
  defaultMessage?: string;
  /** Toggle "aller plus loin" forcé ouvert. */
  advancedOpenByDefault?: boolean;
  /** Source override (sinon usePathname()). */
  source?: string;
  className?: string;
}

// ---- Composant -------------------------------------------------------------

function isAdvancedType(t: UnifiedContactType | undefined): boolean {
  return t === "audit" || t === "implementation";
}

function UnifiedContactFormBody({
  defaultType,
  lockType = false,
  defaultSubType,
  defaultMessage,
  advancedOpenByDefault,
  source,
  className,
  urlType,
  urlSubType,
}: UnifiedContactFormProps & {
  /** `?type=` lu dans l'URL (null en SSR / dans le fallback Suspense). */
  urlType: string | null;
  /** `?subType=` lu dans l'URL (null en SSR / dans le fallback Suspense). */
  urlSubType: string | null;
}) {
  const locale = (useLocale() === "en" ? "en" : "fr") as "fr" | "en";
  const t = LABELS[locale];
  const pathname = usePathname();

  // ?type= dans l'URL prend le pas sur defaultType si pas locké.
  const typeFromUrl = (urlType as UnifiedContactType | null) ?? null;
  const initialType: UnifiedContactType | undefined =
    !lockType && typeFromUrl && UNIFIED_CONTACT_TYPES.includes(typeFromUrl)
      ? typeFromUrl
      : defaultType;

  const effectiveSource = source ?? pathname ?? undefined;
  const effectiveSubType = defaultSubType ?? urlSubType ?? undefined;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<UnifiedContactInput>({
    resolver: zodResolver(unifiedContactSchema as never) as never,
    defaultValues: {
      ...(initialType ? { type: initialType } : {}),
      message: defaultMessage ?? "",
      locale,
      ...(effectiveSource ? { source: effectiveSource } : {}),
      ...(effectiveSubType ? { subType: effectiveSubType } : {}),
    } as never,
  });
  const type = watch("type");
  const consent = watch("consent");
  const messageValue = watch("message") ?? "";

  const [advancedOpen, setAdvancedOpen] = React.useState<boolean>(
    advancedOpenByDefault === true || isAdvancedType(initialType),
  );

  // Si l'user change vers audit/implementation, on ouvre le toggle.
  React.useEffect(() => {
    if (isAdvancedType(type)) setAdvancedOpen(true);
  }, [type]);

  // Type dropdown state — pattern bouton-trigger qui ouvre un popover listbox.
  // Form v2 2026-05-28 : remplace le segmented control 12 boutons par un
  // dropdown compact (mobile-first, Linear/Stripe pattern). Click outside +
  // Escape ferment le panel.
  const [typeOpen, setTypeOpen] = React.useState(false);
  const typeDropdownRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!typeOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (!typeDropdownRef.current?.contains(e.target as Node)) {
        setTypeOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setTypeOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [typeOpen]);

  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
  } = useTurnstileToken("unified-contact");
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submissionId, setSubmissionId] = React.useState<string | null>(null);

  async function onSubmit(values: UnifiedContactInput) {
    setServerError(null);
    try {
      const fd = new FormData();
      fd.set("type", values.type);
      fd.set("nom", values.nom);
      fd.set("email", values.email);
      fd.set("telephone", values.telephone);
      fd.set("ville", values.ville);
      fd.set("message", values.message);
      if (values.companyName) fd.set("companyName", values.companyName);
      if (values.companySize) fd.set("companySize", values.companySize);
      if (values.companySector) fd.set("companySector", values.companySector);
      if (values.budgetIndicative) fd.set("budgetIndicative", values.budgetIndicative);
      if (values.timingWeeks) fd.set("timingWeeks", values.timingWeeks);
      fd.set("locale", locale);
      if (effectiveSource) fd.set("source", effectiveSource);
      if (effectiveSubType) fd.set("subType", effectiveSubType);
      fd.set("consent", values.consent ? "true" : "false");
      if (turnstileToken) fd.set("cf-turnstile-response", turnstileToken);

      const result = await submitUnifiedContactAction({ ok: false, error: "" }, fd);
      if (!result.ok) {
        resetTurnstile();
        setServerError(result.error || t.failure);
        throw new Error(result.error || t.failure);
      }
      setSubmissionId(result.submissionId || null);
    } catch (err) {
      if (!serverError) setServerError(t.failure);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  // ---- Succès ------------------------------------------------------------
  if (isSubmitSuccessful && !serverError) {
    return (
      <div
        className={cn(
          "bg-paper border-terracotta/30 shadow-card rounded-3xl border-2 p-8 sm:p-10",
          className,
        )}
        role="status"
      >
        <div className="bg-halo-warm border-terracotta/30 mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5">
          <Check aria-hidden="true" strokeWidth={3} className="text-terracotta-deep h-4 w-4" />
          <span className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
            {t.eyebrow}
          </span>
        </div>
        <p
          className="text-fg text-2xl leading-snug font-medium tracking-tight sm:text-3xl"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {t.success}
        </p>
        {submissionId ? (
          <p className="text-fg-muted mt-3 text-sm">
            {t.referenceLabel} :{" "}
            <span className="font-mono text-xs tabular-nums">{submissionId}</span>
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          shape="pill"
          onClick={() => window.location.reload()}
          className="mt-6"
        >
          {t.submitAgain}
        </Button>
      </div>
    );
  }

  // ---- Form --------------------------------------------------------------
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={cn("space-y-5", className)}
      aria-label={t.title}
    >
      <HoneypotField />

      {/* Type — dropdown trigger + popover listbox (Form v2 2026-05-28).
          Pattern Linear/Stripe : 1 bouton compact qui ouvre les 12 choix en
          2 groupes. Économise ~140px de hauteur vs segmented control, mobile-
          first (panel full-width responsive), keyboard navigable (Escape +
          click outside ferment). */}
      {!lockType ? (
        <div className="space-y-1.5" ref={typeDropdownRef}>
          <label htmlFor="type-trigger" className="text-fg block text-base font-bold sm:text-lg">
            {t.typeLabel}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </label>
          <div className="relative">
            <button
              id="type-trigger"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={typeOpen}
              aria-controls="type-listbox"
              onClick={() => setTypeOpen((v) => !v)}
              className={cn(
                "border-border bg-paper hover:border-terracotta focus-visible:ring-terracotta flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left text-[15px] font-medium transition-all focus-visible:ring-2 focus-visible:outline-none",
                type && "border-terracotta bg-halo-warm text-terracotta-deep",
                !type && "text-fg-muted",
              )}
            >
              <span className="flex items-center gap-2">
                {type ? (
                  <>
                    <Check aria-hidden="true" strokeWidth={3} className="h-4 w-4 shrink-0" />
                    <span className="text-fg font-semibold">{t.typeOptions[type]}</span>
                  </>
                ) : (
                  <span>{t.typeHelp}</span>
                )}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn("h-4 w-4 shrink-0 transition-transform", typeOpen && "rotate-180")}
              />
            </button>
            {typeOpen ? (
              <div
                id="type-listbox"
                role="listbox"
                aria-label={t.typeLabel}
                className="bg-paper border-border shadow-card absolute top-full right-0 left-0 z-20 mt-2 max-h-[60vh] overflow-y-auto rounded-xl border-2 p-2"
              >
                {(["projet", "autre"] as const).map((groupKey, gIdx) => (
                  <div
                    key={groupKey}
                    className={cn(gIdx > 0 && "border-border mt-2 border-t pt-2")}
                  >
                    <p className="text-fg-muted px-3 pt-2 pb-1 text-[10.5px] font-semibold tracking-[0.16em] uppercase">
                      {t.typeGroups[groupKey]}
                    </p>
                    <ul className="space-y-0.5">
                      {TYPE_GROUPS[groupKey].map((opt) => {
                        const isSel = type === opt;
                        return (
                          <li key={opt}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={isSel}
                              onClick={() => {
                                setValue("type", opt, { shouldValidate: true, shouldDirty: true });
                                setTypeOpen(false);
                              }}
                              className={cn(
                                "hover:bg-halo-warm focus-visible:ring-terracotta flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                                isSel && "bg-halo-warm",
                              )}
                            >
                              <Check
                                aria-hidden="true"
                                strokeWidth={3}
                                className={cn(
                                  "mt-0.5 h-4 w-4 shrink-0",
                                  isSel ? "text-terracotta-deep" : "text-transparent",
                                )}
                              />
                              <span
                                className={cn(
                                  "flex-1 text-[14px] font-semibold",
                                  isSel ? "text-terracotta-deep" : "text-fg",
                                )}
                              >
                                {t.typeOptions[opt]}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {errors.type ? (
            <p role="alert" className="text-accent-red text-xs">
              {errors.type.message ?? t.typeRequired}
            </p>
          ) : null}
        </div>
      ) : (
        <input type="hidden" {...register("type")} />
      )}

      {/* Nom + Email — 2 colonnes desktop */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="unified-nom">
            {t.nom}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </Label>
          <Input
            id="unified-nom"
            autoComplete="name"
            placeholder={t.nomPlaceholder}
            {...register("nom")}
            aria-invalid={!!errors.nom}
            aria-describedby={errors.nom ? "unified-nom-err" : undefined}
          />
          {errors.nom ? (
            <p id="unified-nom-err" role="alert" className="text-accent-red text-xs">
              {errors.nom.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="unified-email">
            {t.email}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </Label>
          <Input
            id="unified-email"
            type="email"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            {...register("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "unified-email-err" : undefined}
          />
          {errors.email ? (
            <p id="unified-email-err" role="alert" className="text-accent-red text-xs">
              {errors.email.message}
            </p>
          ) : null}
        </div>
      </div>

      {/* Téléphone + Ville */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="unified-telephone">
            {t.telephone}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </Label>
          <Input
            id="unified-telephone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t.telephonePlaceholder}
            {...register("telephone")}
            aria-invalid={!!errors.telephone}
            aria-describedby={errors.telephone ? "unified-tel-err" : undefined}
          />
          {errors.telephone ? (
            <p id="unified-tel-err" role="alert" className="text-accent-red text-xs">
              {errors.telephone.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="unified-ville">
            {t.ville}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </Label>
          <Input
            id="unified-ville"
            autoComplete="address-level2"
            placeholder={t.villePlaceholder}
            {...register("ville")}
            aria-invalid={!!errors.ville}
            aria-describedby={errors.ville ? "unified-ville-err" : undefined}
          />
          {errors.ville ? (
            <p id="unified-ville-err" role="alert" className="text-accent-red text-xs">
              {errors.ville.message}
            </p>
          ) : null}
        </div>
      </div>

      {/* Message */}
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="unified-message">
            {t.message}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </Label>
          <span
            className={cn(
              "text-[11px] font-bold tabular-nums",
              messageValue.length < 20 ? "text-fg-muted" : "text-sage",
            )}
            aria-live="polite"
          >
            {messageValue.length} / 2000
          </span>
        </div>
        <Textarea
          id="unified-message"
          rows={5}
          placeholder={t.messagePlaceholder}
          {...register("message")}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "unified-msg-err" : undefined}
        />
        {errors.message ? (
          <p id="unified-msg-err" role="alert" className="text-accent-red text-xs">
            {errors.message.message}
          </p>
        ) : null}
      </div>

      {/* Toggle avancé */}
      <div className="border-border border-t pt-5">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
          aria-controls="unified-advanced"
          className="text-fg hover:text-terracotta-deep focus-visible:ring-terracotta inline-flex items-center gap-2 rounded text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 transition-transform", advancedOpen ? "rotate-180" : "rotate-0")}
          />
          {t.advancedToggle}
        </button>
        {advancedOpen ? (
          <div id="unified-advanced" className="mt-4 space-y-4">
            <p className="text-fg-muted text-[12.5px] leading-relaxed">{t.advancedHint}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="unified-companyName">{t.companyName}</Label>
                <Input
                  id="unified-companyName"
                  autoComplete="organization"
                  placeholder={t.companyNamePlaceholder}
                  {...register("companyName")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unified-companySize">{t.companySize}</Label>
                <select
                  id="unified-companySize"
                  {...register("companySize")}
                  className="border-border bg-paper text-fg focus-visible:ring-terracotta h-10 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  <option value="">—</option>
                  {COMPANY_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {t.companySizeOptions[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="unified-companySector">{t.companySector}</Label>
                <Input
                  id="unified-companySector"
                  placeholder={t.companySectorPlaceholder}
                  {...register("companySector")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unified-timingWeeks">{t.timingWeeks}</Label>
                <select
                  id="unified-timingWeeks"
                  {...register("timingWeeks")}
                  className="border-border bg-paper text-fg focus-visible:ring-terracotta h-10 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  <option value="">—</option>
                  {TIMING_WEEKS.map((w) => (
                    <option key={w} value={w}>
                      {t.timingWeeksOptions[w]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unified-budget">{t.budgetIndicative}</Label>
              <Input
                id="unified-budget"
                placeholder={t.budgetIndicativePlaceholder}
                {...register("budgetIndicative")}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Consent */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="unified-consent"
          checked={!!consent}
          onCheckedChange={(c) =>
            setValue("consent", c === true ? true : (false as never), {
              shouldValidate: true,
            })
          }
        />
        <Label
          htmlFor="unified-consent"
          className="text-fg-soft cursor-pointer text-[13px] leading-relaxed"
        >
          {t.consent}
        </Label>
      </div>
      {errors.consent ? (
        <p role="alert" className="text-accent-red text-xs">
          {errors.consent.message}
        </p>
      ) : null}

      {/* Server error */}
      {serverError ? (
        <Alert variant="danger" role="alert">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Turnstile widget (invisible) */}
      {turnstileWidget}

      {/* Submit */}
      <Button
        type="submit"
        loading={isSubmitting}
        size="lg"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? t.sending : t.submit}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Button>

      {/* Trust pills */}
      <ul className="text-fg-muted flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
        {t.trustPills.map((p) => (
          <li key={p} className="inline-flex items-center gap-1.5">
            <Check aria-hidden="true" strokeWidth={3} className="text-terracotta-deep h-3 w-3" />
            {p}
          </li>
        ))}
      </ul>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Suspense boundary — isole `useSearchParams()`                              */
/* -------------------------------------------------------------------------- */

/**
 * Lit `?type=` / `?subType=` côté navigateur et les passe au corps du form.
 * Isolé dans son propre composant pour rester CONTENU dans le `<Suspense>`
 * ci-dessous. Sans ce boundary, `useSearchParams()` force toute la PAGE hôte
 * en rendu client (digest `BAILOUT_TO_CLIENT_SIDE_RENDERING`) → le HTML
 * serveur sort vide (h1/sections absents), ce qui casse l'indexation et
 * l'AEO/GEO des pages /presse, /contact et /audit/demande (pages statiques).
 * Même pattern que `cas-concrets/CaseStudiesFilteredGrid`.
 */
function UnifiedContactFormWithParams(props: UnifiedContactFormProps) {
  const searchParams = useSearchParams();
  return (
    <UnifiedContactFormBody
      {...props}
      urlType={searchParams.get("type")}
      urlSubType={searchParams.get("subType")}
    />
  );
}

/**
 * Export public. Le `fallback` rend le formulaire COMPLET avec ses valeurs par
 * défaut (sans override `?type=`/`?subType=`) : il est émis tel quel dans le
 * HTML statique (formulaire utilisable sans JS, zéro CLS car markup identique),
 * puis remplacé à l'hydratation par la version qui applique les params d'URL.
 * La page hôte reste statiquement pré-rendue (pas de bailout).
 */
export function UnifiedContactForm(props: UnifiedContactFormProps) {
  return (
    <React.Suspense
      fallback={<UnifiedContactFormBody {...props} urlType={null} urlSubType={null} />}
    >
      <UnifiedContactFormWithParams {...props} />
    </React.Suspense>
  );
}
