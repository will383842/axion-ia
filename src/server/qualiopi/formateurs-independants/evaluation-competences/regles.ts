/**
 * Formateurs indépendants — RÈGLES de l'évaluation des compétences pédagogiques
 * (Qualiopi ind. 21, non-conformité majeure de l'audit du 16/10).
 *
 * Trois grilles et une case, versées en AJOUT SEUL depuis la fiche console :
 *   (a) l'entretien noté — cinq critères de 1 à 5 ;
 *   (b) la mise en situation — blocs B1 à B4 sur 5 ;
 *   (c) la décision d'habilitation, PAR FORMATION, toujours motivée ;
 *   et la formation à la méthode, cochée « suivie » à une date.
 *
 * Rien ne se modifie ni ne se supprime : une nouvelle ligne remplace la précédente pour la
 * lecture (la DERNIÈRE versée décide), l'ancienne reste au registre.
 *
 * Les critères viennent de `configuration.ts`, les seuils de `reglages.ts` : aucun nombre
 * en dur ici. L'outil dit si les seuils sont atteints et refuse « habilité » quand ils ne
 * le sont pas ; la décision reste humaine.
 *
 * 🔴 Garde FERMÉE : grille illisible = seuils non atteints ; lignes non lues = tout manque.
 *
 * Module PUR : aucune base, aucune horloge implicite.
 */

import {
  BLOCS_MISE_EN_SITUATION,
  CRITERES_ENTRETIEN,
  DECISIONS_EN_VIGUEUR,
  LIBELLES_DECISION,
  MOTIF_MAX,
  NOTE_MAX,
  NOTE_MIN,
  estDecisionHabilitation,
  type CritereGrille,
  type DecisionHabilitation,
} from "./configuration";
import { REGLAGES_EVALUATION, type ReglagesEvaluation } from "./reglages";

export const NATURES_EVALUATION = [
  "entretien",
  "mise_en_situation",
  "decision_habilitation",
  "formation_methode",
] as const;

export type NatureEvaluation = (typeof NATURES_EVALUATION)[number];
export type NatureGrilleNotee = "entretien" | "mise_en_situation";

/** Une ligne versée, telle que les règles la lisent. */
export interface LigneEvaluationLue {
  readonly id: string;
  readonly nature: NatureEvaluation | string;
  readonly formationId: string | null;
  readonly notes: unknown;
  readonly decision: string | null;
  readonly motif: string | null;
  readonly dateSuivie: Date | null;
  readonly version: number;
  readonly createdAt: Date;
}

export type Notes = Readonly<Record<string, number>>;

export const MANQUES_EVALUATION = {
  entretien: "L'entretien noté du formateur n'est pas versé (Qualiopi, indicateur 21).",
  miseEnSituation: "La mise en situation du formateur n'est pas versée (Qualiopi, indicateur 21).",
  decision:
    "Aucune formation n'a de décision « habilité » ou « habilité avec réserve » en vigueur (Qualiopi, indicateur 21).",
  formationMethode: "La formation à la méthode n'est pas cochée comme suivie.",
} as const;

export const MANQUE_MISSION_HABILITATION =
  "Le formateur n'a pas de décision d'habilitation en vigueur (« habilité » ou « avec réserve ») pour la formation de cette mission.";
export const MANQUE_MISSION_FORMATION_INCONNUE =
  "La formation de cette mission n'est pas connue : la décision d'habilitation ne peut pas être vérifiée.";

function criteresDe(nature: NatureGrilleNotee): ReadonlyArray<CritereGrille> {
  return nature === "entretien" ? CRITERES_ENTRETIEN : BLOCS_MISE_EN_SITUATION;
}

export type ResultatNotes =
  { readonly ok: true; readonly notes: Notes } | { readonly ok: false; readonly message: string };

/**
 * Une grille notée est-elle complète ? Chaque critère de la configuration, et lui seul,
 * porte une note ENTIÈRE de 1 à 5. Une grille vierge ou partielle est refusée.
 */
export function validerNotes(nature: NatureGrilleNotee, brut: unknown): ResultatNotes {
  const criteres = criteresDe(nature);
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) {
    return { ok: false, message: "Grille vierge : notez chaque critère avant de la verser." };
  }
  const entree = brut as Record<string, unknown>;
  const codes = new Set(criteres.map((c) => c.code));
  if (Object.keys(entree).some((k) => !codes.has(k))) {
    return { ok: false, message: "La grille porte un critère inconnu." };
  }
  const notes: Record<string, number> = {};
  for (const c of criteres) {
    const v = entree[c.code];
    if (typeof v !== "number" || !Number.isInteger(v) || v < NOTE_MIN || v > NOTE_MAX) {
      return {
        ok: false,
        message: `Grille incomplète : « ${c.libelle} » doit être noté de ${NOTE_MIN} à ${NOTE_MAX}.`,
      };
    }
    notes[c.code] = v;
  }
  return { ok: true, notes };
}

export interface SeuilsEntretien {
  readonly atteint: boolean;
  /** `null` si la grille est illisible. */
  readonly moyenne: number | null;
  readonly criteresSousMinimum: ReadonlyArray<string>;
}

export function seuilsEntretien(
  brut: unknown,
  reglages: ReglagesEvaluation = REGLAGES_EVALUATION,
): SeuilsEntretien {
  const v = validerNotes("entretien", brut);
  if (!v.ok) return { atteint: false, moyenne: null, criteresSousMinimum: [] };
  const valeurs = CRITERES_ENTRETIEN.map((c) => v.notes[c.code]!);
  const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
  const criteresSousMinimum = CRITERES_ENTRETIEN.filter(
    (c) => v.notes[c.code]! < reglages.entretienNoteCritereMin,
  ).map((c) => c.code);
  return {
    atteint: moyenne >= reglages.entretienMoyenneMin && criteresSousMinimum.length === 0,
    moyenne,
    criteresSousMinimum,
  };
}

export interface SeuilsMiseEnSituation {
  readonly atteint: boolean;
  readonly lisible: boolean;
  readonly blocsSousMinimum: ReadonlyArray<string>;
}

export function seuilsMiseEnSituation(
  brut: unknown,
  reglages: ReglagesEvaluation = REGLAGES_EVALUATION,
): SeuilsMiseEnSituation {
  const v = validerNotes("mise_en_situation", brut);
  if (!v.ok) return { atteint: false, lisible: false, blocsSousMinimum: [] };
  const blocsSousMinimum = BLOCS_MISE_EN_SITUATION.filter(
    (b) => v.notes[b.code]! < reglages.miseEnSituationNoteBlocMin,
  ).map((b) => b.code);
  return { atteint: blocsSousMinimum.length === 0, lisible: true, blocsSousMinimum };
}

function derniere(
  lignes: ReadonlyArray<LigneEvaluationLue>,
  filtre: (l: LigneEvaluationLue) => boolean,
): LigneEvaluationLue | null {
  let d: LigneEvaluationLue | null = null;
  for (const l of lignes) {
    if (!filtre(l)) continue;
    if (d === null || l.createdAt.getTime() > d.createdAt.getTime()) d = l;
  }
  return d;
}

export interface EtatEvaluation {
  readonly entretien: LigneEvaluationLue | null;
  readonly miseEnSituation: LigneEvaluationLue | null;
  readonly formationMethode: LigneEvaluationLue | null;
  /** La DERNIÈRE décision de chaque formation. */
  readonly decisions: ReadonlyMap<string, LigneEvaluationLue>;
  /** Formations dont la dernière décision est « habilité » ou « avec réserve ». */
  readonly formationsHabilitees: ReadonlyArray<string>;
}

export function etatEvaluation(lignes: ReadonlyArray<LigneEvaluationLue>): EtatEvaluation {
  const decisions = new Map<string, LigneEvaluationLue>();
  for (const l of lignes) {
    if (l.nature !== "decision_habilitation" || l.formationId === null) continue;
    const prec = decisions.get(l.formationId);
    if (prec === undefined || l.createdAt.getTime() > prec.createdAt.getTime()) {
      decisions.set(l.formationId, l);
    }
  }
  const formationsHabilitees = [...decisions.entries()]
    .filter(([, l]) => estDecisionHabilitation(l.decision) && DECISIONS_EN_VIGUEUR.has(l.decision))
    .map(([f]) => f);
  return {
    entretien: derniere(lignes, (l) => l.nature === "entretien"),
    miseEnSituation: derniere(lignes, (l) => l.nature === "mise_en_situation"),
    formationMethode: derniere(
      lignes,
      (l) =>
        l.nature === "formation_methode" &&
        l.dateSuivie instanceof Date &&
        !Number.isNaN(l.dateSuivie.getTime()),
    ),
    decisions,
    formationsHabilitees,
  };
}

/** La formation a-t-elle une décision d'habilitation EN VIGUEUR (la dernière versée) ? */
export function decisionEnVigueur(
  lignes: ReadonlyArray<LigneEvaluationLue>,
  formationId: string,
): boolean {
  return etatEvaluation(lignes).formationsHabilitees.includes(formationId);
}

export type ResultatDecision =
  | {
      readonly ok: true;
      readonly decision: DecisionHabilitation;
      readonly motif: string;
      readonly entretienId: string;
      readonly miseEnSituationId: string | null;
    }
  | { readonly ok: false; readonly message: string };

/**
 * Une décision d'habilitation peut-elle être versée ? Motif toujours obligatoire ; un
 * entretien versé toujours exigé ; « habilité » et « avec réserve » exigent aussi la mise
 * en situation ; « habilité » exige que les DERNIÈRES grilles atteignent les seuils.
 */
export function validerDecision(input: {
  readonly decision: unknown;
  readonly motif: unknown;
  readonly lignes: ReadonlyArray<LigneEvaluationLue>;
  readonly reglages?: ReglagesEvaluation;
}): ResultatDecision {
  const reglages = input.reglages ?? REGLAGES_EVALUATION;
  if (!estDecisionHabilitation(input.decision)) {
    return { ok: false, message: "Choisissez une décision." };
  }
  const decision = input.decision;
  const motif = typeof input.motif === "string" ? input.motif.trim() : "";
  if (motif === "") return { ok: false, message: "Le motif de la décision est obligatoire." };
  if (motif.length > MOTIF_MAX) {
    return { ok: false, message: `Le motif dépasse ${MOTIF_MAX} caractères.` };
  }
  const etat = etatEvaluation(input.lignes);
  if (etat.entretien === null) {
    return { ok: false, message: "Versez d'abord l'entretien noté." };
  }
  const exigeMes = DECISIONS_EN_VIGUEUR.has(decision);
  if (exigeMes && etat.miseEnSituation === null) {
    return {
      ok: false,
      message: `« ${LIBELLES_DECISION[decision]} » exige une mise en situation versée.`,
    };
  }
  if (decision === "habilite") {
    const e = seuilsEntretien(etat.entretien.notes, reglages);
    const m = seuilsMiseEnSituation(etat.miseEnSituation?.notes ?? null, reglages);
    if (!e.atteint || !m.atteint) {
      return {
        ok: false,
        message:
          "« Habilité » refusé : les seuils ne sont pas atteints " +
          `(entretien : moyenne ≥ ${reglages.entretienMoyenneMin} et aucun critère < ${reglages.entretienNoteCritereMin} ; ` +
          `mise en situation : chaque bloc ≥ ${reglages.miseEnSituationNoteBlocMin}/5). ` +
          "Choisissez « avec réserve », « 2e essai » ou « non habilité », avec un motif.",
      };
    }
  }
  return {
    ok: true,
    decision,
    motif,
    entretienId: etat.entretien.id,
    miseEnSituationId: etat.miseEnSituation?.id ?? null,
  };
}

export type ResultatFormationMethode =
  | { readonly ok: true; readonly dateSuivie: Date }
  | { readonly ok: false; readonly message: string };

/** « Formation à la méthode suivie le … » : jour AAAA-MM-JJ, réel, pas dans le futur. */
export function validerFormationMethode(jour: unknown, maintenant: Date): ResultatFormationMethode {
  const m = typeof jour === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour.trim()) : null;
  if (!m) return { ok: false, message: "Indiquez la date à laquelle la formation a été suivie." };
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, mo - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) {
    return { ok: false, message: "Date illisible." };
  }
  if (d.getTime() > maintenant.getTime()) {
    return { ok: false, message: "La date ne peut pas être dans le futur." };
  }
  return { ok: true, dateSuivie: d };
}

/**
 * Ce qui manque à l'ACTIVATION d'un indépendant, côté compétences pédagogiques.
 * `undefined` (lignes non lues) : tout manque.
 */
export function manquesEvaluationActivation(
  lignes: ReadonlyArray<LigneEvaluationLue> | undefined,
): string[] {
  const etat = etatEvaluation(lignes ?? []);
  const manques: string[] = [];
  if (etat.entretien === null) manques.push(MANQUES_EVALUATION.entretien);
  if (etat.miseEnSituation === null) manques.push(MANQUES_EVALUATION.miseEnSituation);
  if (etat.formationsHabilitees.length === 0) manques.push(MANQUES_EVALUATION.decision);
  if (etat.formationMethode === null) manques.push(MANQUES_EVALUATION.formationMethode);
  return manques;
}
