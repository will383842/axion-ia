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
import { usePathname } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ScanSearch,
  Boxes,
  GraduationCap,
  UserRound,
  FileText,
  Handshake,
  Newspaper,
  Briefcase,
  Mic,
  LineChart,
  LifeBuoy,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import {
  unifiedContactSchema,
  UNIFIED_CONTACT_TYPES,
  TYPE_GROUPS,
  COMPANY_SIZES,
  TIMING_WEEKS,
  unifiedTypeHint,
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
import { isStaleServerActionError } from "@/lib/forms/form-errors";
import { cn } from "@/lib/utils";

// ---- Labels i18n ----------------------------------------------------------

const LABELS = {
  fr: {
    eyebrow: "Démarrer un échange",
    title: "Décrivez votre besoin",
    titleEm: "en quelques secondes",
    subtitle:
      "Chaque demande est lue personnellement par un consultant senior Axion-IA. Réponse sous 24 h ouvrées. Sans engagement.",
    typeLabel: "Que pouvons-nous faire pour vous ?",
    typePrompt: "Choisissez ce qui décrit le mieux votre demande — un seul suffit.",
    typeHelp: "Vous ne trouvez pas votre cas ? Choisissez « Autre » — le formulaire sert à tout.",
    typeGroupHint: "Un autre sujet ?",
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
    captchaBlocked:
      "Le contrôle anti-spam (Cloudflare) est bloqué par votre navigateur ou une extension. Autorisez « challenges.cloudflare.com » (ou désactivez votre bloqueur pour ce site), puis réessayez — ou écrivez-nous directement à contact@axion-ia.com.",
    pageOutdated:
      "Cette page a expiré suite à une mise à jour du site. Rechargez la page (Ctrl+R / ⌘+R) puis renvoyez votre demande.",
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
    typeLabel: "What can we do for you?",
    typePrompt: "Pick the one that best describes your request — just one.",
    typeHelp: "Not sure where you fit? Pick « Other » — this form covers everything.",
    typeGroupHint: "Something else?",
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
    captchaBlocked:
      "The anti-spam check (Cloudflare) is blocked by your browser or an extension. Allow « challenges.cloudflare.com » (or disable your blocker for this site) and try again — or email us directly at contact@axion-ia.com.",
    pageOutdated:
      "This page expired after a site update. Reload the page (Ctrl+R / ⌘+R) and resend your request.",
    typeRequired: "Pick a type to continue.",
    submitAgain: "Send another request",
    referenceLabel: "Reference",
    trustPills: ["RGPD · UE", "Réponse 24 h ouvrées", "Sans engagement"],
  },
} as const;

// ---- Icônes par type (grille de sélection visuelle) ------------------------
// Chaque intention a son icône lucide — la sélection devient scannable d'un
// coup d'œil (pattern 2026 : Linear, Vercel, Stripe). Remplace le dropdown
// caché qui pré-affichait « Autre demande » comme un fallback (refonte
// 2026-07-09 : sélecteur visuel, zéro friction).
const TYPE_ICONS: Record<UnifiedContactType, LucideIcon> = {
  audit: ScanSearch,
  implementation: Boxes,
  formation: GraduationCap,
  un_a_un: UserRound,
  devis: FileText,
  partenariat: Handshake,
  presse: Newspaper,
  recrutement: Briefcase,
  speaker: Mic,
  investisseur: LineChart,
  support_client: LifeBuoy,
  autre: MessageCircle,
};

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
}: UnifiedContactFormProps) {
  const locale = (useLocale() === "en" ? "en" : "fr") as "fr" | "en";
  const t = LABELS[locale];
  const pathname = usePathname();

  // ?type= / ?subType= sont lus APRÈS le montage (useEffect ci-dessous), et non
  // via useSearchParams() pendant le rendu. useSearchParams() suspendait sur une
  // page statiquement pré-rendue → frontière Suspense « pending » qui ne se
  // ré-hydratait PAS au chargement direct (le formulaire restait figé, 0 fiber
  // React ; seule la navigation interne le rendait interactif). Lecture post-
  // montage = la page reste statique (aucun bailout CSR, HTML serveur complet)
  // ET l'îlot s'hydrate normalement au chargement direct. Chantier 2026-07-01.
  const initialType: UnifiedContactType | undefined = defaultType;

  const effectiveSource = source ?? pathname ?? undefined;
  const [effectiveSubType, setEffectiveSubType] = React.useState<string | undefined>(
    defaultSubType ?? undefined,
  );

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

  // Applique les deep-links ?type= / ?subType= APRÈS le montage (client-only),
  // en remplacement de useSearchParams()+Suspense (cf. commentaire plus haut).
  // Équivalent SEO : le SSR n'appliquait déjà pas ?type= (fallback urlType=null) ;
  // on l'applique ici juste après l'hydratation.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const urlType = sp.get("type");
    const urlSubType = sp.get("subType");
    if (!lockType && urlType && UNIFIED_CONTACT_TYPES.includes(urlType as UnifiedContactType)) {
      setValue("type", urlType as UnifiedContactType, { shouldValidate: true });
    }
    if (urlSubType && !defaultSubType) {
      setEffectiveSubType(urlSubType);
    }
    // Montage unique : on lit l'URL une fois après hydratation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sélection du type — grille de chips visuels (refonte 2026-07-09). Plus de
  // dropdown/popover : les 12 intentions sont toutes visibles, sélectionnables
  // en un tap, sans état d'ouverture ni gestion click-outside/Escape.
  const selectType = React.useCallback(
    (opt: UnifiedContactType) => setValue("type", opt, { shouldValidate: true, shouldDirty: true }),
    // setValue est stable (react-hook-form) — dépendances vides volontaires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
  } = useTurnstileToken("unified-contact");
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submissionId, setSubmissionId] = React.useState<string | null>(null);

  async function onSubmit(values: UnifiedContactInput) {
    setServerError(null);
    // Zéro friction (Will 2026-07-01) : on n'empêche PLUS l'envoi si Turnstile
    // n'a pas produit de token (bloqueur/DNS). Le serveur soft-fail le captcha
    // (honeypot + rate-limit protègent). On envoie le token s'il existe.
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
        const message = result.error || t.failure;
        setServerError(message);
        throw new Error(message);
      }
      setSubmissionId(result.submissionId || null);
    } catch (err) {
      // Deploy-skew (Server Action introuvable car page chargée avant un
      // déploiement) → message « rechargez » plutôt que générique.
      if (isStaleServerActionError(err)) {
        setServerError(t.pageOutdated);
      } else if (!serverError) {
        setServerError(t.failure);
      }
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  // ---- Succès ------------------------------------------------------------
  if (isSubmitSuccessful && !serverError) {
    return (
      <div
        className={cn(
          "border-terracotta/30 bg-paper shadow-card rounded-3xl border-2 p-8 sm:p-10",
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

      {/* Objet de la demande — grille de chips visuels (refonte 2026-07-09).
          Remplace le dropdown/popover qui pré-affichait « Autre demande » comme
          un fallback (effet « pré-rempli / cassé »). Les 12 intentions sont
          désormais visibles d'un coup d'œil, sélectionnables en un tap : le
          Projet IA en grille prominente à icônes, les autres demandes en
          pastilles discrètes dessous. Un helper dynamique décrit l'intention
          choisie. Zéro friction, mobile-first, sans état d'ouverture. */}
      {!lockType ? (
        <fieldset className="space-y-3.5">
          <legend className="text-fg mb-1 block text-base font-bold sm:text-lg">
            {t.typeLabel}
            <span className="text-terracotta-deep ml-1.5 font-bold">*</span>
          </legend>

          {/* Groupe 1 — Projet IA : chips prominents (icône + libellé) */}
          <div
            role="radiogroup"
            aria-label={t.typeGroups.projet}
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
          >
            {TYPE_GROUPS.projet.map((opt) => {
              const Icon = TYPE_ICONS[opt];
              const isSel = type === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={isSel}
                  onClick={() => selectType(opt)}
                  className={cn(
                    "group focus-visible:ring-terracotta/40 flex flex-col items-start gap-2 rounded-2xl border-2 p-3.5 text-left transition-all focus-visible:ring-4 focus-visible:outline-none",
                    isSel
                      ? "border-terracotta bg-terracotta-soft shadow-sm"
                      : "border-border bg-paper hover:border-terracotta/50 hover:bg-terracotta-soft/30",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                      isSel
                        ? "bg-terracotta text-mocha-fg"
                        : "bg-sand text-fg-soft group-hover:bg-terracotta-soft group-hover:text-terracotta-deep",
                    )}
                  >
                    <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </span>
                  <span
                    className={cn(
                      "text-[13.5px] leading-tight font-semibold",
                      isSel ? "text-terracotta-deep" : "text-fg",
                    )}
                  >
                    {t.typeOptions[opt]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Groupe 2 — Autres demandes : pastilles discrètes (hiérarchie) */}
          <div className="border-border/70 border-t pt-3.5">
            <p className="text-fg-muted mb-2 text-[11px] font-semibold tracking-[0.14em] uppercase">
              {t.typeGroupHint}
            </p>
            <div role="radiogroup" aria-label={t.typeGroups.autre} className="flex flex-wrap gap-2">
              {TYPE_GROUPS.autre.map((opt) => {
                const Icon = TYPE_ICONS[opt];
                const isSel = type === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={isSel}
                    onClick={() => selectType(opt)}
                    className={cn(
                      "focus-visible:ring-terracotta/40 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-all focus-visible:ring-4 focus-visible:outline-none",
                      isSel
                        ? "border-terracotta bg-terracotta-soft text-terracotta-deep"
                        : "border-border bg-paper text-fg-soft hover:border-terracotta/50 hover:text-fg",
                    )}
                  >
                    <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                    {t.typeOptions[opt]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Helper dynamique : décrit l'intention choisie (ou invite à choisir) */}
          <p
            className={cn(
              "flex items-start gap-2 text-[13px] leading-relaxed",
              type ? "text-fg-soft" : "text-fg-muted",
            )}
            aria-live="polite"
          >
            {type ? (
              <>
                <ArrowRight
                  aria-hidden="true"
                  className="text-terracotta mt-[3px] h-3.5 w-3.5 shrink-0"
                  strokeWidth={2.5}
                />
                <span>{unifiedTypeHint(type, locale)}</span>
              </>
            ) : (
              <span>{t.typePrompt}</span>
            )}
          </p>

          {errors.type ? (
            <p role="alert" className="text-accent-red text-xs">
              {errors.type.message ?? t.typeRequired}
            </p>
          ) : null}
        </fieldset>
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

/**
 * Export public. Le corps rend directement le formulaire complet (utilisable
 * sans JS, HTML serveur complet → indexation + AEO/GEO préservés).
 *
 * IMPORTANT — plus de `useSearchParams()` ni de `<Suspense>` :
 * l'ancienne version isolait `useSearchParams()` dans un `<Suspense>` pour
 * éviter le `BAILOUT_TO_CLIENT_SIDE_RENDERING`. Mais sur ces pages statiquement
 * pré-rendues, ça créait une frontière Suspense « pending » (`<!--$?-->`) qui
 * ne se ré-hydratait PAS au chargement direct (formulaire figé, 0 fiber ; seule
 * la navigation interne le rendait interactif). Les deep-links `?type=` /
 * `?subType=` sont désormais appliqués côté client via `useEffect` dans le corps
 * (cf. commentaires plus haut) : pas de bailout, pas de frontière pending, et
 * l'îlot s'hydrate normalement au chargement direct. Chantier 2026-07-01.
 * Même correctif à appliquer à `cas-concrets/CaseStudiesFilteredGrid`.
 */
export function UnifiedContactForm(props: UnifiedContactFormProps) {
  return <UnifiedContactFormBody {...props} />;
}
