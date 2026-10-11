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
 *      seule source (`argent/calcul-mission.ts`), échéance fixe posée.
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
  moisPayable,
  releveSansEcart,
  type ConditionsMission,
  type RaisonNonPayable,
  type ReleveMissionCalcule,
} from "../argent/calcul-mission";
import { jourParis } from "../argent/dates";
import {
  PARAMETRES_ARGENT_FORMATEURS,
  type ParametresArgentFormateurs,
} from "../argent/parametres";

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
}

export interface MoisAEcrire {
  readonly trainerId: string;
  readonly sessionId: string;
  readonly releve: ReleveMissionCalcule;
  readonly regimeTva: TvaRegimeHonoraires;
  readonly tarifJourneeHtCents: number;
  /** Décision 66 : sans écart avec la part prévue du mois. Informatif tant qu'elle est ouverte. */
  readonly sansEcart: boolean;
}

export type MotifAnomaliePassage = "conditions_absentes" | "conditions_hors_plafond";

export interface Plan {
  readonly aEcrire: ReadonlyArray<MoisAEcrire>;
  readonly enAttente: ReadonlyArray<{
    trainerId: string;
    sessionId: string;
    mois: string;
    raison: RaisonNonPayable;
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
    if (c.premiereJournee < dateBascule) continue;
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
    for (const mois of parMoisCivil(signees)) {
      const prevuDuMois: MoisAnime | undefined = prevuesParMois.get(mois.mois);
      const manquantes = prevuDuMois
        ? demiJourneesSansSignature(prevuDuMois.detail, mois.detail).length
        : 0;
      const verdict = moisPayable({
        signees: mois.demiJournees,
        manquantes,
        conditionFinanceurEnAttente: c.conditionFinanceurEnAttente,
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
        sansEcart: prevuDuMois ? releveSansEcart(releve, prevuDuMois, conditions, p) : false,
      });
    }
  }
  return { aEcrire, enAttente, anomalies };
}

/** Ce que l'écriture d'un mois a donné. */
export type IssueEcriture =
  "ecrit" | "deja_ecrit" | "revendique_par_le_mensuel" | "conflit_ligne_mensuelle";

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
    const plan = planifierPassage(await deps.candidats(d), d);
    let ecrits = 0;
    let dejaEcrits = 0;
    let conflits = 0;
    for (const m of plan.aEcrire) {
      const issue = await deps.ecrireMois(m, maintenant);
      if (issue === "ecrit") ecrits += 1;
      else if (issue === "deja_ecrit") dejaEcrits += 1;
      else conflits += 1;
    }
    return {
      etat: "fait",
      ecrits,
      dejaEcrits,
      conflits,
      enAttente: plan.enAttente.length,
      anomalies: plan.anomalies,
    };
  } catch (err) {
    return { etat: "echec", message: err instanceof Error ? err.message : String(err) };
  }
}
