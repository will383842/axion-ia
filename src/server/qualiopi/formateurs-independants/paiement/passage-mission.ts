/**
 * Formateurs indépendants — LE PASSAGE DU PAIEMENT PAR MISSION (lot L12c).
 *
 * Chaque jour, pour toute session commencée à la date de bascule `D` ou après,
 * et pour chaque formateur indépendant qui y a CONTRESIGNÉ des demi-journées :
 *   1. revendiquer le paiement (`revendications_paiement`, ajout seul) — si le
 *      relevé mensuel l'a revendiqué d'abord, s'abstenir ;
 *   2. refuser d'écrire s'il existe une ligne MENSUELLE non annulée pour ce
 *      couple (formateur, session), tous mois confondus (propriétaire en conflit) ;
 *   3. pour chaque mois civil dont TOUTES les demi-journées prévues sont signées,
 *      écrire UN relevé de mission (`a_valider`) et ses lignes, calculés par la
 *      seule source (`argent/calcul-mission.ts`), échéance PROVISOIRE posée — la
 *      définitive part de la date de l'autofacture (`echeance-autofacture.ts`).
 *
 * 🔴 ÉTEINT PAR DÉFAUT. Sans date `formateurs.passage_paiement`, rien ne se
 * passe ; tant que l'unique historique (M-D) est en base, rien ne s'écrit non
 * plus. Aucun relevé n'est validé seul (décision 66 non tranchée) : Will valide,
 * et l'autofacture part par le chemin existant.
 *
 * Idempotent : verrous de période puis de formateur (ordre unique), index
 * uniques partiels ; un second passage ne crée rien. Ne lève jamais : le bilan
 * dit ce qui s'est passé. `maintenant` est un paramètre (aucune horloge truquée).
 */

import * as Sentry from "@sentry/nextjs";

import type { TvaRegimeHonoraires } from "@/server/qualiopi/remuneration/calcul";
import {
  demiJourneesPrevues,
  demiJourneesSansSignature,
  demiJourneesSignees,
  parMoisCivil,
  type ContresignatureLue,
  type JourneePrevue,
  type MoisAnime,
} from "@/server/qualiopi/remuneration/heures-animees";

import {
  calculerReleveDuMois,
  montantPrevuDuMoisHtCents,
  releveSansEcart,
  type ConditionsMission,
  type ReleveMissionCalcule,
} from "../argent/calcul-mission";
import { jourParis } from "../argent/dates";
import {
  PARAMETRES_ARGENT_FORMATEURS,
  type ParametresArgentFormateurs,
} from "../argent/parametres";
import {
  formationCompletePourFormateur,
  type EtatBilanPourPaiement,
  type RaisonFormationIncomplete,
} from "./formation-complete";

/** Un couple (formateur indépendant, session) lu en base. */
export interface CandidatMission {
  readonly trainerId: string;
  readonly sessionId: string;
  /** Première journée de la SESSION (jour civil) : elle décide du propriétaire. */
  readonly premiereJournee: string;
  /** Conditions figées sur la mission ; `null` = aucune mission à prix figé. */
  readonly conditions: ConditionsMission | null;
  readonly contresignatures: ReadonlyArray<ContresignatureLue>;
  /** Journées prévues qui reviennent à CE formateur. */
  readonly journeesPrevues: ReadonlyArray<JourneePrevue>;
  /** Une condition du financeur est en attente (rien n'est payable). */
  readonly conditionFinanceurEnAttente: boolean;
  /**
   * Le couple est déjà revendiqué `par_mission` : il RESTE au passage, même si
   * une journée ajoutée après coup place la première journée avant la bascule
   * (le run mensuel l'écarte à cause de la revendication : personne ne paierait).
   */
  readonly revendiqueParMission?: boolean;
  /**
   * Lot G2 — le bilan de fin de formation, quand il est EXIGÉ (interrupteur
   * `formateurs.bilan_fin_formation` allumé, session finie après l'allumage). Absent :
   * rien n'est exigé au-delà des feuilles, exactement comme avant.
   */
  readonly bilanFinFormation?: EtatBilanPourPaiement;
}

export interface MoisAEcrire {
  readonly trainerId: string;
  readonly sessionId: string;
  readonly releve: ReleveMissionCalcule;
  readonly regimeTva: TvaRegimeHonoraires;
  readonly tarifJourneeHtCents: number;
  /** Décision 66 : sans écart avec la part prévue du mois. Informatif tant qu'elle est ouverte. */
  readonly sansEcart: boolean;
  /** Lot D2 (M22) : le HT de la part prévue du mois, pour l'anomalie « écart ». */
  readonly prevuHtCents?: number;
}

export type MotifAnomaliePassage =
  | "conditions_absentes"
  | "conditions_hors_plafond"
  /** Signatures sur un mois sans aucune demi-journée prévue pour ce formateur : jamais payé seul. */
  | "prevu_absent";

export interface Plan {
  readonly aEcrire: ReadonlyArray<MoisAEcrire>;
  readonly enAttente: ReadonlyArray<{
    trainerId: string;
    sessionId: string;
    mois: string;
    raison: RaisonFormationIncomplete | "aucune_signature_mois_passe";
    manquantes: number;
  }>;
  readonly anomalies: ReadonlyArray<{
    trainerId: string;
    sessionId: string;
    motif: MotifAnomaliePassage;
  }>;
}

/**
 * Pure : ce que le passage doit écrire. Une session commencée AVANT la bascule
 * n'est jamais touchée (elle appartient au relevé mensuel).
 */
export function planifierPassage(
  candidats: ReadonlyArray<CandidatMission>,
  dateBascule: string,
  p: ParametresArgentFormateurs = PARAMETRES_ARGENT_FORMATEURS,
  /** Pour signaler les mois prévus, passés, sans aucune signature (relances). */
  aujourdhui?: string,
): Plan {
  const aEcrire: MoisAEcrire[] = [];
  const enAttente: Plan["enAttente"][number][] = [];
  const anomalies: Plan["anomalies"][number][] = [];
  const bornes = {
    matinAvant: p.matinAvant,
    apresMidiApres: p.apresMidiApres,
    milieuDeJournee: p.milieuDeJournee,
  };

  for (const c of candidats) {
    if (c.premiereJournee < dateBascule && c.revendiqueParMission !== true) continue;
    const signees = demiJourneesSignees(c.contresignatures);
    if (signees.length === 0) continue;
    if (c.conditions === null) {
      anomalies.push({
        trainerId: c.trainerId,
        sessionId: c.sessionId,
        motif: "conditions_absentes",
      });
      continue;
    }
    const conditions = c.conditions;
    const prevues = demiJourneesPrevues(c.journeesPrevues, bornes);
    const prevuesParMois = new Map(parMoisCivil(prevues).map((m) => [m.mois, m] as const));
    const moisSignes = new Set(parMoisCivil(signees).map((m) => m.mois));
    // Décision de Will : seul le DERNIER mois de la mission (celui de la dernière journée
    // prévue de ce formateur, `parMoisCivil` trie les mois) attend le bilan.
    const dernierMoisPrevu = [...prevuesParMois.keys()].at(-1);
    if (aujourdhui) {
      for (const pm of prevuesParMois.values()) {
        if (!moisSignes.has(pm.mois) && pm.derniereJournee < aujourdhui)
          enAttente.push({
            trainerId: c.trainerId,
            sessionId: c.sessionId,
            mois: pm.mois,
            raison: "aucune_signature_mois_passe",
            manquantes: pm.demiJournees,
          });
      }
    }
    for (const mois of parMoisCivil(signees)) {
      const prevuDuMois: MoisAnime | undefined = prevuesParMois.get(mois.mois);
      if (!prevuDuMois) {
        // Aucune demi-journée prévue pour lui ce mois-là : impossible de savoir si
        // le mois est complet. Jamais payé seul (sinon le reste du mois serait perdu).
        anomalies.push({ trainerId: c.trainerId, sessionId: c.sessionId, motif: "prevu_absent" });
        continue;
      }
      const manquantes = prevuDuMois
        ? demiJourneesSansSignature(prevuDuMois.detail, mois.detail).length
        : 0;
      // Lot G2 : « formation complète » = la règle des feuilles (`moisPayable`, reprise
      // telle quelle) ET, pour le dernier mois de la mission seulement, le bilan de fin de
      // formation quand il est exigé. Les mois précédents : les feuilles seules.
      const verdict = formationCompletePourFormateur({
        signees: mois.demiJournees,
        manquantes,
        conditionFinanceurEnAttente: c.conditionFinanceurEnAttente,
        bilan: mois.mois === dernierMoisPrevu ? (c.bilanFinFormation ?? null) : null,
      });
      if (!verdict.payable) {
        enAttente.push({
          trainerId: c.trainerId,
          sessionId: c.sessionId,
          mois: mois.mois,
          raison: verdict.raison!,
          manquantes: verdict.manquantes,
        });
        continue;
      }
      let releve: ReleveMissionCalcule;
      try {
        releve = calculerReleveDuMois(mois, conditions, p);
      } catch {
        anomalies.push({
          trainerId: c.trainerId,
          sessionId: c.sessionId,
          motif: "conditions_hors_plafond",
        });
        continue;
      }
      aEcrire.push({
        trainerId: c.trainerId,
        sessionId: c.sessionId,
        releve,
        regimeTva: conditions.regimeTva,
        tarifJourneeHtCents: conditions.tarifJourneeHtCents,
        sansEcart: releveSansEcart(releve, prevuDuMois, conditions, p),
        prevuHtCents: montantPrevuDuMoisHtCents(prevuDuMois, conditions, p),
      });
    }
  }
  return { aEcrire, enAttente, anomalies };
}

/** Ce que l'écriture d'un mois a donné. */
export type IssueEcriture =
  | "ecrit"
  | "deja_ecrit"
  | "revendique_par_le_mensuel"
  | "conflit_ligne_mensuelle"
  /** Relevé déjà écrit, mais des demi-journées signées en plus : à corriger par avoir. */
  | "complement_a_traiter"
  /** La pièce du mois a été annulée par avoir : sa réémission est un geste humain. */
  | "reemission_attendue";

export interface DepsPassage {
  dateBascule(): Promise<string | null>;
  uniqueHistoriqueRetire(): Promise<boolean>;
  candidats(dateBascule: string): Promise<CandidatMission[]>;
  ecrireMois(m: MoisAEcrire, maintenant: Date): Promise<IssueEcriture>;
}

export type BilanPassage =
  | { etat: "coupe" }
  | { etat: "bloque_contract" }
  | { etat: "echec"; message: string }
  | {
      etat: "fait";
      ecrits: number;
      dejaEcrits: number;
      conflits: number;
      complements: number;
      erreurs: number;
      enAttente: number;
      anomalies: Plan["anomalies"];
    };

export async function passerPaiementsMission(
  maintenant: Date,
  deps: DepsPassage,
): Promise<BilanPassage> {
  try {
    const d = await deps.dateBascule();
    if (d === null) return { etat: "coupe" };
    // La bascule n'a d'effet qu'à partir de sa date (un 1er du mois).
    if (jourParis(maintenant) < d) return { etat: "coupe" };
    if (!(await deps.uniqueHistoriqueRetire())) return { etat: "bloque_contract" };
    const plan = planifierPassage(await deps.candidats(d), d, undefined, jourParis(maintenant));
    let ecrits = 0;
    let dejaEcrits = 0;
    let conflits = 0;
    let complements = 0;
    let erreurs = 0;
    for (const m of plan.aEcrire) {
      // Une erreur sur UN mois n'arrête pas les autres : elle est comptée.
      let issue: IssueEcriture;
      try {
        issue = await deps.ecrireMois(m, maintenant);
      } catch (err) {
        erreurs += 1;
        // Identifiants techniques seulement (aucune donnée personnelle).
        console.error(
          `[paiement-mission] mois ${m.releve.mois} de la session ${m.sessionId} non écrit :`,
          err instanceof Error ? err.message.slice(0, 200) : String(err),
        );
        // Chantier C4 : un mois qui lève chaque jour n'est plus jamais payé ; un
        // console.error ne le dit à personne. Remonté comme les autres erreurs du module.
        signaler(err, "paiement-mission:mois_non_ecrit", {
          mois: m.releve.mois,
          sessionId: m.sessionId,
        });
        continue;
      }
      if (issue === "ecrit") ecrits += 1;
      else if (issue === "deja_ecrit") dejaEcrits += 1;
      // « À traiter à la main » : complément signé après coup, ou réémission après avoir.
      else if (issue === "complement_a_traiter" || issue === "reemission_attendue")
        complements += 1;
      else conflits += 1;
    }
    return {
      etat: "fait",
      ecrits,
      dejaEcrits,
      conflits,
      complements,
      erreurs,
      enAttente: plan.enAttente.length,
      anomalies: plan.anomalies,
    };
  } catch (err) {
    signaler(err, "paiement-mission:passage_en_echec", {});
    return { etat: "echec", message: err instanceof Error ? err.message : String(err) };
  }
}

/** Observabilité : jamais bloquante, identifiants techniques seulement. */
function signaler(err: unknown, action: string, extra: Record<string, string>): void {
  try {
    Sentry.captureException(err, { tags: { action }, extra });
  } catch {
    // Jamais bloquant.
  }
}
