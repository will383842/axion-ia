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
  AUDIT_TIERS,
} from "@/content/pricing";

/** Map slug UI → id pricing tier (`intervention-<id>`). */
const SLUG_TO_TIER_ID: Record<InterventionSlug, string> = {
  essentielle: "intervention-essentielle",
  approfondie: "intervention-approfondie",
  conference: "intervention-conference",
  dirigeants: "intervention-dirigeants",
  "gagner-du-temps": "intervention-temps",
  "intervention-claude": "intervention-claude",
  // Audit Flash terrain — mappe vers le tier audit-flash, sous-tier audit-flash-onsite.
  "audit-flash-onsite": "audit-flash",
};

/**
 * Brackets participantsCount pour Essentielle/Approfondie (sub-tiers).
 * Renvoie l'id du sub-tier matchant ou null si hors brackets.
 */
function bracketSubTierId(slug: InterventionSlug, participantsCount: number): string | null {
  const subTiers =
    slug === "essentielle"
      ? ESSENTIELLE_SUB_TIERS
      : slug === "approfondie"
        ? APPROFONDIE_SUB_TIERS
        : null;
  if (!subTiers) return null;
  if (participantsCount >= 2 && participantsCount <= 8) return subTiers[0]?.id ?? null;
  if (participantsCount >= 9 && participantsCount <= 15) return subTiers[1]?.id ?? null;
  if (participantsCount >= 16 && participantsCount <= 30) return subTiers[2]?.id ?? null;
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
