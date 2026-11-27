/**
 * Réseau d'apporteurs — données de l'AUTOFACTURE (module PUR : ni Prisma, ni rendu).
 *
 * Le vendeur est l'APPORTEUR, l'acheteur est Axion (inversion décrite dans
 * `qualiopi/remuneration/autofacture-pieces.ts`). Une ligne par commission versée,
 * montants en centimes ; franchise 293 B ou TVA 20 % selon le régime de l'apporteur.
 */

import { ajouterJoursOuvres, estJourFerieFrance } from "@/lib/jours-ouvres";
import { PALIERS_FORMATION, PALIERS_FORMATION_LONGUE } from "./regles";
import { PREFIXE_PALIER_COMPLEMENT } from "./commandes";
import { sirenValide } from "./regles-dossier";
import type { AutofactureData } from "@/server/qualiopi/documents/templates/autofacture-honoraires";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { computeTotauxFacture, TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";
import {
  regimeFactureDepuisHonoraires,
  type LigneHonoraires,
} from "@/server/qualiopi/remuneration/autofacture-pieces";
import type { TvaRegimeHonoraires } from "@/server/qualiopi/remuneration/calcul";

/** Délai de contestation de l'annexe 2 (art. 2.4) du contrat v2. */
export const DELAI_CONTESTATION_APPORTEUR_JOURS = 30;

export const REFERENCE_MANDAT_APPORTEUR =
  "Mandat de facturation donné par l'apporteur à la Société : annexe 2 du contrat d'apporteur, article 289, I, 2 du code général des impôts.";

export interface CommissionPourAutofacture {
  readonly id: string;
  readonly activite: string;
  readonly palier: string | null;
  readonly parrainage: boolean;
  readonly montantCents: number | null;
  /** Art. 4.1 bis : prix public de la formation et prix réellement facturé (HT), s'ils sont connus. */
  readonly prixPublicHtCents?: number | null;
  readonly factureHtCents?: number | null;
  /** `reprise` : ligne négative (art. 4.5), jamais une commission. */
  readonly statut?: string;
  /** Reprise : autofacture d'origine (numéro et mois), pour le renvoi de l'avoir. */
  readonly origineNumero?: string | null;
  /** « AAAA-MM » du mois d'émission de l'autofacture d'origine. */
  readonly origineMois?: string | null;
  /**
   * Paiement intégral du client pour CETTE commande (jour du crédit, art. 4.0) : la date de la
   * prestation de l'autofacture (art. 4.7). Absent ou `null` : inconnu.
   */
  readonly paiementIntegralAt?: Date | null;
}

export interface ApporteurPourAutofacture {
  readonly nom: string;
  readonly denomination: string | null;
  readonly siren: string | null;
  /** SIRET de l'établissement (plusieurs activités), sinon `null` : on imprime le SIREN. */
  readonly siret?: string | null;
  readonly adresse: string | null;
  readonly regimeTva: "franchise_293b" | "assujetti" | null;
  readonly numeroTva: string | null;
  readonly email: string | null;
}

export function regimeHonorairesApporteur(
  r: ApporteurPourAutofacture["regimeTva"],
): TvaRegimeHonoraires | null {
  if (r === "franchise_293b") return "franchise_293b";
  if (r === "assujetti") return "assujetti_20";
  return null;
}

export type RegimeApporteur = ApporteurPourAutofacture["regimeTva"];

/**
 * Régime de TVA PIÈCE PAR PIÈCE (figé à l'émission, jamais relu sur la fiche) : celui de
 * l'autofacture, et celui de chaque avoir — qui est celui de l'autofacture qu'il rectifie.
 */
export interface RegimesPieces {
  readonly facture: RegimeApporteur;
  readonly avoir: (numeroAvoir: string) => RegimeApporteur;
}

/** Un régime unique (appels d'avant) ou les régimes figés de chaque pièce. */
export type RegimeOuPieces = RegimeApporteur | RegimesPieces;

export function regimesPieces(r: RegimeOuPieces): RegimesPieces {
  return typeof r === "object" && r !== null ? r : { facture: r, avoir: () => r };
}

/** « 1 900,00 € » : toujours deux décimales sur une pièce comptable. */
function eurosHt(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/**
 * Désignation d'une ligne : l'activité, le palier retenu, la part de parrainage, et — par
 * commande — le prix public, le prix facturé (la commission étant le montant de la ligne), pour
 * que la proportionnalité de l'art. 4.1 bis se lise sur la pièce.
 */
/** « octobre 2026 » depuis « 2026-10 ». */
export function libelleMois(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a!, (m ?? 1) - 1, 15)).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const LIBELLE_PARRAINAGE = "Parrainage (art. 4.6)";

/**
 * Une reprise est un AVOIR d'autofacture (art. 4.5), jamais une autofacture diminuée en silence :
 * la ligne le dit et renvoie à l'autofacture d'origine (numéro et mois) quand on la connaît.
 */
export function designationAvoir(c: CommissionPourAutofacture): string {
  const renvoi = c.origineNumero
    ? ` — renvoi à l'autofacture ${c.origineNumero}${c.origineMois ? ` émise en ${libelleMois(c.origineMois)}` : ""}`
    : "";
  return `Autofacturation — avoir (reprise, art. 4.5)${renvoi}`;
}

export function designationCommission(c: CommissionPourAutofacture): string {
  if (c.statut === "reprise") return designationAvoir(c);
  // Art. 4.6 : aucun montant par filleul. Ni prix facturé, ni prix public, ni palier du filleul.
  // Art. 4.6 : une ligne unique, sans identité du filleul, sans commande, prix ni commission.
  if (c.parrainage) return LIBELLE_PARRAINAGE;
  // Complément : le client a de nouveau payé la commande après une reprise ou une réduction.
  if (c.palier?.startsWith(PREFIXE_PALIER_COMPLEMENT))
    return `Commission d'apport (${c.activite}) — complément : le client a de nouveau payé la commande (art. 4.5)`;
  // Conférence : forfait fixe par commande, ni palier de formation ni prix public à rappeler.
  if (c.activite === "conference") {
    const prixConf =
      c.factureHtCents != null && c.factureHtCents > 0
        ? ` — prix facturé ${eurosHt(c.factureHtCents)} HT`
        : "";
    return `Commission d'apport — conférence${prixConf}`;
  }
  const base = `Commission d'apport (${c.activite})`;
  // Plusieurs sessions du même palier : le prix public porté est celui de TOUTES les sessions.
  const paliers = PALIERS_FORMATION.find((p) => p.id === c.palier);
  const sessions =
    paliers && c.prixPublicHtCents != null
      ? Math.round(c.prixPublicHtCents / paliers.prixCents)
      : 1;
  // 3 jours ou plus : le prix public porté est celui de toutes les journées.
  const longue = PALIERS_FORMATION_LONGUE.find((p) => p.id === c.palier);
  const journees =
    longue && c.prixPublicHtCents != null
      ? Math.round(c.prixPublicHtCents / longue.prixJourCents)
      : 0;
  const palier = c.palier
    ? ` — palier ${c.palier}${
        journees > 0 ? ` × ${journees} journées` : sessions > 1 ? ` × ${sessions} sessions` : ""
      }`
    : "";
  const prix =
    c.prixPublicHtCents != null && c.factureHtCents != null
      ? ` — prix public ${eurosHt(c.prixPublicHtCents)} HT, prix facturé ${eurosHt(c.factureHtCents)} HT`
      : c.factureHtCents != null && c.factureHtCents > 0
        ? ` — prix facturé ${eurosHt(c.factureHtCents)} HT`
        : "";
  return `${base}${palier}${prix}`;
}

/**
 * Ligne d'un AVOIR d'autofacture : la commission reprise, en montant POSITIF (c'est le titre
 * « Avoir » qui en fait un crédit) ; le renvoi à l'autofacture rectifiée est porté par l'en-tête.
 */
export function lignesAvoir(reprises: readonly CommissionPourAutofacture[]): LigneHonoraires[] {
  return reprises
    .filter((c) => c.montantCents !== null && c.montantCents !== 0)
    .map((c) => ({
      designation: "Reprise d'une commission d'apport déjà versée (art. 4.5)",
      montantHtCents: Math.abs(c.montantCents ?? 0),
    }));
}

export function lignesAutofacture(
  commissions: readonly CommissionPourAutofacture[],
): LigneHonoraires[] {
  return commissions
    .filter((c) => c.montantCents !== null && c.montantCents !== 0)
    .map((c) => ({
      designation: designationCommission(c),
      montantHtCents: c.montantCents ?? 0,
    }));
}

export function totalHtCents(lignes: readonly LigneHonoraires[]): number {
  return lignes.reduce((s, l) => s + l.montantHtCents, 0);
}

/** Total TTC d'une pièce (mêmes règles d'arrondi que le PDF) ; régime inconnu = sans TVA. */
export function totalTtcPieceCents(
  regimeTva: ApporteurPourAutofacture["regimeTva"],
  montantsHtCents: readonly number[],
): number {
  const regime = regimeHonorairesApporteur(regimeTva);
  const total = montantsHtCents.reduce((s, m) => s + m, 0);
  if (!regime) return total;
  return computeTotauxFacture(
    montantsHtCents.map((m) => ({ quantite: 1, prixUnitaireHtCents: m })),
    regimeFactureDepuisHonoraires(regime),
    TAUX_TVA_STANDARD,
  ).totalTtcCents;
}

/**
 * Somme à VIRER pour une autofacture : son TTC, moins le TTC de chaque avoir imputé. Pour un
 * apporteur qui facture la TVA, c'est le montant TVA comprise (jamais le hors-taxes).
 * Une reprise sans numéro d'avoir (anciennes lignes) compte comme une ligne de l'autofacture.
 */
export function aVirerTtcCents(
  regimeTva: RegimeOuPieces,
  lignes: ReadonlyArray<{
    statut: string;
    montantCents: number | null;
    avoirNumero?: string | null;
  }>,
): number {
  const facture: number[] = [];
  const avoirs = new Map<string, number[]>();
  for (const l of lignes) {
    const m = l.montantCents ?? 0;
    if (l.statut === "reprise" && l.avoirNumero) {
      avoirs.set(l.avoirNumero, [...(avoirs.get(l.avoirNumero) ?? []), Math.abs(m)]);
    } else {
      facture.push(m);
    }
  }
  const regimes = regimesPieces(regimeTva);
  let total = totalTtcPieceCents(regimes.facture, facture);
  for (const [numero, a] of avoirs) total -= totalTtcPieceCents(regimes.avoir(numero), a);
  return total;
}

/**
 * Versement PARTIEL d'une autofacture dont des lignes sont suspendues (contestation écrite du
 * client, art. 4.2 bis). Calculé PAR COMPLÉMENT, pour que la somme des versements retombe
 * exactement sur le TTC du PDF : TTC de toutes les lignes de l'autofacture, moins TTC des lignes
 * suspendues (elles partiront plus tard, à leur propre TTC), moins les avoirs imputés. Le partiel
 * n'est admis que s'il reste POSITIF : sinon les reprises dépasseraient ce qui resterait à verser
 * (virement négatif, ou reprise jamais déduite) et on attend la levée (`partielPossible: false`).
 * Une reprise sans numéro d'avoir compte dans la pièce elle-même, comme dans `aVirerTtcCents`.
 * Sans ligne suspendue, c'est exactement `aVirerTtcCents`.
 */
export function aVirerPartielCents(
  regimeTva: RegimeOuPieces,
  lignes: ReadonlyArray<{
    statut: string;
    montantCents: number | null;
    avoirNumero?: string | null;
  }>,
  suspenduesCents: readonly number[],
): { totalCents: number; partielPossible: boolean } {
  if (suspenduesCents.length === 0) {
    return { totalCents: aVirerTtcCents(regimeTva, lignes), partielPossible: true };
  }
  const piece: number[] = [];
  const avoirs = new Map<string, number[]>();
  for (const l of lignes) {
    const m = l.montantCents ?? 0;
    if (l.statut === "reprise" && l.avoirNumero) {
      avoirs.set(l.avoirNumero, [...(avoirs.get(l.avoirNumero) ?? []), Math.abs(m)]);
    } else {
      piece.push(m);
    }
  }
  const regimes = regimesPieces(regimeTva);
  let total =
    totalTtcPieceCents(regimes.facture, [...piece, ...suspenduesCents]) -
    totalTtcPieceCents(regimes.facture, suspenduesCents);
  for (const [numero, a] of avoirs) total -= totalTtcPieceCents(regimes.avoir(numero), a);
  return { totalCents: total, partielPossible: total > 0 };
}

/**
 * COMPENSATION (contrat 2.3, art. 12.4 ; art. 1348-2 du code civil) quand les reprises en attente
 * DÉPASSENT les commissions dues : on facture les dues et on n'impute des reprises (les plus
 * anciennes d'abord) qu'à hauteur de ce qui est dû. La dernière reprise est SCINDÉE : une part
 * imputée maintenant, le reste en attente (même référence d'origine sur les deux lignes).
 * Le TTC de l'avoir ne dépasse jamais celui de l'autofacture : pour un apporteur assujetti, la part
 * imputée est ajustée au centime près, et l'éventuel centime restant part au virement.
 * Rend `null` si rien n'est à compenser (les reprises ne dépassent pas les dues).
 */
export function planCompensation(
  regimeTva: ApporteurPourAutofacture["regimeTva"],
  duesCents: readonly number[],
  reprises: ReadonlyArray<{
    id: string;
    montantCents: number | null;
    /** `false` : avoir déjà émis, jamais scindé (imputé entier, ou bloque). */
    scindable?: boolean;
    /** Pièce d'avoir à laquelle la reprise appartiendra (TTC arrondi pièce par pièce). */
    piece?: string;
    /**
     * Régime de la pièce d'avoir à venir, donc de l'autofacture d'ORIGINE de la reprise. Absent =
     * `regimeTva` (régime de l'autofacture à émettre).
     */
    regime?: ApporteurPourAutofacture["regimeTva"];
  }>,
):
  | { imputees: string[]; scinder: { id: string; imputeCents: number; resteCents: number } | null }
  | { bloque: true }
  | null {
  const dues = duesCents.reduce((s, m) => s + m, 0);
  const total = reprises.reduce((s, r) => s + Math.abs(r.montantCents ?? 0), 0);
  // Régimes mêlés (une reprise d'une pièce d'un AUTRE régime que l'autofacture à émettre) : seul
  // le TTC compte, car c'est le TTC qui est viré ; un plafond en HT bloquerait ou scinderait à tort.
  // Quand tous les régimes sont égaux, la règle d'avant (HT ET TTC) est gardée À L'IDENTIQUE.
  const regimeDe = (r: { regime?: ApporteurPourAutofacture["regimeTva"] }) =>
    r.regime === undefined ? regimeTva : r.regime;
  const mixte = reprises.some((r) => regimeDe(r) !== regimeTva);
  if (dues <= 0) return null;
  const plafondTtc = totalTtcPieceCents(regimeTva, [...duesCents]);
  // TTC des avoirs : arrondi PIÈCE PAR PIÈCE, avec le régime de CHAQUE pièce, comme les PDF.
  const ttcAvoirs = (
    items: ReadonlyArray<{
      piece: string;
      m: number;
      regime: ApporteurPourAutofacture["regimeTva"];
    }>,
  ) => {
    const parPiece = new Map<
      string,
      { regime: ApporteurPourAutofacture["regimeTva"]; ms: number[] }
    >();
    for (const x of items) {
      const cur = parPiece.get(x.piece) ?? { regime: x.regime, ms: [] };
      cur.ms.push(x.m);
      parPiece.set(x.piece, cur);
    }
    return [...parPiece.values()].reduce((s, p) => s + totalTtcPieceCents(p.regime, p.ms), 0);
  };
  const tous = reprises
    .filter((r) => Math.abs(r.montantCents ?? 0) > 0)
    .map((r) => ({
      piece: r.piece ?? r.id,
      m: Math.abs(r.montantCents ?? 0),
      regime: regimeDe(r),
    }));
  if (mixte ? ttcAvoirs(tous) <= plafondTtc : total <= dues) return null;
  const imputees: string[] = [];
  const pris: Array<{ piece: string; m: number; regime: ApporteurPourAutofacture["regimeTva"] }> =
    [];
  for (const r of reprises) {
    const m = Math.abs(r.montantCents ?? 0);
    if (m <= 0) continue;
    const piece = r.piece ?? r.id;
    const regime = regimeDe(r);
    const cumul = pris.reduce((s, x) => s + x.m, 0);
    if ((mixte || cumul + m <= dues) && ttcAvoirs([...pris, { piece, m, regime }]) <= plafondTtc) {
      imputees.push(r.id);
      pris.push({ piece, m, regime });
      continue;
    }
    // Avoir déjà émis qui ne tient pas entier : on ne le scinde pas, et on ne verse pas les dues
    // en le laissant de côté (ce serait payer alors qu'un solde négatif reste dû).
    if (r.scindable === false) return { bloque: true };
    // Scission : la plus grande part qui garde les avoirs sous l'autofacture (TTC ; HT aussi si
    // les régimes sont égaux).
    let part = mixte ? m - 1 : Math.min(m - 1, dues - cumul);
    while (part > 0 && ttcAvoirs([...pris, { piece, m: part, regime }]) > plafondTtc) part -= 1;
    return {
      imputees,
      scinder: part > 0 ? { id: r.id, imputeCents: part, resteCents: m - part } : null,
    };
  }
  return { imputees, scinder: null };
}

/**
 * La compensation (art. 12.4) est-elle déclenchée ? Les reprises en attente couvrent-elles les
 * commissions dues ? À régime unique : HT, comme avant. Régimes mêlés : en TTC, car c'est le TTC qui
 * est viré (500 € HT dus en franchise contre 450 € HT de reprise d'une pièce assujettie, soit
 * 540 € TTC, donnent +50 € en HT mais −40 € à virer).
 */
export function compensationDeclenchee(
  regimeTva: ApporteurPourAutofacture["regimeTva"],
  duesCents: readonly number[],
  reprises: ReadonlyArray<{
    id: string;
    montantCents: number | null;
    piece?: string;
    regime?: ApporteurPourAutofacture["regimeTva"];
  }>,
): boolean {
  const regimeDe = (r: { regime?: ApporteurPourAutofacture["regimeTva"] }) =>
    r.regime === undefined ? regimeTva : r.regime;
  const dues = duesCents.reduce((s, m) => s + m, 0);
  const reprisesHt = reprises.reduce((s, r) => s + Math.abs(r.montantCents ?? 0), 0);
  if (!reprises.some((r) => regimeDe(r) !== regimeTva)) return dues - reprisesHt <= 0;
  const parPiece = new Map<
    string,
    { regime: ApporteurPourAutofacture["regimeTva"]; ms: number[] }
  >();
  for (const r of reprises) {
    const k = r.piece ?? r.id;
    const cur = parPiece.get(k) ?? { regime: regimeDe(r), ms: [] };
    cur.ms.push(Math.abs(r.montantCents ?? 0));
    parPiece.set(k, cur);
  }
  const ttcReprises = [...parPiece.values()].reduce(
    (s, p) => s + totalTtcPieceCents(p.regime, p.ms),
    0,
  );
  return totalTtcPieceCents(regimeTva, [...duesCents]) - ttcReprises <= 0;
}

/** Échéance FERME de paiement : trente jours calendaires à compter de l'émission de l'autofacture. */
export const ECHEANCE_JOURS = 30;
/** OBJECTIF (sans pénalité ni frais) : virement sous deux jours ouvrés après l'émission. */
export const OBJECTIF_VIREMENT_JOURS_OUVRES = 2;

export { ajouterJoursOuvres };

/** « AAAA-MM-JJ » du jour de Paris. */
export function jourParis(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Échéance ferme : jour de Paris + 30 jours calendaires (rendue à midi UTC). Règle du 25/11 : le
 * délai court depuis le PAIEMENT INTÉGRAL du client (`paiementIntegral`), pas depuis l'émission de
 * l'autofacture (qui peut attendre une donnée de l'apporteur). Sans date de paiement connue, ou si
 * elle est postérieure à l'émission, on garde l'émission (jamais plus tard que l'ancien calcul).
 */
export function echeancePaiement(emission: Date, paiementIntegral?: Date | null): Date {
  const depart =
    paiementIntegral && paiementIntegral.getTime() < emission.getTime()
      ? paiementIntegral
      : emission;
  const [a, m, j] = jourParis(depart).split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, j! + ECHEANCE_JOURS, 12));
}

/** Jour OUVRÉ de Paris : ni samedi, ni dimanche, ni férié. Partagé avec le relevé mensuel. */
export function estJourOuvreParis(d: Date): boolean {
  const jour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    weekday: "short",
  }).format(d);
  return jour !== "Sat" && jour !== "Sun" && !estJourFerieFrance(d);
}

/**
 * Date d'encaissement RETENUE : le jour où le crédit est constaté s'il est ouvré ; sinon le premier
 * jour ouvré suivant (le crédit tombe un week-end ou un férié, ou n'est constaté que plus tard).
 */
export function dateEncaissementRetenue(constateLe: Date): Date {
  const d = new Date(constateLe.getTime());
  while (!estJourOuvreParis(d)) d.setTime(d.getTime() + 86_400_000);
  return d;
}

/** Objectif de virement : encaissement retenu + 2 jours ouvrés (week-ends et fériés exclus). */
export function objectifVirement(emission: Date): Date {
  return ajouterJoursOuvres(dateEncaissementRetenue(emission), OBJECTIF_VIREMENT_JOURS_OUVRES);
}

/**
 * Où en est une autofacture non réglée ? L'objectif dépassé n'est qu'un signal ORANGE ; seule
 * l'échéance de trente jours dépassée est ROUGE. Aucune pénalité n'est calculée ici.
 */
export function etatEcheances(
  emission: Date,
  maintenant: Date,
  paiementIntegral?: Date | null,
): {
  objectif: Date;
  echeance: Date;
  objectifDepasse: boolean;
  echeanceDepassee: boolean;
} {
  const objectif = objectifVirement(emission);
  const echeance = echeancePaiement(emission, paiementIntegral);
  const jour = jourParis(maintenant);
  return {
    objectif,
    echeance,
    objectifDepasse: jour > jourParis(objectif),
    echeanceDepassee: jour > jourParis(echeance),
  };
}

/** « 8 octobre 2026 ». */
export function dateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

/**
 * Ce qui manque à la fiche de l'apporteur pour établir son autofacture (vide = rien ne manque).
 * Mêmes conditions que `construireDonneesAutofacture` : régime de TVA, SIREN, adresse (déchiffrée).
 */
export function donneesManquantesAutofacture(a: {
  regimeTva: ApporteurPourAutofacture["regimeTva"];
  siren: string | null;
  adresse: string | null;
}): string[] {
  const manques: string[] = [];
  if (!regimeHonorairesApporteur(a.regimeTva)) manques.push("régime de TVA de l'apporteur");
  if (!a.siren?.trim() || !sirenValide(a.siren)) manques.push("SIREN de l'apporteur");
  if (!a.adresse?.trim()) manques.push("adresse de l'apporteur");
  return manques;
}

/** Les commissions qui deviennent une ligne d'autofacture, dans l'ordre (comme `lignesAutofacture`). */
function commissionsLignes(
  commissions: readonly CommissionPourAutofacture[],
): CommissionPourAutofacture[] {
  return commissions.filter((c) => c.montantCents !== null && c.montantCents !== 0);
}

/**
 * Date de la PRESTATION d'une autofacture : le jour (Paris) du paiement intégral du client, SANS
 * report au jour ouvré (le report sert à la date d'établissement, art. 5.1). Une seule date : « 10
 * octobre 2026 ». Plusieurs : « du 3 novembre 2026 au 5 novembre 2026 », et chaque ligne de
 * commission porte sa date. Jamais pour la part de parrainage (art. 4.6 : rien sur la commande du
 * filleul) ni pour une reprise. Aucune date connue : `null` (repli de l'appelant).
 */
function datesDePrestation(
  commissions: readonly CommissionPourAutofacture[],
): { libelle: string; suffixes: Map<string, string> } | null {
  const connues = commissionsLignes(commissions).filter(
    (c) => c.statut !== "reprise" && !c.parrainage && c.paiementIntegralAt,
  );
  if (connues.length === 0) return null;
  const jours = [...new Set(connues.map((c) => jourParis(c.paiementIntegralAt!)))].sort();
  const dateDuJour = (j: string) => dateFr(new Date(`${j}T12:00:00Z`));
  if (jours.length === 1) return { libelle: dateDuJour(jours[0]!), suffixes: new Map() };
  return {
    libelle: `du ${dateDuJour(jours[0]!)} au ${dateDuJour(jours[jours.length - 1]!)}`,
    suffixes: new Map(
      connues.map((c) => [
        c.id,
        ` — encaissement intégral le ${dateDuJour(jourParis(c.paiementIntegralAt!))}`,
      ]),
    ),
  };
}

/** Données du gabarit, ou le motif pour lequel la pièce ne peut pas être établie. */
export function construireDonneesAutofacture(e: {
  /** Paiement intégral du client : le délai de 30 jours court de là (règle du 25/11). */
  paiementIntegral?: Date | null;
  numero: string;
  /** Période des prestations imprimée sur la pièce, ex. « commissions exigibles au 6 octobre 2026 ». */
  periodeLibelle: string;
  dateEmission: Date;
  apporteur: ApporteurPourAutofacture;
  commissions: readonly CommissionPourAutofacture[];
  organisme: OrganismeIdentite;
  totalAttenduCents: number;
  /** AVOIR : les `commissions` sont les reprises, `totalAttenduCents` leur total POSITIF. */
  avoir?: { factureInitiale: string; dateFactureInitiale: string | null; imputation: string };
}): { ok: true; data: AutofactureData } | { ok: false; motif: string } {
  const regime = regimeHonorairesApporteur(e.apporteur.regimeTva);
  if (!regime) return { ok: false, motif: "régime de TVA de l'apporteur non renseigné" };
  const siren = e.apporteur.siren?.trim();
  const adresse = e.apporteur.adresse?.trim();
  if (!siren || !adresse)
    return { ok: false, motif: "identité de facturation de l'apporteur incomplète" };
  const prestation = e.avoir ? null : datesDePrestation(e.commissions);
  const lignes = e.avoir
    ? lignesAvoir(e.commissions)
    : lignesAutofacture(e.commissions).map((l, i) => {
        const suffixe = prestation?.suffixes.get(commissionsLignes(e.commissions)[i]!.id);
        return suffixe ? { ...l, designation: `${l.designation}${suffixe}` } : l;
      });
  if (lignes.length === 0) return { ok: false, motif: "aucune commission à facturer" };
  if (totalHtCents(lignes) !== e.totalAttenduCents)
    return { ok: false, motif: "total des lignes différent du total versé" };
  const limite = new Date(
    e.dateEmission.getTime() + DELAI_CONTESTATION_APPORTEUR_JOURS * 86_400_000,
  );
  return {
    ok: true,
    data: {
      numero: e.numero,
      dateEmission: dateFr(e.dateEmission),
      // L'autofacture est datée du jour d'établissement ; la date de prestation est celle de
      // l'encaissement INTÉGRAL du client (art. 4.7) quand elle est connue, sinon l'encaissement retenu.
      datePrestation: prestation?.libelle ?? dateFr(dateEncaissementRetenue(e.dateEmission)),
      dateEcheance: dateFr(echeancePaiement(e.dateEmission, e.paiementIntegral)),
      contestationAvant: dateFr(limite),
      periodeLabel: e.periodeLibelle,
      sousTraitant: {
        nom: e.apporteur.denomination?.trim() || e.apporteur.nom,
        siret: e.apporteur.siret ?? siren,
        numeroTvaIntracom: e.apporteur.numeroTva,
        adresseProfessionnelle: adresse,
        email: e.apporteur.email,
      },
      identite: e.organisme,
      presentation: "apporteur" as const,
      lignes,
      regimeHonoraires: regime,
      delaiContestationJours: DELAI_CONTESTATION_APPORTEUR_JOURS,
      libelleIdentifiantFournisseur: e.apporteur.siret ? "SIRET" : "SIREN",
      mandatReference: REFERENCE_MANDAT_APPORTEUR,
      // Annexe 2.5 du contrat (analyse du 09/10) : dénonciation avec un préavis de trente jours.
      mandatFin:
        "Le mandat de facturation peut être dénoncé par écrit avec un préavis de trente jours (annexe 2 du contrat), sans effet rétroactif sur les factures déjà émises.",
      ...(e.avoir ? { avoir: e.avoir } : {}),
    },
  };
}
