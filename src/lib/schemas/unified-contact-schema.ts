// Unified contact form — schema Zod (2026-05-24).
//
// Remplace 6 schemas distincts (contact, audit, audit-request, implementation,
// quote-request, intervention) par un seul, discriminé par le champ `type`.
//
// Voir _AUDIT/FORMS-UNIFICATION-2026-05-24/02-DESIGN.md.

import { z } from "zod";

// ---- Types & enums ---------------------------------------------------------

// Ordre = ordre d'affichage du segmented control. `autre` en tête car defaultType
// et car couvre 100 % des cas non-listés (politique "le formulaire sert à tout").
export const UNIFIED_CONTACT_TYPES = [
  "autre",
  "devis",
  "audit",
  "implementation",
  "formation",
  "un_a_un",
  "partenariat",
] as const;
export type UnifiedContactType = (typeof UNIFIED_CONTACT_TYPES)[number];

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
    autre: { fr: "Autre demande", en: "Other request" },
    devis: { fr: "Devis", en: "Quote" },
    audit: { fr: "Audit IA", en: "AI audit" },
    implementation: { fr: "Implémentation IA", en: "AI implementation" },
    formation: { fr: "Formation", en: "Training" },
    un_a_un: { fr: "Coaching 1-à-1", en: "1-on-1 coaching" },
    partenariat: { fr: "Partenariat", en: "Partnership" },
  };
  return labels[type][locale];
}
