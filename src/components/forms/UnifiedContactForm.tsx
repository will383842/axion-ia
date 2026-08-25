"use client";
// use-client: react-hook-form + Zod + Turnstile + état du dévoilement progressif.
//
// Formulaire de contact unifié — refonte 2026-08-25 (Will).
//
// CE QUE LE VISITEUR VIVAIT AVANT, MESURÉ EN PRODUCTION
// -----------------------------------------------------
// Sur un écran de 390 px, le premier champ saisissable (« Nom complet »)
// tombait à ~1 100 px du haut de la page : deux écrans et demi de défilement
// avant de pouvoir taper une seule lettre. Le sélecteur d'objet à lui seul
// occupait cinq grandes cartes à icône, sept pastilles, et TROIS lignes d'aide
// concurrentes (« choisissez ce qui décrit le mieux », « un autre sujet ? »,
// « vous ne trouvez pas votre cas ? »).
//
// CE QUI CHANGE
// -------------
//   1. Sélecteur d'objet COMPACT : pastilles à emoji, les cinq intentions
//      commerciales visibles, les sept autres repliées derrière « Autre sujet ».
//      Le bloc passe d'environ 480 px de haut à environ 190 px.
//   2. `<input type="radio">` NATIFS, visuellement masqués, au lieu de
//      `role="radio"` posé sur des `<button>`. Trois gains : la navigation
//      clavier aux flèches redevient celle du navigateur (elle n'existait pas),
//      le choix part avec le formulaire même sans JS, et l'état sélectionné se
//      peint en CSS pur (`peer-checked:`) sans attendre un rendu React.
//   3. Validation au FLOU (`mode: "onTouched"`) : l'erreur s'affiche en
//      quittant le champ, plus seulement à la soumission.
//   4. Une seule ligne d'aide, dynamique, à hauteur réservée (CLS = 0).
//   5. Le placeholder du message s'adapte à l'intention choisie.
//   6. Le compteur de caractères ne s'affiche QUE lorsqu'il sert (trop court,
//      ou proche de la limite) — et il vit dans son propre sous-composant
//      (`useWatch`) pour ne pas re-rendre tout le formulaire à chaque frappe.
//   7. Le consentement pointe enfin vers la politique de confidentialité par un
//      VRAI lien : le texte la citait sans jamais y mener.
//
// Inchangé, à dessein : les six champs obligatoires (Will, 2026-08-25 — la
// question a été posée, la réponse est « rien ne change »), le honeypot, le
// Turnstile soft-fail, la server action, et l'API de props du composant.

import * as React from "react";
import { useForm, useWatch, type Control } from "react-hook-form";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { ACCENT_CLASSES, type ServiceAccent } from "@/content/services-visual";
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
import { Link } from "@/i18n/navigation";
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
    formAriaLabel: "Formulaire de contact Axion-IA",
    typeLabel: "Votre demande porte sur",
    typeMore: "Autre sujet",
    typeMoreClose: "Masquer les autres sujets",
    typePrompt: "Un seul choix suffit — il oriente votre message vers la bonne personne.",
    // Libellés COURTS : ce sont des pastilles, pas des cartes. Le libellé long
    // reste dans `unifiedTypeLabel` (schema) pour les e-mails et la console.
    typeOptions: {
      audit: "Audit IA",
      implementation: "Intégration",
      formation: "Formation",
      un_a_un: "Coaching 1-à-1",
      devis: "Devis",
      partenariat: "Partenariat",
      presse: "Presse / média",
      recrutement: "Recrutement",
      speaker: "Conférence",
      investisseur: "Investisseur",
      support_client: "Support client",
      autre: "Autre",
    },
    nom: "Nom complet",
    nomPlaceholder: "Prénom Nom",
    email: "Email professionnel",
    emailPlaceholder: "vous@entreprise.com",
    telephone: "Téléphone",
    telephoneHint: "Avec l'indicatif pays — ex. +33 6 12 34 56 78",
    telephonePlaceholder: "+33 6 12 34 56 78",
    ville: "Ville",
    villePlaceholder: "Paris",
    message: "Votre message",
    messagePlaceholderDefault:
      "Votre contexte, votre objectif, et ce qui bloque aujourd'hui. Trois phrases suffisent.",
    messageTooShort: (n: number) => `Encore ${n} caractère${n > 1 ? "s" : ""}`,
    messageNearLimit: (n: number) => `${n} / 2000`,
    advancedToggle: "Ajouter des détails (facultatif)",
    advancedHint: "Plus de contexte, c'est un devis plus juste et un premier appel plus court.",
    companyName: "Société",
    companyNamePlaceholder: "Raison sociale",
    companySize: "Effectif",
    companySizeOptions: {
      tpe: "TPE — 1 à 19",
      pme: "PME — 20 à 250",
      eti: "ETI — 250 à 5 000",
      grande_entreprise: "Grande entreprise — 5 000+",
    },
    companySector: "Secteur d'activité",
    companySectorPlaceholder: "Industrie, retail, santé…",
    budgetIndicative: "Budget pressenti",
    budgetIndicativePlaceholder:
      "10-20 k€, ou à définir" /* price-exempt: placeholder budget saisi par le visiteur, pas un tarif Axion-IA */,
    timingWeeks: "Timing souhaité",
    timingWeeksOptions: {
      "0-4": "0-4 semaines",
      "4-8": "4-8 semaines",
      "8-12": "8-12 semaines",
      "12+": "12+ semaines",
    },
    selectNone: "Non précisé",
    consentLead: "J'accepte que mes données servent à traiter cette demande, conformément à la ",
    consentLink: "politique de confidentialité",
    consentTail: ". Aucune revente, aucun profilage, désinscription à tout moment.",
    submit: "Envoyer ma demande",
    sending: "Envoi…",
    successTitle: "Demande reçue.",
    successBody:
      "Un consultant senior Axion-IA vous recontacte personnellement sous 48 h ouvrées. Votre projet a notre entière attention.",
    failure: "Une erreur est survenue. Réessayez ou écrivez à contact@axion-ia.com.",
    captchaBlocked:
      "Le contrôle anti-spam (Cloudflare) est bloqué par votre navigateur ou une extension. Autorisez « challenges.cloudflare.com » (ou désactivez votre bloqueur pour ce site), puis réessayez — ou écrivez-nous directement à contact@axion-ia.com.",
    pageOutdated:
      "Cette page a expiré suite à une mise à jour du site. Rechargez la page (Ctrl+R / ⌘+R) puis renvoyez votre demande.",
    typeRequired: "Choisissez un objet pour continuer.",
    submitAgain: "Faire une autre demande",
    referenceLabel: "Référence",
    trustPills: [
      "⏱️ Réponse sous 48 h ouvrées",
      "🧑 Lu par un consultant senior",
      "🔒 RGPD · données en UE",
      "🙂 Sans engagement",
    ],
  },
  en: {
    formAriaLabel: "Axion-IA contact form",
    typeLabel: "Your request is about",
    typeMore: "Another topic",
    typeMoreClose: "Hide other topics",
    typePrompt: "One choice is enough — it routes your message to the right person.",
    typeOptions: {
      audit: "AI audit",
      implementation: "Integration",
      formation: "Training",
      un_a_un: "1-to-1 coaching",
      devis: "Quote",
      partenariat: "Partnership",
      presse: "Press / media",
      recrutement: "Recruitment",
      speaker: "Speaking",
      investisseur: "Investor",
      support_client: "Support",
      autre: "Other",
    },
    nom: "Full name",
    nomPlaceholder: "First Last",
    email: "Work email",
    emailPlaceholder: "you@company.com",
    telephone: "Phone",
    telephoneHint: "With country code — e.g. +33 6 12 34 56 78",
    telephonePlaceholder: "+33 6 12 34 56 78",
    ville: "City",
    villePlaceholder: "Paris",
    message: "Your message",
    messagePlaceholderDefault:
      "Your context, your goal, and what is blocking you today. Three sentences will do.",
    messageTooShort: (n: number) => `${n} more character${n > 1 ? "s" : ""}`,
    messageNearLimit: (n: number) => `${n} / 2000`,
    advancedToggle: "Add details (optional)",
    advancedHint: "More context means a sharper quote and a shorter first call.",
    companyName: "Company",
    companyNamePlaceholder: "Company name",
    companySize: "Headcount",
    companySizeOptions: {
      tpe: "Small — 1 to 19",
      pme: "SME — 20 to 250",
      eti: "Mid-cap — 250 to 5,000",
      grande_entreprise: "Enterprise — 5,000+",
    },
    companySector: "Sector",
    companySectorPlaceholder: "Industry, retail, healthcare…",
    budgetIndicative: "Indicative budget",
    budgetIndicativePlaceholder:
      "10-20 k€, or TBD" /* price-exempt: visitor-entered budget placeholder, not an Axion-IA price */,
    timingWeeks: "Desired timing",
    timingWeeksOptions: {
      "0-4": "0-4 weeks",
      "4-8": "4-8 weeks",
      "8-12": "8-12 weeks",
      "12+": "12+ weeks",
    },
    selectNone: "Not specified",
    consentLead: "I agree my data is used to handle this request, per the ",
    consentLink: "privacy policy",
    consentTail: ". No resale, no profiling, one-click unsubscribe.",
    submit: "Send my request",
    sending: "Sending…",
    successTitle: "Request received.",
    successBody:
      "A senior Axion-IA consultant will get back to you personally within 48 business hours. Your project has our full attention.",
    failure: "An error occurred. Try again or email contact@axion-ia.com.",
    captchaBlocked:
      "The anti-spam check (Cloudflare) is blocked by your browser or an extension. Allow « challenges.cloudflare.com » (or disable your blocker for this site) and try again — or email us directly at contact@axion-ia.com.",
    pageOutdated:
      "This page expired after a site update. Reload the page (Ctrl+R / ⌘+R) and resend your request.",
    typeRequired: "Pick a topic to continue.",
    submitAgain: "Send another request",
    referenceLabel: "Reference",
    trustPills: [
      "⏱️ Reply within 48 business hours",
      "🧑 Read by a senior consultant",
      "🔒 GDPR · data in the EU",
      "🙂 No commitment",
    ],
  },
} as const;

// ---- Emoji + accent par intention -----------------------------------------
//
// Le pictogramme est un EMOJI et non une icône `lucide-react` : décision de
// Will du 2026-08-25, qui lève la doctrine « jamais d'emoji décoratif ». Un
// emoji est reconnu plus vite qu'un glyphe monochrome sur une pastille de
// 32 px, et il donne à la page le ton que Will demande.
//
// Chaque emoji est enveloppé d'un `aria-hidden` : le libellé textuel porte
// seul l'information, donc rien ne dépend de la police emoji du poste ni de la
// couleur (WCAG 1.4.1).
const TYPE_EMOJI: Record<UnifiedContactType, string> = {
  audit: "🔍",
  implementation: "⚙️",
  formation: "🎓",
  un_a_un: "🧭",
  devis: "📄",
  partenariat: "🤝",
  presse: "📰",
  recrutement: "💼",
  speaker: "🎤",
  investisseur: "📈",
  support_client: "🛟",
  autre: "💬",
};

// Groupe 1 = les cinq accents de la palette services (le visiteur retrouve le
// bleu de l'Audit et le sage de l'Implémentation vus dans le menu).
// Groupe 2 = terracotta unique, à dessein : la polychromie reste réservée aux
// intentions commerciales.
const TYPE_ACCENT: Record<UnifiedContactType, ServiceAccent> = {
  audit: "primary",
  implementation: "sage",
  formation: "terracotta",
  un_a_un: "ochre",
  devis: "plum",
  partenariat: "terracotta",
  presse: "terracotta",
  recrutement: "terracotta",
  speaker: "terracotta",
  investisseur: "terracotta",
  support_client: "terracotta",
  autre: "terracotta",
};

/**
 * État « coché » d'une pastille, en classes LITTÉRALES par accent.
 *
 * ⚠️ Ces chaînes ne peuvent pas être construites (`peer-checked:border-${a}`) :
 * le JIT Tailwind v4 scanne le source et ne génère que les classes qu'il y lit
 * en toutes lettres. Elles ne peuvent pas non plus venir de `ACCENT_CLASSES`,
 * qui ne porte pas la variante `peer-checked:`.
 *
 * Le couple fond/texte reprend `surface` + `textOnSurface` d'`ACCENT_CLASSES` :
 * c'est le seul couple vérifié WCAG AA sur ces fonds `-soft` (cf. le
 * commentaire de `textOnSurface` dans services-visual.ts).
 */
const PILL_CHECKED: Record<ServiceAccent, string> = {
  terracotta:
    "peer-checked:border-terracotta peer-checked:bg-terracotta-soft peer-checked:text-terracotta-deep peer-focus-visible:ring-terracotta",
  ochre:
    "peer-checked:border-ochre peer-checked:bg-ochre-soft peer-checked:text-ochre-deep peer-focus-visible:ring-ochre",
  primary:
    "peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:text-primary peer-focus-visible:ring-primary",
  sage: "peer-checked:border-sage peer-checked:bg-sage-soft peer-checked:text-sage peer-focus-visible:ring-sage",
  plum: "peer-checked:border-plum peer-checked:bg-plum-soft peer-checked:text-plum-deep peer-focus-visible:ring-plum",
};

/**
 * Placeholder du message, adapté à l'intention.
 *
 * Un champ libre est le moment où l'on abandonne : le visiteur ne sait pas ce
 * qu'on attend. Une amorce qui parle de SON cas divise le temps de rédaction.
 */
function messagePlaceholder(type: UnifiedContactType | undefined, locale: "fr" | "en"): string {
  if (!type) return LABELS[locale].messagePlaceholderDefault;
  const fr: Record<UnifiedContactType, string> = {
    audit: "Votre métier, vos outils actuels, et ce que vous aimeriez qu'on regarde en priorité.",
    implementation:
      "Ce que vous voulez automatiser, sur quelles données, et avec quel outil aujourd'hui.",
    formation:
      "Combien de personnes, quels métiers, quel niveau de départ, et vos dates possibles.",
    un_a_un:
      "Qui serait accompagné, sur quel sujet, et ce que vous voulez savoir faire seul après.",
    devis: "Le périmètre, les livrables attendus, et votre échéance.",
    partenariat: "Votre activité, ce que vous proposez, et ce que vous attendez de nous.",
    presse: "Votre média, votre angle, et votre date de bouclage.",
    recrutement: "Le poste visé, ce que vous savez faire, et un lien vers votre travail.",
    speaker: "L'événement, la date, le public attendu et le format d'intervention.",
    investisseur: "Votre structure, votre thèse et ce que vous souhaitez examiner.",
    support_client: "Ce qui ne fonctionne pas, depuis quand, et sur quelle prestation.",
    autre: "Dites-nous simplement de quoi il s'agit.",
  };
  const en: Record<UnifiedContactType, string> = {
    audit: "Your business, the tools you use today, and what you would like us to look at first.",
    implementation: "What you want to automate, on which data, and with which tool today.",
    formation: "How many people, which roles, starting level, and your possible dates.",
    un_a_un: "Who would be coached, on what topic, and what you want to master on your own after.",
    devis: "The scope, the expected deliverables, and your deadline.",
    partenariat: "Your business, what you offer, and what you expect from us.",
    presse: "Your outlet, your angle, and your deadline.",
    recrutement: "The role, what you can do, and a link to your work.",
    speaker: "The event, the date, the expected audience and the format.",
    investisseur: "Your firm, your thesis, and what you would like to review.",
    support_client: "What is not working, since when, and on which engagement.",
    autre: "Just tell us what it is about.",
  };
  return (locale === "en" ? en : fr)[type];
}

// ---- Props -----------------------------------------------------------------

export interface UnifiedContactFormProps {
  /** Pré-sélectionne le type. */
  defaultType?: UnifiedContactType;
  /** Bloque la modification du type — masque le sélecteur. */
  lockType?: boolean;
  /** Granularité fine (audit-flash, chatbot, etc.) — stockée en details.subType. */
  defaultSubType?: string;
  /** Message pré-rempli. */
  defaultMessage?: string;
  /** Bloc « ajouter des détails » forcé ouvert. */
  advancedOpenByDefault?: boolean;
  /** Source override (sinon usePathname()). */
  source?: string;
  className?: string;
}

// ---- Sous-composants -------------------------------------------------------

/** Astérisque des champs requis — même signe partout. */
function Req() {
  return <span className="text-terracotta-deep ml-1 font-bold">*</span>;
}

/**
 * Compteur du message, isolé dans son propre nœud.
 *
 * `useWatch` abonne CE composant à la valeur, et lui seul : sans ça, chaque
 * frappe re-rendait le formulaire entier (douze pastilles, dix champs), ce qui
 * se paie directement sur l'INP.
 *
 * Il ne dit quelque chose que quand il sert : le minimum n'est pas atteint, ou
 * la limite approche. Un compteur permanent « 0 / 2000 » sous un champ vide
 * n'informe personne et alourdit la page.
 */
function MessageMeter({
  control,
  locale,
}: {
  control: Control<UnifiedContactInput>;
  locale: "fr" | "en";
}) {
  const t = LABELS[locale];
  const value = useWatch({ control, name: "message" }) ?? "";
  const len = value.length;
  if (len > 0 && len < 20) {
    return (
      <span className="text-fg-muted text-[12px] tabular-nums" aria-live="polite">
        {t.messageTooShort(20 - len)}
      </span>
    );
  }
  if (len >= 1800) {
    return (
      <span
        className={cn(
          "text-[12px] font-semibold tabular-nums",
          len >= 2000 ? "text-accent-red" : "text-fg-muted",
        )}
        aria-live="polite"
      >
        {t.messageNearLimit(len)}
      </span>
    );
  }
  return null;
}

// ---- Composant -------------------------------------------------------------

function isAdvancedType(t: UnifiedContactType | undefined): boolean {
  return t === "audit" || t === "implementation";
}

function isSecondaryType(t: UnifiedContactType | undefined): boolean {
  return t !== undefined && (TYPE_GROUPS.autre as readonly UnifiedContactType[]).includes(t);
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
    control,
    watch,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<UnifiedContactInput>({
    resolver: zodResolver(unifiedContactSchema as never) as never,
    // Validation au FLOU, puis à la frappe une fois le champ en faute.
    // Le défaut de react-hook-form (`onSubmit`) gardait le visiteur dans le
    // noir jusqu'au bouton : il découvrait ses six erreurs d'un coup.
    mode: "onTouched",
    reValidateMode: "onChange",
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

  const [advancedOpen, setAdvancedOpen] = React.useState<boolean>(
    advancedOpenByDefault === true || isAdvancedType(initialType),
  );
  // Les sept intentions périphériques sont repliées — sauf si l'une d'elles est
  // déjà choisie (deep-link `?type=presse`, ou retour arrière du navigateur) :
  // une pastille cochée mais invisible serait un état incompréhensible.
  const [moreOpen, setMoreOpen] = React.useState<boolean>(isSecondaryType(initialType));

  // Si l'user change vers audit/implementation, on ouvre le bloc détails.
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
      const next = urlType as UnifiedContactType;
      setValue("type", next, { shouldValidate: true });
      if (isSecondaryType(next)) setMoreOpen(true);
    }
    if (urlSubType && !defaultSubType) {
      setEffectiveSubType(urlSubType);
    }
    // Montage unique : on lit l'URL une fois après hydratation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          "border-sage/40 bg-paper shadow-card rounded-3xl border-2 p-7 sm:p-9",
          className,
        )}
        role="status"
      >
        <span
          aria-hidden="true"
          className="bg-sage text-paper mb-5 flex h-11 w-11 items-center justify-center rounded-2xl"
        >
          <Check strokeWidth={3.5} className="h-6 w-6" />
        </span>
        <p
          className="text-fg text-2xl leading-snug font-medium tracking-tight sm:text-3xl"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {t.successTitle}
        </p>
        <p className="text-fg-soft mt-3 text-base leading-relaxed">{t.successBody}</p>
        {submissionId ? (
          <p className="text-fg-muted mt-4 text-sm">
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

  // ---- Pastille d'intention ----------------------------------------------
  // `<input type="radio">` natif transparent + `<span>` peint en `peer-checked:`.
  // L'état sélectionné se voit par TROIS signes : la coche en pastille d'angle,
  // le fond teinté, et la bordure d'accent. Jamais par la couleur seule.
  const renderPill = (opt: UnifiedContactType, compact: boolean) => {
    const accent = TYPE_ACCENT[opt];
    return (
      <label key={opt} className="relative inline-flex cursor-pointer">
        {/* Le bouton radio est TRANSPARENT et recouvre toute la pastille, au
            lieu d'être `sr-only`. Un `sr-only` est réduit à 1 × 1 px : la souris
            ne l'atteint jamais (c'est le `<label>` qui relaie le clic), et tout
            outil qui pilote le vrai contrôle — Playwright, un lecteur d'écran
            en mode formulaire, une extension d'accessibilité — bute dessus.
            Ici, la cible cliquable EST le contrôle, à la taille de la pastille. */}
        <input
          type="radio"
          value={opt}
          {...register("type")}
          className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
          aria-describedby="unified-type-hint"
        />
        {/* Coche de confirmation — l'état sélectionné ne repose PAS que sur la
            couleur (WCAG 1.4.1 « use of color »). Elle est en position absolue,
            donc son apparition ne décale aucune pastille : la grille ne bouge
            pas au clic (CLS = 0). */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full opacity-0 transition-opacity peer-checked:opacity-100",
            ACCENT_CLASSES[accent].chipSolid,
          )}
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
        </span>
        <span
          className={cn(
            "border-border bg-paper text-fg flex items-center gap-2 rounded-full border-2 font-semibold transition",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
            compact ? "px-2.5 py-1.5 text-[12px]" : "px-3 py-2 text-[13px]",
            ACCENT_CLASSES[accent].hoverBorder,
            PILL_CHECKED[accent],
          )}
        >
          <span aria-hidden="true" className={compact ? "text-[13px]" : "text-[15px]"}>
            {TYPE_EMOJI[opt]}
          </span>
          {t.typeOptions[opt]}
        </span>
      </label>
    );
  };

  // ---- Form --------------------------------------------------------------
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={cn("space-y-5", className)}
      aria-label={t.formAriaLabel}
    >
      <HoneypotField />

      {/* Objet de la demande — pastilles compactes.
          Cinq intentions commerciales visibles, sept périphériques repliées :
          le bloc tient en ~190 px au lieu de ~480 px, ce qui suffit à faire
          remonter « Nom complet » dans le premier écran d'un téléphone. */}
      {!lockType ? (
        // `min-w-0` est OBLIGATOIRE : un <fieldset> porte
        // `min-inline-size: min-content` par la feuille de style du navigateur et
        // refuse de rétrécir — sans lui, il pousse la page hors de l'écran sur un
        // téléphone étroit. Verrouillé par `formulaires-mobile-first.spec.ts`.
        //
        // ⚠️ Commentaire de LIGNE, pas `{/* … */}` : on est ici dans la branche
        // d'un ternaire, donc en position d'EXPRESSION et non d'enfant JSX — une
        // accolade y ouvre un littéral d'objet, et le parseur meurt sur le
        // `<fieldset>` suivant (« Expected '</', got 'ident' »).
        <fieldset className="min-w-0 space-y-3">
          <legend className="text-fg mb-1.5 block text-[15px] font-bold sm:text-base">
            {t.typeLabel}
            <Req />
          </legend>

          <div className="flex flex-wrap gap-2">
            {TYPE_GROUPS.projet.map((opt) => renderPill(opt, false))}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-controls="unified-type-more"
              className="text-fg-soft hover:text-terracotta-deep focus-visible:ring-terracotta inline-flex items-center gap-1.5 rounded text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <ChevronDown
                aria-hidden="true"
                className={cn("h-4 w-4 transition-transform", moreOpen ? "rotate-180" : "rotate-0")}
              />
              {moreOpen ? t.typeMoreClose : t.typeMore}
            </button>
            {/* Le conteneur est TOUJOURS rendu, masqué par `hidden` quand il est
                replié : un `aria-controls` qui désigne un élément absent du DOM
                est une référence morte, et le lecteur d'écran n'a plus rien à
                annoncer quand `aria-expanded` passe à `true`. */}
            <div
              id="unified-type-more"
              className={cn("mt-2.5 flex-wrap gap-2", moreOpen ? "flex" : "hidden")}
            >
              {TYPE_GROUPS.autre.map((opt) => renderPill(opt, true))}
            </div>
          </div>

          {/* Une seule ligne d'aide — hauteur réservée pour que le choix d'une
              intention ne pousse pas les champs vers le bas (CLS = 0). */}
          <p
            id="unified-type-hint"
            aria-live="polite"
            className={cn(
              "flex min-h-[38px] items-start gap-2 rounded-xl px-3 py-2 text-[13px] leading-snug transition-colors",
              type
                ? cn(ACCENT_CLASSES[TYPE_ACCENT[type]].surface, "text-fg")
                : "text-fg-muted bg-transparent",
            )}
          >
            {type ? (
              <>
                <ArrowRight
                  aria-hidden="true"
                  className={cn(
                    "mt-[3px] h-3.5 w-3.5 shrink-0",
                    ACCENT_CLASSES[TYPE_ACCENT[type]].textOnSurface,
                  )}
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

      {/* Nom + Email — empilés sur mobile, appariés dès `sm`. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="unified-nom">
            {t.nom}
            <Req />
          </Label>
          <Input
            id="unified-nom"
            aria-required="true"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
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
        <div className="grid gap-1.5">
          <Label htmlFor="unified-email">
            {t.email}
            <Req />
          </Label>
          <Input
            id="unified-email"
            aria-required="true"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
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
        <div className="grid gap-1.5">
          <Label htmlFor="unified-telephone">
            {t.telephone}
            <Req />
          </Label>
          <Input
            id="unified-telephone"
            aria-required="true"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            placeholder={t.telephonePlaceholder}
            {...register("telephone")}
            aria-invalid={!!errors.telephone}
            // L'indicatif pays est OBLIGATOIRE (regex du schema). Il vivait dans
            // le libellé — « Téléphone (avec indicatif pays) » —, ce qui allongeait
            // la ligne sans jamais montrer la forme attendue. Il est désormais
            // dit sous le champ, et rattaché par aria-describedby.
            aria-describedby={
              errors.telephone ? "unified-tel-err unified-tel-hint" : "unified-tel-hint"
            }
          />
          {errors.telephone ? (
            <p id="unified-tel-err" role="alert" className="text-accent-red text-xs">
              {errors.telephone.message}
            </p>
          ) : (
            <p id="unified-tel-hint" className="text-fg-muted text-[12px]">
              {t.telephoneHint}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="unified-ville">
            {t.ville}
            <Req />
          </Label>
          <Input
            id="unified-ville"
            aria-required="true"
            autoComplete="address-level2"
            autoCapitalize="words"
            enterKeyHint="next"
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

      {/* Message — l'amorce s'adapte à l'intention choisie. */}
      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="unified-message">
            {t.message}
            <Req />
          </Label>
          <MessageMeter control={control} locale={locale} />
        </div>
        <Textarea
          id="unified-message"
          aria-required="true"
          rows={4}
          placeholder={messagePlaceholder(type, locale)}
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

      {/* Détails facultatifs */}
      <div className="border-border border-t pt-4">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
          aria-controls="unified-advanced"
          className="group text-fg-soft hover:text-terracotta-deep focus-visible:ring-terracotta inline-flex items-center gap-2 rounded text-[13.5px] font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 transition-transform", advancedOpen ? "rotate-180" : "rotate-0")}
          />
          {t.advancedToggle}
        </button>
        {/* Même raison que pour « Autre sujet » : le conteneur reste dans le DOM
            pour que `aria-controls` désigne quelque chose. */}
        <div
          id="unified-advanced"
          className={cn("mt-4 space-y-4", advancedOpen ? "block" : "hidden")}
        >
          <p className="text-fg-muted text-[12.5px] leading-relaxed">{t.advancedHint}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="unified-companyName">{t.companyName}</Label>
              <Input
                id="unified-companyName"
                autoComplete="organization"
                placeholder={t.companyNamePlaceholder}
                {...register("companyName")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="unified-companySize">{t.companySize}</Label>
              <select
                id="unified-companySize"
                {...register("companySize")}
                className="border-border-strong bg-paper text-fg focus-visible:border-terracotta focus-visible:ring-terracotta/20 h-12 rounded-lg border px-3 text-base transition focus-visible:ring-4 focus-visible:outline-none"
              >
                <option value="">{t.selectNone}</option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {t.companySizeOptions[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="unified-companySector">{t.companySector}</Label>
              <Input
                id="unified-companySector"
                placeholder={t.companySectorPlaceholder}
                {...register("companySector")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="unified-timingWeeks">{t.timingWeeks}</Label>
              <select
                id="unified-timingWeeks"
                {...register("timingWeeks")}
                className="border-border-strong bg-paper text-fg focus-visible:border-terracotta focus-visible:ring-terracotta/20 h-12 rounded-lg border px-3 text-base transition focus-visible:ring-4 focus-visible:outline-none"
              >
                <option value="">{t.selectNone}</option>
                {TIMING_WEEKS.map((w) => (
                  <option key={w} value={w}>
                    {t.timingWeeksOptions[w]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="unified-budget">{t.budgetIndicative}</Label>
            <Input
              id="unified-budget"
              placeholder={t.budgetIndicativePlaceholder}
              {...register("budgetIndicative")}
            />
          </div>
        </div>
      </div>

      {/* Consentement — le lien vers la politique de confidentialité est un
          VRAI lien depuis 2026-08-25 : le texte la citait sans y mener. */}
      <div className="border-border bg-bg flex items-start gap-3 rounded-2xl border p-4">
        <Checkbox
          id="unified-consent"
          aria-required="true"
          checked={!!consent}
          onCheckedChange={(c) =>
            setValue("consent", c === true ? true : (false as never), {
              shouldValidate: true,
            })
          }
          aria-describedby="unified-consent-text"
        />
        <Label
          htmlFor="unified-consent"
          id="unified-consent-text"
          className="text-fg-soft cursor-pointer text-[13px] leading-relaxed font-normal"
        >
          {t.consentLead}
          <Link
            href="/politique-confidentialite"
            className="text-terracotta-deep underline underline-offset-2"
            // Le clic sur un lien DANS un <label> cocherait la case : on arrête
            // la propagation pour que le lien reste un lien.
            onClick={(e) => e.stopPropagation()}
          >
            {t.consentLink}
          </Link>
          {t.consentTail}
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
        className="group shadow-elevated w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? t.sending : t.submit}
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
        />
      </Button>

      <ul className="text-fg-muted flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12px]">
        {t.trustPills.map((pill) => (
          <li key={pill}>{pill}</li>
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
 */
export function UnifiedContactForm(props: UnifiedContactFormProps) {
  return <UnifiedContactFormBody {...props} />;
}
