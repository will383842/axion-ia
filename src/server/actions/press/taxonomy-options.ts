// Options de taxonomie « ciblage média » des communiqués (2026-06-24).
//
// SSOTs réutilisés (jamais de liste parallèle hardcodée) :
//   - Régions : `src/content/regions.ts` (métropole only, comme study.ts)
//   - Secteurs : `src/content/knowledge/sector-tags.ts`
//
// Consommé par les formulaires admin (création / édition) ET le filtre public.
// Les options « select » admin incluent une entrée vide (value "") = « non
// spécifié » → l'action mappe "" → null en base.

import { REGIONS } from "@/content/regions";
import { KB_SECTOR_TAGS } from "@/content/knowledge/sector-tags";
import type { PressReleaseTag, PressReleaseAudience } from "../../../../prisma/generated/client";

export interface SelectOption {
  value: string;
  label: string;
}

/** Catégorie (nature de l'annonce) — distinct du ciblage média. */
export const PRESS_TAG_OPTIONS: ReadonlyArray<{ value: PressReleaseTag; label: string }> = [
  { value: "launch", label: "Lancement" },
  { value: "partnership", label: "Partenariat" },
  { value: "study", label: "Étude" },
  { value: "product", label: "Produit" },
  { value: "milestone", label: "Jalon" },
];

const NONE: SelectOption = { value: "", label: "— Non spécifié —" };

/** Régions métropole (slug SSOT) + entrée « non spécifié ». */
export const PRESS_REGION_OPTIONS: ReadonlyArray<SelectOption> = [
  NONE,
  ...REGIONS.filter((r) => r.type === "metropole").map((r) => ({ value: r.slug, label: r.nameFr })),
];

/** Secteurs KB (slug SSOT) + entrée « non spécifié ». */
export const PRESS_SECTOR_OPTIONS: ReadonlyArray<SelectOption> = [
  NONE,
  ...KB_SECTOR_TAGS.map((s) => ({ value: s.slug, label: s.labelFr })),
];

/** Audience visée. GENERAL est le défaut (DB). */
export const PRESS_AUDIENCE_OPTIONS: ReadonlyArray<{
  value: PressReleaseAudience;
  label: string;
}> = [
  { value: "GENERAL", label: "Général" },
  { value: "FOUNDER", label: "Fondateur" },
];
