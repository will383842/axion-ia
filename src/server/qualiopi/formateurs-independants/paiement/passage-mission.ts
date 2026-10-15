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
  type BornesDemiJournee,
  type ContresignatureLue,
  type DemiJourneeDatee,
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
import { aChevalSurLaBascule } from "./apres-bascule";
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
  /**
   * Vérification 1, V1-C-5 — la session est ANNULÉE : ses journées non signées ne
   * sont plus « prévues » (elles n'auront jamais lieu), les demi-journées déjà
   * signées sont payées, et aucun bilan de fin de formation n'est attendu.
   */
  readonly sessionAnnulee?: boolean;
  /**
   * Dernière journée de la SESSION (jour civil). Avec `premiereJournee`, elle dit si
   * la session est à cheval sur la bascule (V1-C-2). Absente : jamais à cheval.
   */
  readonly derniereJourneeSession?: string | null;
  /**
   * Vérification 2, V2-A-2 — le formateur intervient pour un ORGANISME sous-traitant
   * (`Trainer.organismeSousTraitantId`) : c'est l'organisme qui facture ses journées.
   * Le passage n'écrit JAMAIS de relevé au nom de l'intervenant ; ces journées sont à
   * traiter à la main (alerte `honoraires_organisme_a_traiter`), sans virement
   * automatique, tant que le circuit des organismes (L11f) n'est pas livré.
   */
  readonly intervenantOrganisme?: boolean;
}

/**
 * Le couple appartient-il au passage ? Session commencée à la bascule ou après, ou
 * déjà revendiquée par mission, ou — V1-C-2 — à cheval sur la bascule avec une
 * mission acceptée à PRIX FIGÉ : le relevé mensuel ne paie jamais un prix figé
 * (correctif L11b), le passage la paie donc entière, à ce prix, une seule fois (la
 * revendication et le contrôle de ligne mensuelle de l'écriture l'assurent).
 */
export function appartientAuPassage(
  c: Pick<
    CandidatMission,
    "premiereJournee" | "revendiqueParMission" | "conditions" | "derniereJourneeSession"
  >,
  dateBascule: string,
): boolean {
  if (c.premiereJournee >= dateBascule || c.revendiqueParMission === true) return true;
  return (
    c.conditions !== null &&
    aChevalSurLaBascule(
      { premiereJournee: c.premiereJournee, derniereJournee: c.derniereJourneeSession ?? null },
      dateBascule,
    )
  );
}

/**
 * Les demi-journées PRÉVUES d'un candidat. Session annulée : seules celles qui ont
 * été signées restent prévues — le reste n'aura pas lieu, le réclamer laisserait le
 * mois « en attente » pour toujours (V1-C-5). Lue par le passage et par F35.
 */
export function demiJourneesPrevuesDuCandidat(
  c: Pick<CandidatMission, "journeesPrevues" | "contresignatures" | "sessionAnnulee">,
  bornes: BornesDemiJournee,
): DemiJourneeDatee[] {
  const prevues = demiJourneesPrevues(c.journeesPrevues, bornes);
  if (c.sessionAnnulee !== true) return prevues;
  const signees = new Set(
    demiJourneesSignees(c.contresignatures).map((d) => `${d.jour}|${d.creneau}`),
  );
  return prevues.filter((d) => signees.has(`${d.jour}|${d.creneau}`));
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
  | "prevu_absent"
  /**
   * V2-A-1 — des demi-journées signées qui ne sont PAS les siennes (journée désignée à un
   * autre formateur) : jamais payées, le reste du mois l'est.
   */
  | "signee_hors_prevu"
  /** V2-A-2 — intervenant d'un organisme : rien à son nom, à traiter à la main. */
  | "intervenant_organisme";

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
 * n'est jamais touchée (elle appartient au relevé mensuel), sauf à cheval sur la
 * bascule à prix figé (`appartientAuPassage`, V1-C-2).
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
    if (!appartientAuPassage(c, dateBascule)) continue;
    const toutesSignees = demiJourneesSignees(c.contresignatures);
    if (toutesSignees.length === 0) continue;
    if (c.intervenantOrganisme === true) {
      anomalies.push({
        trainerId: c.trainerId,
        sessionId: c.sessionId,
        motif: "intervenant_organisme",
      });
      continue;
    }
    if (c.conditions === null) {
      anomalies.push({
        trainerId: c.trainerId,
        sessionId: c.sessionId,
        motif: "conditions_absentes",
      });
      continue;
    }
    const conditions = c.conditions;
    const prevues = demiJourneesPrevuesDuCandidat(c, bornes);
    const prevuesParMois = new Map(parMoisCivil(prevues).map((m) => [m.mois, m] as const));
    // V2-A-1 : dans un mois qui compte des journées à lui, seules SES demi-journées
    // signées sont payées. Une journée désignée à un autre (co-animation) que ce
    // formateur aurait aussi contresignée n'est jamais payée deux fois.
    const clesPrevues = new Set(prevues.map((d) => `${d.jour}|${d.creneau}`));
    const horsPrevu = toutesSignees.filter(
      (d) => prevuesParMois.has(d.jour.slice(0, 7)) && !clesPrevues.has(`${d.jour}|${d.creneau}`),
    );
    if (horsPrevu.length > 0) {
      anomalies.push({
        trainerId: c.trainerId,
        sessionId: c.sessionId,
        motif: "signee_hors_prevu",
      });
    }
    const signees = toutesSignees.filter((d) => !horsPrevu.includes(d));
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
    // V2-A-3 : les demi-journées des mois précédents, signées et prévues, pour que le
    // reliquat d'un tarif impair ne se perde pas entre deux mois.
    const signeesAvant = (m: string) => signees.filter((d) => d.jour.slice(0, 7) < m).length;
    const prevuesAvant = (m: string) => prevues.filter((d) => d.jour.slice(0, 7) < m).length;
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
        // Session annulée : aucun bilan n'aura lieu (le service le refuse), on ne l'attend pas.
        bilan:
          mois.mois === dernierMoisPrevu && c.sessionAnnulee !== true
            ? (c.bilanFinFormation ?? null)
            : null,
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
        releve = calculerReleveDuMois(mois, conditions, p, signeesAvant(mois.mois));
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
        sansEcart: releveSansEcart(releve, prevuDuMois, conditions, p, prevuesAvant(mois.mois)),
        prevuHtCents: montantPrevuDuMoisHtCents(
          prevuDuMois,
          conditions,
          p,
          prevuesAvant(mois.mois),
        ),
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
