/**
 * Calculs d'une offre de devis à formules — PUR, en centimes entiers.
 * Réutilise `computeTotauxFacture` (TVA par groupe de taux) ; rien n'est
 * recalculé ici.
 */
import { createHash } from "node:crypto";

import { computeTotauxFacture, type TotauxFacture } from "../legal/tva";
import type { Formule, OffreDevisV1, PhaseOffre } from "./offre-devis";

/**
 * Totaux de la partie PONCTUELLE d'une formule (lignes + automatisations
 * retenues). Mensuel, hébergement et services tiers n'y entrent pas.
 */
export function totauxFormule(
  offre: OffreDevisV1,
  formule: Formule,
  automatisationsRetenues: readonly string[] = [],
): TotauxFacture {
  const base =
    formule === "achat"
      ? (offre.achat?.lignes ?? [])
      : (offre.abonnement?.miseEnServiceLignes ?? []);
  const autos = offre.automatisations.filter((a) => automatisationsRetenues.includes(a.code));
  const lignes = [
    ...base.map((l) => ({ q: l.quantite, p: l.prixHtCents, t: l.tauxTvaBps })),
    ...autos.map((a) => ({ q: 1, p: a.prixHtCents, t: a.tauxTvaBps })),
  ].map((l) => ({
    quantite: l.q,
    prixUnitaireHtCents: l.p,
    tauxTvaPercent: l.t / 100,
  }));
  return computeTotauxFacture(lignes, "assujetti");
}

/** Mensuel net après remise, arrondi AVANT toute multiplication par les mois. */
export function prixMensuelNet(mensuelHtCents: number, remiseBps: number): number {
  return Math.round((mensuelHtCents * (10000 - remiseBps)) / 10000);
}

/** Prix d'une période : mensuel net (déjà arrondi) × nombre de mois. */
export function prixPeriode(mensuelHtCents: number, remiseBps: number, mois: number): number {
  return prixMensuelNet(mensuelHtCents, remiseBps) * mois;
}

export interface PalierEcheancier {
  readonly rang: number;
  readonly libelle: string;
  readonly montantHtCents: number;
}

/**
 * Échéancier : palier = floor(total × % / 100), le DERNIER absorbe le reste.
 * Refus si plusieurs paliers ET plusieurs taux de TVA (la TVA par palier ne se
 * répartirait plus exactement).
 */
export function echeancierPhases(
  totalHtCents: number,
  phases: readonly PhaseOffre[],
  tauxTvaBps: readonly number[],
): PalierEcheancier[] {
  if (phases.length === 0) throw new RangeError("Échéancier : aucune phase.");
  if (phases.reduce((s, p) => s + p.pourcentage, 0) !== 100) {
    throw new RangeError("Échéancier : la somme des pourcentages doit valoir 100.");
  }
  if (phases.length > 1 && new Set(tauxTvaBps).size > 1) {
    throw new RangeError("Échéancier : plusieurs paliers avec plusieurs taux de TVA refusés.");
  }
  const triees = [...phases].sort((a, b) => a.rang - b.rang);
  let cumul = 0;
  return triees.map((p, i) => {
    const montant =
      i === triees.length - 1
        ? totalHtCents - cumul
        : Math.floor((totalHtCents * p.pourcentage) / 100);
    cumul += montant;
    return { rang: p.rang, libelle: p.libelle, montantHtCents: montant };
  });
}

/** Nombre maximal de factures sur l'engagement (0 = sans engagement). */
export function nbMaxFactures(engagementMois: number, periodeMois: number): number {
  return engagementMois <= 0 ? 0 : Math.floor(engagementMois / periodeMois);
}

/** Début de la maintenance facturée : livraison + mois offerts (fin de mois bornée). */
export function debutMaintenance(livraison: Date, moisOfferts: number): Date {
  const total = livraison.getUTCMonth() + moisOfferts;
  const annee = livraison.getUTCFullYear() + Math.floor(total / 12);
  const mois = ((total % 12) + 12) % 12;
  const dernierJour = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
  return new Date(Date.UTC(annee, mois, Math.min(livraison.getUTCDate(), dernierJour)));
}

/**
 * Plafond de l'indemnité de sortie anticipée : taux × mensualités restantes
 * (somme en centimes, hors IA).
 */
export function indemniteSortieMaxCents(
  mensualitesRestantesCents: number,
  tauxBps: number,
): number {
  return Math.round((mensualitesRestantesCents * tauxBps) / 10000);
}

function canonique(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonique);
  if (v !== null && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, canonique(x)]),
    );
  }
  return v;
}

const sha256Hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** SHA-256 (hex) du JSON canonique (clés triées) de l'offre. */
export function sha256Offre(offre: unknown): string {
  return sha256Hex(JSON.stringify(canonique(offre)));
}

export interface ChoixCanonique {
  readonly v: 1;
  readonly devisNumero: string;
  readonly offreSha256: string;
  readonly formule: Formule;
  readonly automatisationsRetenues: readonly string[];
  readonly maintenanceRetenue: boolean;
  readonly periodiciteMois: number | null;
}

export function choixCanonique(c: Omit<ChoixCanonique, "v">): ChoixCanonique {
  return { v: 1, ...c, automatisationsRetenues: [...c.automatisationsRetenues].sort() };
}

export function sha256Choix(choix: ChoixCanonique): string {
  return sha256Hex(JSON.stringify(canonique(choix)));
}
