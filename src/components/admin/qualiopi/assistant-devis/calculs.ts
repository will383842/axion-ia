/**
 * Assistant de devis — calculs d'aperçu en centimes (fiche E03). PUR, client-safe.
 *
 * Aucun arrondi réécrit, aucun taux ni prix en dur :
 *  - HT = somme de `Math.round(quantité × prix)` ; TVA par GROUPE de taux, via `computeTotauxFacture` ;
 *  - mensuel net via `prixMensuelNet`, indemnité via `indemniteSortieMaxCents` ;
 *  - le taux de TVA standard est un PARAMÈTRE (`tvaStandardPct`, reçu des props).
 * Les montants PAR PHASE ne se calculent pas ici : ils viennent de l'aperçu serveur (S07).
 */
import { indemniteSortieMaxCents, prixMensuelNet } from "@/server/qualiopi/devis/montants-mensuels";
import { computeTotauxFacture } from "@/server/qualiopi/legal/tva";

import { eurosVersCents } from "../devis-formules/saisie";
import { propositionEffective } from "./etat";
import type { EtatAssistant, LigneAssistant } from "./types";

export interface Totaux {
  htCents: number;
  tvaCents: number;
  ttcCents: number;
  /** Vrai si au moins une saisie était illisible (elle compte pour 0 dans l'aperçu, jamais ailleurs). */
  incomplet: boolean;
}

const ESPACES = /[\u0020\u00A0\u202F]/g;

/** « 2 400 » (espaces, U+00A0, U+202F admis) → 240000 ; « 2.400 », « -5 », « 12 € » → null. */
export function eurosEnCents(saisie: string): number | null {
  return eurosVersCents(saisie.replace(ESPACES, ""));
}

/** « 2,3 » / « 2.3 » → 2.3 ; vide, négatif, nul, plus de 2 décimales → null. */
export function quantiteLue(saisie: string): number | null {
  const t = saisie.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

/** Pourcentage « 12,5 » → points de base 1250 ; illisible → null. */
export function pctEnBps(saisie: string): number | null {
  const t = saisie.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

const VIDE = (): Totaux => ({ htCents: 0, tvaCents: 0, ttcCents: 0, incomplet: false });

export function totauxLignes(lignes: readonly LigneAssistant[], tvaStandardPct: number): Totaux {
  let incomplet = false;
  const lisibles: Array<{ quantite: number; prixUnitaireHtCents: number }> = [];
  for (const l of lignes) {
    const quantite = quantiteLue(l.quantite);
    const prix = eurosEnCents(l.prixEur);
    if (quantite === null || prix === null) {
      incomplet = true;
      continue;
    }
    lisibles.push({ quantite, prixUnitaireHtCents: prix });
  }
  const t = computeTotauxFacture(lisibles, "assujetti", tvaStandardPct);
  return {
    htCents: t.totalHtCents,
    tvaCents: t.totalTvaCents,
    ttcCents: t.totalTtcCents,
    incomplet,
  };
}

function totauxMontant(cents: number | null, tvaStandardPct: number): Totaux {
  if (cents === null || cents === 0) return { ...VIDE(), incomplet: cents === null };
  const t = computeTotauxFacture(
    [{ quantite: 1, prixUnitaireHtCents: cents }],
    "assujetti",
    tvaStandardPct,
  );
  return {
    htCents: t.totalHtCents,
    tvaCents: t.totalTvaCents,
    ttcCents: t.totalTtcCents,
    incomplet: false,
  };
}

/** Formule A (et prix unique) : le total des lignes de l'étape 1. */
export function totauxFormuleA(e: EtatAssistant, tvaStandardPct: number): Totaux {
  return totauxLignes(e.lignes, tvaStandardPct);
}

/**
 * Mise en service de la formule B : B seule → total des lignes ; A + B → montant saisi
 * (vide = 0, aucune ligne).
 */
export function totauxMiseEnServiceB(e: EtatAssistant, tvaStandardPct: number): Totaux {
  if (propositionEffective(e) === "B") return totauxLignes(e.lignes, tvaStandardPct);
  const saisie = e.abonnement.miseEnServiceSaisie.trim();
  return totauxMontant(saisie === "" ? 0 : eurosEnCents(saisie), tvaStandardPct);
}

/** Montant saisi pour A + B mais inutilisé en B seule : à dire en clair (D1.5). */
export function miseEnServiceIgnoree(
  e: EtatAssistant,
  tvaStandardPct: number,
): { saisieCents: number; totalLignesCents: number } | null {
  if (propositionEffective(e) !== "B") return null;
  const saisie = eurosEnCents(e.abonnement.miseEnServiceSaisie);
  if (saisie === null || saisie === 0) return null;
  return { saisieCents: saisie, totalLignesCents: totauxLignes(e.lignes, tvaStandardPct).htCents };
}

export interface LignePeriode {
  mois: number;
  mensuelNetCents: number;
  /** Prix d'une période : mensuel net × mois. */
  prixPeriodeCents: number;
  /** Engagement minimal affiché pour cette période : mensuel NET × engagement (remise comprise). */
  engagementMinimalCents: number;
}

/** Périodes de l'abonnement ; `null` si le mensuel ou une remise est illisible. */
export function periodesAbonnement(e: EtatAssistant): LignePeriode[] | null {
  const mensuel = eurosEnCents(e.abonnement.mensuelCatalogueEur);
  if (mensuel === null) return null;
  const out: LignePeriode[] = [];
  for (const p of e.abonnement.periodes) {
    const bps = pctEnBps(p.remisePct);
    if (bps === null) return null;
    let net: number;
    try {
      net = prixMensuelNet(mensuel, bps);
    } catch {
      return null;
    }
    out.push({
      mois: p.mois,
      mensuelNetCents: net,
      prixPeriodeCents: net * p.mois,
      engagementMinimalCents: net * e.abonnement.engagementMois,
    });
  }
  return out;
}

/**
 * Plafond d'indemnité de sortie : taux × mensualités restantes au plus haut (plus faible remise).
 * `null` sans engagement ou à taux 0 (aucune indemnité), comme `vueFormules`.
 */
export function indemniteSortieMax(e: EtatAssistant): number | null {
  const ab = e.abonnement;
  if (ab.engagementMois === 0) return null;
  const taux = pctEnBps(ab.indemniteTauxPct);
  const periodes = periodesAbonnement(e);
  if (taux === null || taux === 0 || periodes === null || periodes.length === 0) return null;
  const restant = Math.max(...periodes.map((p) => p.mensuelNetCents)) * ab.engagementMois;
  try {
    return indemniteSortieMaxCents(restant, taux);
  } catch {
    return null;
  }
}

const entier = (s: string): number | null => (/^\d+$/.test(s.trim()) ? Number(s) : null);

/** Somme des délais (semaines) des phases ; les délais vides ou illisibles comptent pour 0. */
export function semainesTotales(phases: ReadonlyArray<{ delaiSemaines: string }>): number {
  return phases.reduce((s, p) => s + (entier(p.delaiSemaines) ?? 0), 0);
}

/**
 * Fourchette de durée du projet, en semaines, d'après les lignes :
 * minimum = chemin le plus long selon « démarre après » (le reste va en parallèle),
 * maximum = tout à la suite. Un cycle est ignoré (la dépendance fautive ne compte pas).
 */
export function fourchetteSemaines(lignes: readonly LigneAssistant[]): {
  min: number;
  max: number;
} {
  const par = new Map(lignes.map((l) => [l.id, l]));
  const duree = (l: LigneAssistant) => entier(l.delaiSemaines) ?? 0;
  const memo = new Map<string, number>();
  const fin = (id: string, pile: Set<string>): number => {
    const m = memo.get(id);
    if (m !== undefined) return m;
    const l = par.get(id);
    if (!l || pile.has(id)) return 0;
    pile.add(id);
    const avant = Math.max(0, ...l.necessite.map((n) => fin(n, pile)));
    pile.delete(id);
    const v = avant + duree(l);
    memo.set(id, v);
    return v;
  };
  return {
    min: Math.max(0, ...lignes.map((l) => fin(l.id, new Set()))),
    max: lignes.reduce((s, l) => s + duree(l), 0),
  };
}
