// Module de repli / cross-sell (T-36, doc 16 §3 scénario 3, G-5).
//
// Quand `rechercher_offres` ne trouve AUCUN match exact, on ne répond JAMAIS
// « non » sec : on propose l'alternative la plus proche. Cascade (1ère non vide) :
//   A. élargir la fourchette de prix ±25 % ;
//   B. proximité de durée (si la durée était la contrainte bloquante) ;
//   C. relâcher une facette « molle » (format → sujet → audience → durée) ;
//   D. proximité de prix (2 offres même vertical les plus proches) ;
//   E. entrée de gamme (la moins chère) + proposer un RDV découverte.
//
// ⚠️ Tri sur les SOUS-TIERS réels (prixMin/prixMax dérivés du catalogue) → gère
// l'inversion ETI assumée (D-ETI-PRIX). S'applique à TOUTES les facettes, pas
// qu'au prix.
//
// NB : un raffinement « sujet voisin via FORMATION_RELATED » (graphe de formations
// sœurs) est possible (doc 16 §3) ; le relâchement de la facette `sujet` (étape C)
// couvre déjà le « jamais de non sec » de façon générique — graphe sœur = TODO refin.

import { OFFERS, type Offer } from "@/content/offers-catalog";
import { searchOffers, type RechercherOffresInput } from "@/server/chatbot/tools/rechercher-offres";

export type RepliStrategy =
  | "widened-price"
  | "nearest-duration"
  | "relaxed-format"
  | "relaxed-sujet"
  | "relaxed-audience"
  | "relaxed-duree"
  | "nearest-price"
  | "entry-level"
  | "custom-effectif"
  | "none";

export interface RepliResult {
  readonly offres: ReadonlyArray<Offer>;
  readonly strategy: RepliStrategy;
  /** true → la réponse doit aussi proposer un RDV découverte (repli faible). */
  readonly proposeRdv: boolean;
}

const MAX_SUGGESTIONS = 3;
const MAX_NEAREST = 2;

/** Offres du périmètre (vertical demandé, sinon tout le catalogue). */
function pool(criteria: RechercherOffresInput, catalog: ReadonlyArray<Offer>): Offer[] {
  return criteria.vertical ? catalog.filter((o) => o.vertical === criteria.vertical) : [...catalog];
}

function priced(offers: ReadonlyArray<Offer>): Offer[] {
  return offers.filter((o) => !o.onQuote && o.prixMin !== undefined);
}

/**
 * Trouve l'alternative la plus proche d'une recherche infructueuse.
 * `criteria` = la recherche initiale (qui a renvoyé 0 résultat).
 */
export function repli(
  criteria: RechercherOffresInput,
  catalog: ReadonlyArray<Offer> = OFFERS,
): RepliResult {
  const hasPrice = criteria.prixMin !== undefined || criteria.prixMax !== undefined;

  // (b) Effectif hors catalogue (T-36 raffinement 2026-06-05) : besoin SUR MESURE.
  // On déclenche si l'effectif demandé est celui d'une ETI/grande entreprise
  // (≥ 250, seuil INSEE PME→ETI) OU si des offres dimensionnées existent mais
  // qu'aucune ne couvre l'effectif. Dans ces cas on n'affiche PAS une offre
  // sous-calibrée (ex. audit PME 1 j pour 1200 salariés) → on oriente vers un
  // échange (RDV) avec un message « sur mesure » côté orchestrateur.
  if (criteria.effectif !== undefined) {
    const ETI_THRESHOLD = 250;
    const sized = pool(criteria, catalog).filter((o) => o.effectifMax !== undefined);
    const covered = sized.some(
      (o) => (o.effectifMin ?? 0) <= criteria.effectif! && o.effectifMax! >= criteria.effectif!,
    );
    const beyondCatalog = sized.length > 0 && !covered;
    if (criteria.effectif >= ETI_THRESHOLD || beyondCatalog) {
      return { offres: [], strategy: "custom-effectif", proposeRdv: true };
    }
  }

  // A. Élargir la fourchette de prix ±25 %.
  if (hasPrice) {
    const widened: RechercherOffresInput = {
      ...criteria,
      prixMin: criteria.prixMin !== undefined ? Math.floor(criteria.prixMin * 0.75) : undefined,
      prixMax: criteria.prixMax !== undefined ? Math.ceil(criteria.prixMax * 1.25) : undefined,
    };
    const w = searchOffers(widened, catalog);
    if (w.length > 0) {
      return { offres: w.slice(0, MAX_SUGGESTIONS), strategy: "widened-price", proposeRdv: false };
    }
  }

  // B. Proximité de durée (durée = contrainte bloquante, sans prix).
  if (criteria.dureeMaxJours !== undefined && !hasPrice) {
    const withDur = pool(criteria, catalog).filter((o) => o.dureeJours !== undefined);
    if (withDur.length > 0) {
      const target = criteria.dureeMaxJours;
      const ranked = [...withDur].sort(
        (a, b) => Math.abs(a.dureeJours! - target) - Math.abs(b.dureeJours! - target),
      );
      return {
        offres: ranked.slice(0, MAX_NEAREST),
        strategy: "nearest-duration",
        proposeRdv: false,
      };
    }
  }

  // C. Relâcher une facette molle, une à la fois (la plus restrictive d'abord).
  const softFacets: Array<[keyof RechercherOffresInput, RepliStrategy]> = [
    ["format", "relaxed-format"],
    ["sujet", "relaxed-sujet"],
    ["audience", "relaxed-audience"],
    ["dureeMaxJours", "relaxed-duree"],
  ];
  for (const [facet, strategy] of softFacets) {
    if (criteria[facet] === undefined) continue;
    const relaxed = { ...criteria };
    delete relaxed[facet];
    const r = searchOffers(relaxed, catalog);
    if (r.length > 0) {
      return { offres: r.slice(0, MAX_SUGGESTIONS), strategy, proposeRdv: false };
    }
  }

  // D. Proximité de prix : 2 offres même vertical aux prix les plus proches.
  if (hasPrice) {
    const target = criteria.prixMax ?? criteria.prixMin!;
    const ranked = priced(pool(criteria, catalog)).sort(
      (a, b) => Math.abs(a.prixMin! - target) - Math.abs(b.prixMin! - target),
    );
    if (ranked.length > 0) {
      return { offres: ranked.slice(0, MAX_NEAREST), strategy: "nearest-price", proposeRdv: false };
    }
  }

  // E. Entrée de gamme (la moins chère) + RDV découverte.
  const entry = priced(pool(criteria, catalog)).sort((a, b) => a.prixMin! - b.prixMin!);
  if (entry.length > 0) {
    return { offres: [entry[0]!], strategy: "entry-level", proposeRdv: true };
  }
  // Dernier recours : 1-2 offres du périmètre (toutes sur devis) + RDV.
  const any = pool(criteria, catalog).slice(0, MAX_NEAREST);
  return { offres: any, strategy: any.length > 0 ? "entry-level" : "none", proposeRdv: true };
}
