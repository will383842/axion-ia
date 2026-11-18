/** Fiches locales sourcées (lot 1 : dix villes). Une ville sans fiche garde la page actuelle. */
import type { FicheLocale } from "./types";
import { FICHE_MARSEILLE } from "./marseille";
import { FICHE_LYON } from "./lyon";
import { FICHE_TOULOUSE } from "./toulouse";
import { FICHE_NICE } from "./nice";
import { FICHE_NANTES } from "./nantes";
import { FICHE_MONTPELLIER } from "./montpellier";
import { FICHE_STRASBOURG } from "./strasbourg";
import { FICHE_BORDEAUX } from "./bordeaux";
import { FICHE_LILLE } from "./lille";
import { FICHE_RENNES } from "./rennes";

export const FICHES_LOCALES: Readonly<Record<string, FicheLocale>> = {
  marseille: FICHE_MARSEILLE,
  lyon: FICHE_LYON,
  toulouse: FICHE_TOULOUSE,
  nice: FICHE_NICE,
  nantes: FICHE_NANTES,
  montpellier: FICHE_MONTPELLIER,
  strasbourg: FICHE_STRASBOURG,
  bordeaux: FICHE_BORDEAUX,
  lille: FICHE_LILLE,
  rennes: FICHE_RENNES,
};

export function ficheLocale(slug: string): FicheLocale | undefined {
  return FICHES_LOCALES[slug];
}

export type { FicheLocale } from "./types";
