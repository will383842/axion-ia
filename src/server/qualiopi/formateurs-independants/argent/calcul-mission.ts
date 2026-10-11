/**
 * Formateurs indépendants — CALCUL DU PAIEMENT PAR MISSION (L15b), pur.
 *
 * 🔑 SEULE SOURCE DE CALCUL du paiement par mission : relevé du mois, indemnité
 * d'annulation, présentation de la méthode, pénalités de retard, imputation d'un
 * trop-perçu, avoir. Les moteurs (L12c et suivants) lisent la base, appellent
 * ces fonctions, et écrivent ce qu'elles rendent — rien d'autre ne calcule.
 *
 * Règles (contrat-cadre v3 arrêté ; ADR 0066 v2 (e) ; plan 08 §2.7) :
 *   - 175 € HT par demi-journée SIGNÉE, 350 € la journée, jamais plus, jamais au
 *     prorata des heures (art. 9.2) ;
 *   - demi-journée = tarif / 2 arrondi à l'entier inférieur, le reliquat d'un
 *     tarif impair va à la demi-journée qui complète une journée : le montant
 *     d'animation est ⌊n × tarif / 2⌋ (deux demi-journées = le tarif exact) ;
 *   - forfait de déplacement PAR JOURNÉE de déplacement réalisée (une
 *     demi-journée compte comme une journée), plafonné (art. 10) ;
 *   - TVA calculée sur le TOTAL HT du relevé, au régime FIGÉ à la lettre de
 *     mission (`calculerTva`, source unique de `remuneration/calcul.ts`) ;
 *   - échéance = dernière journée du mois facturé + 30 jours ; date cible = le
 *     dernier jour ouvré au plus tard à l'échéance (`dates.ts`).
 *
 * Centimes entiers partout ; une entrée non entière ou négative est refusée.
 */

import { calculerTva, type TvaRegimeHonoraires } from "@/server/qualiopi/remuneration/calcul";
import type { MoisAnime } from "@/server/qualiopi/remuneration/heures-animees";

import { dateCibleVirement, echeanceLegale, joursEntre, jourParis, type JourCivil } from "./dates";
import { PARAMETRES_ARGENT_FORMATEURS, type ParametresArgentFormateurs } from "./parametres";

function entierPositif(nom: string, x: number): number {
  if (!Number.isInteger(x) || x < 0) throw new Error(`${nom} : entier ≥ 0 attendu (${x})`);
  return x;
}

/* ─── Lignes ─────────────────────────────────────────────────────────────── */

/** Animation : ⌊n × tarif / 2⌋ — deux demi-journées font toujours le tarif exact. */
export function montantAnimationCents(demiJournees: number, tarifJourneeHtCents: number): number {
  entierPositif("demi-journées", demiJournees);
  entierPositif("tarif", tarifJourneeHtCents);
  return Math.floor((demiJournees * tarifJourneeHtCents) / 2);
}

/** Déplacement : journées × forfait par journée ; un forfait au-dessus du plafond est refusé. */
export function montantDeplacementCents(
  journeesDeplacement: number,
  forfaitParJourHtCents: number,
  p: Pick<
    ParametresArgentFormateurs,
    "plafondForfaitDeplacementParJourHtCents"
  > = PARAMETRES_ARGENT_FORMATEURS,
): number {
  entierPositif("journées de déplacement", journeesDeplacement);
  entierPositif("forfait", forfaitParJourHtCents);
  if (forfaitParJourHtCents > p.plafondForfaitDeplacementParJourHtCents) {
    throw new Error(
      `forfait de déplacement ${forfaitParJourHtCents} au-dessus du plafond ${p.plafondForfaitDeplacementParJourHtCents}`,
    );
  }
  return journeesDeplacement * forfaitParJourHtCents;
}

export type ObjetLigneMission =
  | "animation"
  | "deplacement"
  | "indemnite_annulation"
  | "presentation_methode"
  | "ajustement"
  | "penalites_retard"
  | "indemnite_recouvrement";

export interface LigneCalculee {
  readonly objet: ObjetLigneMission;
  readonly montantHtCents: number;
  readonly demiJournees?: number;
  readonly journeesDeplacement?: number;
}

export interface TotauxReleve {
  readonly totalHtCents: number;
  readonly tvaCents: number;
  readonly totalTtcCents: number;
  readonly mentionTva: string;
}

/** Totaux d'un relevé : TVA sur le TOTAL HT, au régime figé. */
export function totaliser(
  lignes: ReadonlyArray<Pick<LigneCalculee, "montantHtCents">>,
  regime: TvaRegimeHonoraires,
): TotauxReleve {
  const totalHtCents = lignes.reduce((s, l) => s + l.montantHtCents, 0);
  const t = calculerTva(totalHtCents, regime);
  return {
    totalHtCents,
    tvaCents: t.tvaCents,
    totalTtcCents: t.totalTtcCents,
    mentionTva: t.mention,
  };
}

/* ─── Relevé du mois d'une mission ───────────────────────────────────────── */

export interface ConditionsMission {
  /** Figé sur `MissionFormateur.tarifHtCents` (la journée). */
  readonly tarifJourneeHtCents: number;
  /** Figé sur `MissionFormateur.forfaitDeplacementParJourHtCents` ; 0 ou null = compris. */
  readonly forfaitDeplacementParJourHtCents: number | null;
  /** Figé sur `MissionFormateur.regimeTvaFige` à l'émission de la lettre. */
  readonly regimeTva: TvaRegimeHonoraires;
}

export interface ReleveMissionCalcule extends TotauxReleve {
  readonly mois: string;
  readonly lignes: ReadonlyArray<LigneCalculee>;
  readonly derniereJournee: JourCivil;
  readonly echeance: JourCivil;
  readonly dateCible: JourCivil;
}

/** Le relevé d'UN mois d'une mission, à partir des demi-journées SIGNÉES de ce mois. */
export function calculerReleveDuMois(
  mois: MoisAnime,
  c: ConditionsMission,
  p: ParametresArgentFormateurs = PARAMETRES_ARGENT_FORMATEURS,
): ReleveMissionCalcule {
  if (mois.demiJournees <= 0) throw new Error("aucune demi-journée signée : rien à payer");
  const lignes: LigneCalculee[] = [
    {
      objet: "animation",
      demiJournees: mois.demiJournees,
      montantHtCents: montantAnimationCents(mois.demiJournees, c.tarifJourneeHtCents),
    },
  ];
  const forfait = c.forfaitDeplacementParJourHtCents ?? 0;
  if (forfait > 0) {
    lignes.push({
      objet: "deplacement",
      journeesDeplacement: mois.journees,
      montantHtCents: montantDeplacementCents(mois.journees, forfait, p),
    });
  }
  const echeance = echeanceLegale(mois.derniereJournee, p);
  return {
    mois: mois.mois,
    lignes,
    ...totaliser(lignes, c.regimeTva),
    derniereJournee: mois.derniereJournee,
    echeance,
    dateCible: dateCibleVirement(echeance),
  };
}

/**
 * Décision 88 (recommandation, éteinte) : UN relevé par organisme, session et
 * mois, quel que soit le nombre d'intervenants. Chaque intervenant est compté
 * sur SES signatures (deux intervenants le même jour = deux journées), puis les
 * lignes sont additionnées ; une seule TVA, sur le total.
 */
export function calculerReleveOrganisme(
  moisParIntervenant: ReadonlyArray<MoisAnime>,
  c: ConditionsMission,
  p: ParametresArgentFormateurs = PARAMETRES_ARGENT_FORMATEURS,
): ReleveMissionCalcule {
  const parIntervenant = moisParIntervenant.map((m) => calculerReleveDuMois(m, c, p));
  if (parIntervenant.length === 0) throw new Error("aucun intervenant : rien à payer");
  const mois = parIntervenant[0]!.mois;
  if (parIntervenant.some((r) => r.mois !== mois))
    throw new Error("intervenants de mois différents");
  const somme = (objet: ObjetLigneMission): LigneCalculee | null => {
    const ls = parIntervenant.flatMap((r) => r.lignes.filter((l) => l.objet === objet));
    if (ls.length === 0) return null;
    return {
      objet,
      montantHtCents: ls.reduce((s, l) => s + l.montantHtCents, 0),
      ...(objet === "animation"
        ? { demiJournees: ls.reduce((s, l) => s + (l.demiJournees ?? 0), 0) }
        : { journeesDeplacement: ls.reduce((s, l) => s + (l.journeesDeplacement ?? 0), 0) }),
    };
  };
  const lignes = [somme("animation"), somme("deplacement")].filter(
    (l): l is LigneCalculee => l !== null,
  );
  const derniereJournee = parIntervenant
    .map((r) => r.derniereJournee)
    .sort()
    .at(-1)!;
  const echeance = echeanceLegale(derniereJournee, p);
  return {
    mois,
    lignes,
    ...totaliser(lignes, c.regimeTva),
    derniereJournee,
    echeance,
    dateCible: dateCibleVirement(echeance),
  };
}

/**
 * Décision 66 : le relevé part sans regard humain s'il n'a AUCUN écart avec la
 * part PRÉVUE du mois (demi-journées et journées prévues du mois, mêmes
 * conditions). On compare la part du mois, jamais le total de la lettre : une
 * session sur trois mois n'attend pas Will trois fois.
 */
export function releveSansEcart(
  calcule: Pick<ReleveMissionCalcule, "totalHtCents">,
  prevu: Pick<MoisAnime, "demiJournees" | "journees">,
  c: ConditionsMission,
  p: ParametresArgentFormateurs = PARAMETRES_ARGENT_FORMATEURS,
): boolean {
  if (prevu.demiJournees <= 0) return false;
  const forfait = c.forfaitDeplacementParJourHtCents ?? 0;
  const attendu =
    montantAnimationCents(prevu.demiJournees, c.tarifJourneeHtCents) +
    (forfait > 0 ? montantDeplacementCents(prevu.journees, forfait, p) : 0);
  return attendu === calcule.totalHtCents;
}

/* ─── Mission payable (grain session × mois) ─────────────────────────────── */

export type RaisonNonPayable =
  "aucune_signature" | "feuilles_incompletes" | "condition_financeur_en_attente";

export interface VerdictPayable {
  readonly payable: boolean;
  readonly raison: RaisonNonPayable | null;
  /** Demi-journées prévues du mois sans signature (relance J+3, alerte J+10). */
  readonly manquantes: number;
}

/**
 * Le mois d'une mission est payable dès que TOUTES ses demi-journées prévues
 * sont signées par le formateur (sans attendre la fin du mois, ni la
 * contresignature d'Axion, ni le paiement du client), et qu'aucune condition du
 * financeur n'est en attente. « Payer sur constat » (J+20, `super_admin`) est le
 * seul repli, porté par l'appelant.
 */
export function moisPayable(e: {
  readonly prevues: number;
  readonly signees: number;
  readonly manquantes: number;
  readonly conditionFinanceurEnAttente: boolean;
}): VerdictPayable {
  if (e.conditionFinanceurEnAttente)
    return { payable: false, raison: "condition_financeur_en_attente", manquantes: e.manquantes };
  if (e.signees <= 0)
    return { payable: false, raison: "aucune_signature", manquantes: e.manquantes };
  if (e.manquantes > 0)
    return { payable: false, raison: "feuilles_incompletes", manquantes: e.manquantes };
  return { payable: true, raison: null, manquantes: 0 };
}

/* ─── Indemnité d'annulation (art. 11) ───────────────────────────────────── */

export interface Annulation {
  /** Instant où Axion annule (ou notifie le report refusé, ou le refus du financeur). */
  readonly annuleeA: Date;
  /** Début de la PREMIÈRE demi-journée annulée. */
  readonly debutPremiereAnnulee: Date;
  /** Demi-journées annulées (les seules qui comptent ; le forfait n'entre jamais). */
  readonly demiJourneesAnnulees: number;
  readonly tarifJourneeHtCents: number;
  /** La mission avait été acceptée (« J'accepte ») avant l'annulation. */
  readonly accepteeAvant: boolean;
  /** Annulation par AXION. Un désistement du formateur n'ouvre aucun droit (art. 7.4). */
  readonly parAxion: boolean;
}

export interface IndemniteCalculee {
  readonly due: boolean;
  readonly montantHtCents: number;
  /** Jour de l'annulation : la ligne est rattachée à son mois. */
  readonly jourAnnulation: JourCivil;
  readonly echeance: JourCivil;
  readonly dateCible: JourCivil;
}

/**
 * 50 % des honoraires des demi-journées annulées, hors forfait, si Axion annule
 * moins de 72 heures avant la première demi-journée annulée d'une mission
 * acceptée ; rien sinon. Échéance = date de l'annulation + 30 jours.
 */
export function indemniteAnnulation(
  a: Annulation,
  p: ParametresArgentFormateurs = PARAMETRES_ARGENT_FORMATEURS,
): IndemniteCalculee {
  const jourAnnulation = jourParis(a.annuleeA);
  const echeance = echeanceLegale(jourAnnulation, p);
  const delaiMs = a.debutPremiereAnnulee.getTime() - a.annuleeA.getTime();
  const sous72h = delaiMs < p.delaiAnnulationIndemniseeHeures * 3_600_000;
  const due = a.parAxion && a.accepteeAvant && sous72h && a.demiJourneesAnnulees > 0;
  const base = montantAnimationCents(a.demiJourneesAnnulees, a.tarifJourneeHtCents);
  return {
    due,
    montantHtCents: due ? Math.floor((base * p.indemniteAnnulationPourcent) / 100) : 0,
    jourAnnulation,
    echeance,
    dateCible: dateCibleVirement(echeance),
  };
}

/* ─── Présentation de la méthode (art. 21) ───────────────────────────────── */

export function presentationMethode(
  jour: JourCivil,
  regime: TvaRegimeHonoraires,
  p: ParametresArgentFormateurs = PARAMETRES_ARGENT_FORMATEURS,
): { lignes: LigneCalculee[]; echeance: JourCivil; dateCible: JourCivil } & TotauxReleve {
  const lignes: LigneCalculee[] = [
    {
      objet: "presentation_methode",
      demiJournees: 1,
      montantHtCents: p.presentationMethodeHtCents,
    },
  ];
  const echeance = echeanceLegale(jour, p);
  return { lignes, ...totaliser(lignes, regime), echeance, dateCible: dateCibleVirement(echeance) };
}

/* ─── Pénalités de retard (art. 16.6, décision 87) ───────────────────────── */

export interface Retard {
  readonly joursDeRetard: number;
  /** `null` = taux BCE non renseigné : à calculer à la main, jamais inventé. */
  readonly penalitesCents: number | null;
  readonly indemniteRecouvrementCents: number;
}

/**
 * Virement fait APRÈS l'échéance : pénalités = TTC dû × (taux BCE + 10 points)
 * × jours de retard / 365, arrondies au centime ; plus 40 € d'indemnité
 * forfaitaire. Aucun retard : tout à 0.
 */
export function retardDePaiement(
  e: { readonly totalTtcCents: number; readonly echeance: JourCivil; readonly payeLe: JourCivil },
  p: ParametresArgentFormateurs = PARAMETRES_ARGENT_FORMATEURS,
): Retard {
  entierPositif("TTC", e.totalTtcCents);
  const jours = joursEntre(e.echeance, e.payeLe);
  if (jours <= 0) return { joursDeRetard: 0, penalitesCents: 0, indemniteRecouvrementCents: 0 };
  const taux = p.tauxBceBp === null ? null : p.tauxBceBp + p.majorationPenalitesBp;
  return {
    joursDeRetard: jours,
    penalitesCents:
      taux === null ? null : Math.round((e.totalTtcCents * taux * jours) / (10_000 * 365)),
    indemniteRecouvrementCents: p.indemniteRecouvrementCents,
  };
}

/* ─── Changement d'IBAN (décision 72) ────────────────────────────────────── */

/**
 * Le NOUVEL IBAN ne sert qu'après l'accord d'un administrateur ET 48 heures
 * après la demande (l'ancienne adresse a été prévenue). Avant l'accord, l'ancien
 * compte reste utilisable. `null` = pas encore validé.
 */
export function nouvelIbanUtilisableDes(
  e: { readonly demandeA: Date; readonly valideA: Date | null },
  p: Pick<ParametresArgentFormateurs, "delaiChangementIbanHeures"> = PARAMETRES_ARGENT_FORMATEURS,
): Date | null {
  if (e.valideA === null) return null;
  const apresDelai = e.demandeA.getTime() + p.delaiChangementIbanHeures * 3_600_000;
  return new Date(Math.max(apresDelai, e.valideA.getTime()));
}

/* ─── Avoir et trop-perçu (décisions 69 et 89) ───────────────────────────── */

/** L'avoir d'une pièce : chaque montant NIÉ (jamais recalculé — pas d'écart d'arrondi). */
export function avoirDe(t: TotauxReleve, lignes: ReadonlyArray<LigneCalculee>) {
  return {
    lignes: lignes.map((l) => ({ ...l, montantHtCents: -l.montantHtCents })),
    totalHtCents: -t.totalHtCents,
    tvaCents: -t.tvaCents,
    totalTtcCents: -t.totalTtcCents,
    mentionTva: t.mentionTva,
  };
}

export interface AvoirOuvert {
  readonly statementId: string;
  /** HT restant à imputer ou à rembourser (> 0). */
  readonly resteHtCents: number;
  readonly emisLe: JourCivil;
  readonly remboursementDemande: boolean;
}

export interface PlanTropPercu {
  /** Lignes d'ajustement NÉGATIVES à poser sur le relevé suivant. */
  readonly imputations: ReadonlyArray<{ avoirId: string; montantHtCents: number }>;
  /** Avoirs pour lesquels demander le remboursement (F54). */
  readonly demandesRemboursement: ReadonlyArray<string>;
}

/**
 * Un trop-perçu s'impute sur le RELEVÉ SUIVANT du même formateur, sans jamais le
 * rendre négatif ; sans relevé suivant 60 jours après l'avoir, on demande le
 * remboursement (une fois). Jamais de retenue sur autre chose sans accord écrit.
 */
export function planTropPercu(
  avoirs: ReadonlyArray<AvoirOuvert>,
  releveSuivant: { readonly totalHtCents: number } | null,
  aujourdhui: JourCivil,
  p: ParametresArgentFormateurs = PARAMETRES_ARGENT_FORMATEURS,
): PlanTropPercu {
  const imputations: { avoirId: string; montantHtCents: number }[] = [];
  const demandes: string[] = [];
  let disponible = releveSuivant ? Math.max(0, releveSuivant.totalHtCents) : 0;
  for (const a of [...avoirs].sort((x, y) => (x.emisLe < y.emisLe ? -1 : 1))) {
    entierPositif("reste de l'avoir", a.resteHtCents);
    if (a.resteHtCents === 0) continue;
    const impute = Math.min(a.resteHtCents, disponible);
    if (impute > 0) {
      imputations.push({ avoirId: a.statementId, montantHtCents: -impute });
      disponible -= impute;
    }
    const reste = a.resteHtCents - impute;
    if (
      reste > 0 &&
      !releveSuivant &&
      !a.remboursementDemande &&
      joursEntre(a.emisLe, aujourdhui) >= p.delaiTropPercuJours
    ) {
      demandes.push(a.statementId);
    }
  }
  return { imputations, demandesRemboursement: demandes };
}
