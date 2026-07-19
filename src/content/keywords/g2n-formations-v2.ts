/**
 * Keyword Strategy — Verticale FORMATIONS (refonte catalogue 2026-07-19 :
 * 21 formations générales/métiers/secteurs + séminaire + page sur-mesure).
 *
 * DÉRIVÉ du SSOT catalog-v2.ts (plus de liste manuelle) : 1 requête HEAD
 * (niveau 1, priorité 2) par fiche, injection h1/metaTitle/metaDescription
 * alignée sur le catalogue. Un changement de slug/titre au catalogue se
 * propage automatiquement. Aucun prix en dur. Contenu 100 % FR.
 * Non enregistré master.ts (seeds SEO).
 */

import { FORMATIONS_V2 } from "../formations/catalog-v2";
import type { KeywordSeed } from "./types";

const M = "interventions-formations" as const;

/** Mot-clé HEAD dérivé du titre (« IA pour les RH » → « formation ia pour les rh »). */
function keywordFromTitre(titreFr: string): string {
  const base = titreFr
    .toLowerCase()
    .replace(/\s*—\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base.startsWith("séminaire") ? base : `formation ${base}`;
}

const catalogueSeeds: KeywordSeed[] = FORMATIONS_V2.map((f) => ({
  keyword: keywordFromTitre(f.titreFr),
  intent: "transactionnel",
  module: M,
  cible: "pme",
  priorite: 2,
  niveau: 1,
  formationFormat: "ponctuel",
  urlCible: `/fr/formations/${f.slugFr}`,
  injection: {
    h1: f.h1Fr,
    metaTitle: `${f.metaTitleFr} | Axion-IA`,
    metaDescription: f.metaDescriptionFr,
  },
}));

export const KEYWORDS_FORMATIONS_V2: KeywordSeed[] = [
  ...catalogueSeeds,
  {
    keyword: "formation ia sur mesure entreprise",
    intent: "transactionnel",
    module: M,
    cible: "pme",
    priorite: 2,
    niveau: 1,
    formationFormat: "ponctuel",
    urlCible: "/fr/formations/sur-mesure",
    injection: {
      h1: "Formation IA sur mesure pour votre entreprise",
      metaTitle: "Formation IA sur mesure en entreprise | Axion-IA",
      metaDescription:
        "Formation IA construite avec vous : theme, public et cas pratiques definis ensemble, en presentiel ou distanciel. Sur devis.",
    },
  },
];
