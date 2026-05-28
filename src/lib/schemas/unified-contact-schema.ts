// Unified contact form — schema Zod (2026-05-24).
//
// Remplace 6 schemas distincts (contact, audit, audit-request, implementation,
// quote-request, intervention) par un seul, discriminé par le champ `type`.
//
// Voir _AUDIT/FORMS-UNIFICATION-2026-05-24/02-DESIGN.md.

import { z } from "zod";

// ---- Types & enums ---------------------------------------------------------

// 12 types couvrant 100 % des demandes possibles (v2 2026-05-28).
//
// Organisation en 2 groupes visuels côté UI (TYPE_GROUPS ci-dessous), mais le
// schema reste à plat (discriminant unique). Les nouveaux types (presse,
// recrutement, speaker, investisseur, support_client) s'inscrivent dans le
// pattern polymorphe Submission — pas de migration DB nécessaire, dispatch
// notif/email/Telegram routé via les helpers de actions.ts.
export const UNIFIED_CONTACT_TYPES = [
  // Groupe 1 — Projet IA pour mon entreprise (intent commercial)
  "audit",
  "implementation",
  "formation",
  "un_a_un",
  "devis",
  // Groupe 2 — Autres demandes (non-commercial / périphérique)
  "partenariat",
  "presse",
  "recrutement",
  "speaker",
  "investisseur",
  "support_client",
  "autre",
] as const;
export type UnifiedContactType = (typeof UNIFIED_CONTACT_TYPES)[number];

// Groupes UI — partitionnent les 12 types pour le segmented control bi-section.
// Évite la liste de 12 boutons en ligne (cognitive overload).
export const TYPE_GROUPS = {
  projet: ["audit", "implementation", "formation", "un_a_un", "devis"],
  autre: ["partenariat", "presse", "recrutement", "speaker", "investisseur", "support_client", "autre"],
} as const satisfies Record<string, readonly UnifiedContactType[]>;

export const COMPANY_SIZES = ["tpe", "pme", "eti", "grande_entreprise"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const TIMING_WEEKS = ["0-4", "4-8", "8-12", "12+"] as const;
export type TimingWeeks = (typeof TIMING_WEEKS)[number];

// ---- Schema ---------------------------------------------------------------

/**
 * Schema unifié.
 *
 * - Champs base (6) : type, nom, email, telephone, ville, message — tous requis.
 * - Champs avancés (5) : companyName, companySize, companySector,
 *   budgetIndicative, timingWeeks — tous optionnels.
 * - Métadonnées hidden : locale, source, subType, consentVersion.
 * - Consentement obligatoire.
 */
export const unifiedContactSchema = z.object({
  // -- Discriminant
  type: z.enum(UNIFIED_CONTACT_TYPES, {
    errorMap: () => ({ message: "Type de demande requis." }),
  }),

  // -- Base (6 champs visibles)
  nom: z.string().trim().min(2, "Nom requis (2 caractères minimum).").max(80, "Nom trop long."),
  email: z
    .string()
    .trim()
    .min(1, "Email requis.")
    .email("Email invalide.")
    .max(254, "Email trop long."),
  telephone: z
    .string()
    .trim()
    .min(8, "Téléphone requis avec indicatif pays.")
    .max(30, "Téléphone trop long.")
    .regex(
      /^(\+|00)[0-9]{1,3}[\s0-9()\-.]{4,28}$/,
      "Indicatif pays obligatoire (ex : +33 6 12 34 56 78 ou 0033 6 12 34 56 78).",
    ),
  ville: z.string().trim().min(2, "Ville requise.").max(120, "Ville trop longue."),
  message: z
    .string()
    .trim()
    .min(20, "Au moins 20 caractères.")
    .max(2000, "2 000 caractères maximum."),

  // -- Avancé (5 champs optionnels, révélés via toggle)
  companyName: z.string().trim().max(255).optional(),
  companySize: z.enum(COMPANY_SIZES).optional(),
  companySector: z.string().trim().max(100).optional(),
  budgetIndicative: z.string().trim().max(80).optional(),
  timingWeeks: z.enum(TIMING_WEEKS).optional(),

  // -- Métadonnées
  locale: z.enum(["fr", "en"]).default("fr"),
  source: z.string().max(500).optional(),
  subType: z.string().max(80).optional(),

  // -- Consentement
  consent: z.literal(true, {
    errorMap: () => ({ message: "Consentement requis." }),
  }),
});

export type UnifiedContactInput = z.infer<typeof unifiedContactSchema>;

// ---- Helper : libellé i18n du type ----------------------------------------

export function unifiedTypeLabel(type: UnifiedContactType, locale: "fr" | "en"): string {
  const labels: Record<UnifiedContactType, { fr: string; en: string }> = {
    // Groupe 1 — Projet IA pour mon entreprise
    audit: { fr: "Audit IA", en: "AI audit" },
    implementation: { fr: "Intégration sur-mesure", en: "Bespoke integration" },
    formation: { fr: "Formation IA", en: "AI training" },
    un_a_un: { fr: "Coaching 1 to 1", en: "1-to-1 coaching" },
    devis: { fr: "Devis sur projet", en: "Project quote" },
    // Groupe 2 — Autres demandes
    partenariat: { fr: "Partenariat", en: "Partnership" },
    presse: { fr: "Presse / média", en: "Press / media" },
    recrutement: { fr: "Recrutement", en: "Recruitment" },
    speaker: { fr: "Invitation conférence", en: "Speaking invitation" },
    investisseur: { fr: "Investisseur / M&A", en: "Investor / M&A" },
    support_client: { fr: "Support client", en: "Customer support" },
    autre: { fr: "Autre demande", en: "Other request" },
  };
  return labels[type][locale];
}

// Sous-headline d'aide affichée sous le label dans le type selector — guide le
// visiteur vers le bon type (très visible 2026 UX : Linear, Stripe le font).
export function unifiedTypeHint(type: UnifiedContactType, locale: "fr" | "en"): string {
  const hints: Record<UnifiedContactType, { fr: string; en: string }> = {
    audit: { fr: "Diagnostic 360°, opportunités IA dans votre métier", en: "360° diagnostic, AI opportunities for your business" },
    implementation: { fr: "Agents IA, RAG, automations sur vos données", en: "AI agents, RAG, automations on your data" },
    formation: { fr: "Sessions équipes, 1 j à 5 j, sur site ou distanciel", en: "Team sessions, 1 to 5 days, on-site or remote" },
    un_a_un: { fr: "Journée dirigeant ou collaborateur clé", en: "Day with executive or key team member" },
    devis: { fr: "Vous avez un cahier des charges précis", en: "You have a clear project brief" },
    partenariat: { fr: "Revente, co-marketing, alliance stratégique", en: "Reseller, co-marketing, strategic alliance" },
    presse: { fr: "Journalistes, podcasts, interview, presskit", en: "Journalists, podcasts, interview, presskit" },
    recrutement: { fr: "Candidature spontanée, alternance, stage", en: "Spontaneous application, work-study, internship" },
    speaker: { fr: "Invitation à intervenir lors d'un événement", en: "Invitation to speak at an event" },
    investisseur: { fr: "VC, M&A, banque d'affaires", en: "VC, M&A, investment bank" },
    support_client: { fr: "Vous êtes déjà client et avez besoin d'aide", en: "You are an existing client and need help" },
    autre: { fr: "Tout autre sujet — on revient sous 24 h", en: "Any other topic — we reply within 24h" },
  };
  return hints[type][locale];
}
