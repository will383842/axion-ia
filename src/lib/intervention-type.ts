// Mapping slug UI ↔ enum Postgres (Sprint 15 fix Fork 2 C1-2).
//
// L'UI emet des slugs kebab-case (URLs, content/interventions.ts InterventionSlug).
// Postgres enum InterventionType utilise snake_case (les tirets passent mal en
// SQL identifiers). Ce module fait le pont.

import { z } from "zod";
import type { InterventionType as PrismaInterventionType } from "../../prisma/generated/client";

/** Slugs UI canoniques (cf. src/content/interventions.ts InterventionSlug). */
export const INTERVENTION_SLUGS = [
  "essentielle",
  "approfondie",
  "conference",
  "dirigeants",
  "gagner-du-temps",
  "intervention-claude",
  // Sprint 14.10.8 (Will 2026-05-12) — audit Flash sur site (890 €) réservable
  // directement sur le calendrier depuis le hub /audit refondu.
  "audit-flash-onsite",
  // Will (audit /interventions 2026-05-12) — formation 4 h prix fixe (cf.
  // pricing.ts intervention-4h, 690 € HT depuis 2026-06-03) promue bookable
  // direct calendrier (au lieu du formulaire générique). Atelier IA ciblé
  // supprimé le 2026-06-03 (une seule formation 4 h).
  "demarrage-ia-express",
  // Refonte Formations V2 2026-06-11 — les 17 formations du catalogue (catalog-v2).
  // Prix dérivé de FORMATION_PRICE_MATRIX (cf. FORMATION_BOOKING + branche pricing
  // ci-dessous), pas de SLUG_TO_TIER_ID. Les 3 formations 3 jours sont « sur devis »
  // (bookable:false côté booking-catalog) mais restent des slugs valides.
  "ia-express",
  "art-du-prompt",
  "ia-securite",
  "ia-conformite",
  "ia-fondamentaux",
  "ia-commercial",
  "ia-au-bureau",
  "ia-sur-le-terrain",
  "automatisations-decouverte",
  "ia-integration-metier",
  "ia-commercial-avance",
  "ia-transformation-equipe",
  "agents-automatisations",
  "agents-automatisations-avance",
  "claude-decouverte",
  "claude-createur",
  "claude-architecte",
] as const;

export type InterventionSlug = (typeof INTERVENTION_SLUGS)[number];

/** Schema Zod pour valider un slug UI cote Server Action. */
export const interventionSlugSchema = z.enum(INTERVENTION_SLUGS);

/**
 * Convertit un slug UI (kebab-case) en valeur enum Postgres (snake_case).
 * `gagner-du-temps` → `gagner_du_temps`, `intervention-claude` → `intervention_claude`.
 * Les autres slugs sont identiques cote DB.
 */
export function slugToEnum(slug: InterventionSlug): PrismaInterventionType {
  return slug.replace(/-/g, "_") as PrismaInterventionType;
}

/** Reverse : valeur enum DB → slug UI affichable. */
export function enumToSlug(value: PrismaInterventionType): InterventionSlug {
  return value.replace(/_/g, "-") as InterventionSlug;
}

// ============================================================
// Pricing helper — Sprint 15 fix Fork 4 doctrine 9 (pricePaidCents)
// ============================================================

import {
  INTERVENTION_TIERS,
  ESSENTIELLE_SUB_TIERS,
  APPROFONDIE_SUB_TIERS,
  TEMPS_SUB_TIERS,
  CLAUDE_SUB_TIERS,
  AUDIT_TIERS,
  type FormationBracket,
  type FormationDuree,
  type FormationGamme,
  getFormationBrackets,
  getFormationEntryPrice,
  getFormationPrice,
} from "@/content/pricing";

// Refonte Formations V2 2026-06-11 — mapping slug formation → (gamme, durée) pour
// dériver le prix booking via FORMATION_PRICE_MATRIX (pricing.ts). Hardcodé ici
// (vérifié 1:1 vs catalog-v2) pour NE PAS importer catalog-v2 (1,6k lignes) dans
// la chaîne du calendrier (budget Web Vitals /reserver). Verrouillé par test.
const FORMATION_BOOKING: Partial<Record<string, { gamme: FormationGamme; duree: FormationDuree }>> =
  {
    "ia-express": { gamme: "ia-standard", duree: "4h" },
    "art-du-prompt": { gamme: "ia-standard", duree: "4h" },
    "ia-securite": { gamme: "ia-standard", duree: "4h" },
    "ia-conformite": { gamme: "ia-standard", duree: "4h" },
    "ia-fondamentaux": { gamme: "ia-standard", duree: "1j" },
    "ia-commercial": { gamme: "ia-standard", duree: "1j" },
    "ia-au-bureau": { gamme: "ia-standard", duree: "1j" },
    "ia-sur-le-terrain": { gamme: "ia-standard", duree: "1j" },
    "automatisations-decouverte": { gamme: "ia-standard", duree: "1j" },
    "ia-integration-metier": { gamme: "ia-standard", duree: "2j" },
    "ia-commercial-avance": { gamme: "ia-standard", duree: "2j" },
    "ia-transformation-equipe": { gamme: "ia-standard", duree: "3j" },
    "agents-automatisations": { gamme: "agents-automatisations", duree: "2j" },
    "agents-automatisations-avance": { gamme: "agents-automatisations", duree: "3j" },
    "claude-decouverte": { gamme: "claude", duree: "1j" },
    "claude-createur": { gamme: "claude", duree: "2j" },
    "claude-architecte": { gamme: "claude", duree: "3j" },
  };

/** Tranche d'effectif d'une formation matchant `count` (sinon la dernière). */
function pickFormationBracket(
  brackets: ReadonlyArray<FormationBracket>,
  count: number,
): FormationBracket | undefined {
  for (const b of brackets) {
    const parts = b.split("-");
    const lo = Number.parseInt(parts[0] ?? "", 10);
    const hi = Number.parseInt(parts[1] ?? "", 10);
    if (Number.isFinite(lo) && Number.isFinite(hi) && count >= lo && count <= hi) return b;
  }
  return brackets[brackets.length - 1];
}

/**
 * Map slug UI → id pricing tier (`intervention-<id>`). Partial : les 17 formations
 * V2 ne sont PAS ici (prix dérivé de la matrice via FORMATION_BOOKING ci-dessus) ;
 * un slug absent retombe sur `{ cents: null }` côté getInterventionPriceCents.
 */
const SLUG_TO_TIER_ID: Partial<Record<InterventionSlug, string>> = {
  essentielle: "intervention-essentielle",
  approfondie: "intervention-approfondie",
  conference: "intervention-conference",
  dirigeants: "intervention-dirigeants",
  "gagner-du-temps": "intervention-temps",
  "intervention-claude": "intervention-claude",
  // Audit Flash terrain — mappe vers le tier audit-flash, sous-tier audit-flash-onsite.
  "audit-flash-onsite": "audit-flash",
  // Will (audit /interventions 2026-05-12) — formation 4 h sur le tier
  // `intervention-4h` (690 € flat depuis 2026-06-03, cf. pricing.ts).
  "demarrage-ia-express": "intervention-4h",
};

/**
 * Brackets participantsCount pour Essentielle/Approfondie (sub-tiers).
 * Renvoie l'id du sub-tier matchant ou null si hors brackets.
 */
function bracketSubTierId(slug: InterventionSlug, participantsCount: number): string | null {
  // Will 2026-06-03 — 2 paliers canoniques (2-15 / 16-30) partagés par les 4
  // formats collectifs : Essentielle, Approfondie, Gagner du temps, Claude.
  const subTiers =
    slug === "essentielle"
      ? ESSENTIELLE_SUB_TIERS
      : slug === "approfondie"
        ? APPROFONDIE_SUB_TIERS
        : slug === "gagner-du-temps"
          ? TEMPS_SUB_TIERS
          : slug === "intervention-claude"
            ? CLAUDE_SUB_TIERS
            : null;
  if (!subTiers) return null;
  if (participantsCount >= 2 && participantsCount <= 15) return subTiers[0]?.id ?? null;
  if (participantsCount >= 16 && participantsCount <= 30) return subTiers[1]?.id ?? null;
  return null;
}

/**
 * Derive le prix payé en cents pour une intervention donnée + nombre
 * participants. Retourne `null` si tier `onQuote` (Conference, Claude,
 * Sur demande) — la console admin affichera « sur devis ».
 *
 * Sprint 15 fix : avant cet helper, `Booking.pricePaidCents` restait
 * null à la création (audit doctrine fork 4 finding 9).
 */
export function getInterventionPriceCents(
  slug: InterventionSlug,
  participantsCount: number,
): { cents: number | null; tierLabel: string | null } {
  // Cas spécial Sprint 14.10.8 : audit-flash-onsite = prix fixe 890 €.
  if (slug === "audit-flash-onsite") {
    const auditFlash = AUDIT_TIERS.find((t) => t.id === "audit-flash");
    const onsite = auditFlash?.subTiers?.find((s) => s.id === "audit-flash-onsite");
    if (onsite?.priceFlat) {
      return { cents: onsite.priceFlat * 100, tierLabel: onsite.labelFr };
    }
    return { cents: 89000, tierLabel: "Audit Flash terrain" };
  }
  // Refonte Formations V2 — les 17 formations dérivent leur prix de la matrice
  // (gamme × durée × tranche d'effectif), pas d'un tier intervention.
  const fb = FORMATION_BOOKING[slug];
  if (fb) {
    const brackets = getFormationBrackets(fb.gamme, fb.duree);
    const bracket = pickFormationBracket(brackets, participantsCount);
    const eur =
      bracket !== undefined
        ? getFormationPrice(fb.gamme, fb.duree, bracket)
        : getFormationEntryPrice(fb.gamme, fb.duree);
    if (typeof eur === "number") return { cents: eur * 100, tierLabel: `Formation ${fb.duree}` };
    return { cents: null, tierLabel: null };
  }
  const tierId = SLUG_TO_TIER_ID[slug];
  const tier = INTERVENTION_TIERS.find((t) => t.id === tierId);
  if (!tier) return { cents: null, tierLabel: null };
  if (tier.onQuote) return { cents: null, tierLabel: tier.labelFr };

  // Brackets sub-tier (Essentielle / Approfondie)
  const subTierId = bracketSubTierId(slug, participantsCount);
  if (subTierId && tier.subTiers) {
    const sub = tier.subTiers.find((s) => s.id === subTierId);
    if (sub) return { cents: sub.priceFlat * 100, tierLabel: sub.labelFr };
  }

  // Prix flat (Gagner du temps, Dirigeants, fallback)
  if (typeof tier.priceFlat === "number") {
    return { cents: tier.priceFlat * 100, tierLabel: tier.labelFr };
  }
  return { cents: null, tierLabel: tier.labelFr };
}
