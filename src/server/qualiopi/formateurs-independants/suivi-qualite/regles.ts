/**
 * Formateurs indépendants — SUIVI DE LA QUALITÉ PÉDAGOGIQUE des intervenants externes
 * (Qualiopi ind. 21, NC majeure) : les règles PURES.
 *
 * Quatre suivis, tous derrière l'interrupteur `formateurs.suivi_qualite` (éteint) :
 *   1. l'OBSERVATION de la 1re mission : l'habilitation n'est CONFIRMÉE que par une
 *      observation dont la moyenne atteint le seuil ; tant qu'elle manque, une 2e mission
 *      est refusée par la garde de mission ;
 *   2. la grille APRÈS CHAQUE MISSION (relance interne, puis alerte) et la SATISFACTION
 *      des stagiaires (entretien à prévoir, puis suspension des nouvelles missions jusqu'à
 *      une décision motivée) ;
 *   3. la RÉÉVALUATION ANNUELLE (rappel, puis refus à l'échéance) ;
 *   4. le CV déclaré de plus de 24 mois (#1551).
 *
 * 🔑 Jamais rétroactif : seules comptent les missions qui COMMENCENT le jour de
 * l'allumage ou après, et une échéance de réévaluation déjà dépassée est reportée.
 * 🔑 Seuils et délais : RÉGLÉS en console, passés en dernier paramètre par les lecteurs
 * (`reglages-lecture.ts`) ; à défaut, les défauts de `reglages.ts`, nulle part ailleurs.
 *
 * Module neutre (ni `server-only`, ni Next, ni Prisma) : le worker le lit.
 */

import { addMonths } from "@/server/qualiopi/trainers/conformite";

import { ajouterJours, jourParis, joursEntre, type JourCivil } from "../argent/dates";
import {
  GRILLES_SUIVI_QUALITE,
  REGLAGES_SUIVI_QUALITE,
  type ReglagesSuiviQualite,
  type TypeGrilleSuivi,
} from "./reglages";

const DEFAUTS = REGLAGES_SUIVI_QUALITE;

// ─────────────────────────────────────────────────────────────────────────────
// Les grilles : validation à la saisie
// ─────────────────────────────────────────────────────────────────────────────

export interface SaisieGrille {
  /** Note de chaque critère de la version en cours, par code. */
  readonly notes: Readonly<Record<string, number | undefined>>;
  readonly conclusion: string;
  /** Date de l'observation ou de l'évaluation. */
  readonly date: Date;
  /** Observation seulement : qui a observé. */
  readonly observateur?: string;
  /** Grille après mission seulement : satisfaction saisie (1 à 5), à défaut de questionnaires. */
  readonly satisfaction?: number | null;
  readonly maintenant: Date;
}

export type ErreurGrille =
  | "vierge"
  | "critere_manquant"
  | "note_invalide"
  | "observateur_manquant"
  | "conclusion_trop_courte"
  | "date_invalide"
  | "satisfaction_invalide";

export interface CritereNote {
  readonly code: string;
  readonly libelle: string;
  readonly note: number;
}

export type VerdictGrille =
  | {
      readonly ok: true;
      readonly version: number;
      /** Critères FIGÉS avec leur libellé : la grille se relit telle qu'elle a été saisie. */
      readonly criteres: ReadonlyArray<CritereNote>;
      readonly moyenneCentiemes: number;
      readonly favorable: boolean;
    }
  | { readonly ok: false; readonly erreur: ErreurGrille };

const estNote = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;

/** Seuil de la grille, en centièmes : la moyenne est comparée sans flottant. */
function seuilCentiemes(type: TypeGrilleSuivi, R: ReglagesSuiviQualite): number {
  const s =
    type === "observation"
      ? R.observationMoyenneMin
      : type === "reevaluation"
        ? R.reevaluationMoyenneMin
        : R.evaluationMoyenneMin;
  return Math.round(s * 100);
}

/** Une grille vierge ou incomplète est refusée ; complète, elle rend ce qui sera écrit. */
export function validerGrille(
  type: TypeGrilleSuivi,
  s: SaisieGrille,
  R: ReglagesSuiviQualite = DEFAUTS,
): VerdictGrille {
  const modele = GRILLES_SUIVI_QUALITE[type];
  const valeurs = Object.values(s.notes).filter((v) => v !== undefined);
  if (valeurs.length === 0 && s.conclusion.trim() === "") return { ok: false, erreur: "vierge" };
  const criteres: CritereNote[] = [];
  for (const c of modele.criteres) {
    const v = s.notes[c.code];
    if (v === undefined) return { ok: false, erreur: "critere_manquant" };
    if (!estNote(v)) return { ok: false, erreur: "note_invalide" };
    criteres.push({ code: c.code, libelle: c.libelle, note: v });
  }
  if (type === "observation" && (s.observateur ?? "").trim() === "") {
    return { ok: false, erreur: "observateur_manquant" };
  }
  if (s.conclusion.trim().length < R.texteMinCaracteres) {
    return { ok: false, erreur: "conclusion_trop_courte" };
  }
  if (Number.isNaN(s.date.getTime()) || s.date.getTime() > s.maintenant.getTime()) {
    return { ok: false, erreur: "date_invalide" };
  }
  if (s.satisfaction !== undefined && s.satisfaction !== null && !estNote(s.satisfaction)) {
    return { ok: false, erreur: "satisfaction_invalide" };
  }
  const somme = criteres.reduce((a, c) => a + c.note, 0);
  const moyenneCentiemes = Math.round((somme * 100) / criteres.length);
  return {
    ok: true,
    version: modele.version,
    criteres,
    moyenneCentiemes,
    favorable: moyenneCentiemes >= seuilCentiemes(type, R),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Les faits d'un formateur
// ─────────────────────────────────────────────────────────────────────────────

/** Une mission (session affectée) du formateur. */
export interface MissionLue {
  readonly sessionId: string;
  /** Premier et dernier jour (Paris). */
  readonly debut: JourCivil;
  readonly fin: JourCivil;
  /** Session annulée ou reportée : ce n'est pas une mission réalisée. */
  readonly annulee: boolean;
  /** Satisfaction moyenne des stagiaires (sur 5), ou `null` sans mesure. */
  readonly satisfaction: number | null;
}

export interface GrilleLue {
  readonly sessionId: string | null;
  readonly favorable: boolean;
  readonly creeLe: Date;
}

export interface DecisionLue {
  readonly sessionId: string | null;
  readonly type: "entretien" | "levee_suspension";
  readonly creeLe: Date;
}

export interface FaitsSuiviQualite {
  /** Intervenant externe (sous-traitant) : seul concerné. */
  readonly externe: boolean;
  /** Jour (Paris) d'allumage de `formateurs.suivi_qualite` ; `null` = éteint. */
  readonly allumeLe: JourCivil | null;
  readonly missions: ReadonlyArray<MissionLue>;
  readonly observations: ReadonlyArray<GrilleLue>;
  readonly evaluations: ReadonlyArray<GrilleLue>;
  readonly decisions: ReadonlyArray<DecisionLue>;
  /** Date de la décision d'habilitation qui ouvre l'échéance annuelle, ou `null`. */
  readonly dateDecisionHabilitation: Date | null;
  readonly reevaluations: ReadonlyArray<Pick<GrilleLue, "favorable" | "creeLe">>;
}

const concerne = (
  f: Pick<FaitsSuiviQualite, "externe" | "allumeLe">,
): f is {
  externe: true;
  allumeLe: JourCivil;
} => f.externe && f.allumeLe !== null;

/** Les missions qui comptent : non annulées, commencées le jour de l'allumage ou après. */
export function missionsSuivies(f: FaitsSuiviQualite): MissionLue[] {
  if (!concerne(f)) return [];
  const depuis = f.allumeLe;
  return f.missions
    .filter((m) => !m.annulee && m.debut >= depuis)
    .sort((a, b) =>
      a.debut === b.debut ? a.fin.localeCompare(b.fin) : a.debut.localeCompare(b.debut),
    );
}

function derniere<T extends { creeLe: Date }>(xs: ReadonlyArray<T>): T | null {
  let d: T | null = null;
  for (const x of xs) if (d === null || x.creeLe.getTime() >= d.creeLe.getTime()) d = x;
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. L'observation de la 1re mission
// ─────────────────────────────────────────────────────────────────────────────

export interface EtatObservation {
  readonly premiere: MissionLue | null;
  readonly observation: GrilleLue | null;
  readonly confirmee: boolean;
  readonly alerte: "manquante" | "insuffisante" | null;
}

export function etatObservation(
  f: FaitsSuiviQualite,
  maintenant: Date,
  R: ReglagesSuiviQualite = DEFAUTS,
): EtatObservation {
  const premiere = missionsSuivies(f)[0] ?? null;
  const observation = concerne(f) ? derniere(f.observations) : null;
  const confirmee = observation?.favorable === true;
  let alerte: EtatObservation["alerte"] = null;
  if (observation !== null && !observation.favorable) alerte = "insuffisante";
  else if (
    observation === null &&
    premiere !== null &&
    joursEntre(premiere.fin, jourParis(maintenant)) > R.observationAlerteJours
  ) {
    alerte = "manquante";
  }
  return { premiere, observation, confirmee, alerte };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Après chaque mission : la grille, et la satisfaction
// ─────────────────────────────────────────────────────────────────────────────

/** Relance interne à J+3, alerte à J+7 (réglages), rien une fois la grille saisie. */
export function etatEvaluationMission(
  fin: JourCivil,
  grilleSaisie: boolean,
  maintenant: Date,
  R: ReglagesSuiviQualite = DEFAUTS,
): "relance" | "alerte" | null {
  if (grilleSaisie) return null;
  const j = joursEntre(fin, jourParis(maintenant));
  if (j >= R.evaluationAlerteJours) return "alerte";
  if (j >= R.evaluationRelanceJours) return "relance";
  return null;
}

/** La donnée existante (questionnaires « à chaud ») prime ; à défaut, la note saisie. */
export function satisfactionDeLaMission(
  notesQuestionnaires: ReadonlyArray<number>,
  saisie: number | null,
): number | null {
  if (notesQuestionnaires.length > 0) {
    return notesQuestionnaires.reduce((a, b) => a + b, 0) / notesQuestionnaires.length;
  }
  return saisie;
}

export function niveauSatisfaction(
  m: number | null,
  R: ReglagesSuiviQualite = DEFAUTS,
): "ok" | "entretien" | "suspension" {
  if (m === null) return "ok";
  if (m < R.satisfactionSuspensionSous) return "suspension";
  if (m < R.satisfactionEntretienSous) return "entretien";
  return "ok";
}

/** Les missions dont la satisfaction appelle un geste encore absent. */
export function missionsAReprendre(
  f: FaitsSuiviQualite,
  R: ReglagesSuiviQualite = DEFAUTS,
): {
  entretien: MissionLue[];
  suspension: MissionLue[];
} {
  const entretien: MissionLue[] = [];
  const suspension: MissionLue[] = [];
  for (const m of missionsSuivies(f)) {
    const niveau = niveauSatisfaction(m.satisfaction, R);
    if (niveau === "ok") continue;
    const ds = f.decisions.filter((d) => d.sessionId === m.sessionId);
    const levee = ds.some((d) => d.type === "levee_suspension");
    if (niveau === "suspension" && !levee) suspension.push(m);
    // Une levée motivée vaut entretien ; un entretien seul ne lève pas une suspension.
    if (niveau === "entretien" && ds.length === 0) entretien.push(m);
  }
  return { entretien, suspension };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. La réévaluation annuelle
// ─────────────────────────────────────────────────────────────────────────────

function ajouterMois(jour: JourCivil, n: number): JourCivil {
  const [a, m, j] = jour.split("-").map(Number) as [number, number, number];
  const dernierDuMois = new Date(Date.UTC(a, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + n, Math.min(j, dernierDuMois))).toISOString().slice(0, 10);
}

/** Décision + 12 mois (réglage), jamais avant l'allumage + le délai de grâce (pas de blocage rétroactif). */
export function echeanceReevaluation(
  base: Date,
  allumeLe: JourCivil,
  R: ReglagesSuiviQualite = DEFAUTS,
): JourCivil {
  const e = ajouterMois(jourParis(base), R.reevaluationMois);
  const plancher = ajouterJours(allumeLe, R.reevaluationGraceAllumageJours);
  return e > plancher ? e : plancher;
}

export interface EtatReevaluation {
  readonly echeance: JourCivil | null;
  readonly etat: "sans_objet" | "a_jour" | "rappel" | "echue";
}

export function etatReevaluation(
  f: FaitsSuiviQualite,
  maintenant: Date,
  R: ReglagesSuiviQualite = DEFAUTS,
): EtatReevaluation {
  if (!concerne(f)) return { echeance: null, etat: "sans_objet" };
  const reeval = derniere(f.reevaluations.filter((r) => r.favorable));
  const candidats = [f.dateDecisionHabilitation, reeval?.creeLe ?? null].filter(
    (d): d is Date => d !== null && !Number.isNaN(d.getTime()),
  );
  if (candidats.length === 0) return { echeance: null, etat: "sans_objet" };
  const base = new Date(Math.max(...candidats.map((d) => d.getTime())));
  const echeance = echeanceReevaluation(base, f.allumeLe, R);
  const aujourdhui = jourParis(maintenant);
  if (aujourdhui >= echeance) return { echeance, etat: "echue" };
  if (joursEntre(aujourdhui, echeance) <= R.reevaluationRappelJours) {
    return { echeance, etat: "rappel" };
  }
  return { echeance, etat: "a_jour" };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Le CV déclaré
// ─────────────────────────────────────────────────────────────────────────────

/** CV déclaré depuis plus de 24 mois (réglage). Non déclaré : la règle du dossier joue. */
export function cvDeclarePerime(
  dateCv: Date | null,
  maintenant: Date,
  R: ReglagesSuiviQualite = DEFAUTS,
): boolean {
  if (dateCv === null || Number.isNaN(dateCv.getTime())) return false;
  return addMonths(dateCv, R.cvDeclareMaxMois).getTime() <= maintenant.getTime();
}

// ─────────────────────────────────────────────────────────────────────────────
// Ce que la garde de mission refuse
// ─────────────────────────────────────────────────────────────────────────────

export const MANQUES_SUIVI_QUALITE = {
  observation:
    "L'observation de la première mission n'est pas saisie : l'habilitation n'est pas confirmée, aucune autre mission avant elle.",
  // Sans le nombre : le seuil est un réglage, et ce texte sert de clé (MANQUES_SUIVI_QUALITE_SET).
  observationInsuffisante:
    "L'observation de la première mission est sous le seuil réglé : l'habilitation n'est pas confirmée, aucune autre mission avant une nouvelle observation.",
  suspension:
    "Les nouvelles missions de ce formateur sont suspendues (satisfaction des stagiaires sous le seuil) jusqu'à une décision motivée en console.",
  reevaluation:
    "La réévaluation annuelle de ce formateur est échue : aucune nouvelle mission avant qu'elle soit saisie.",
  erreur: "Le suivi de la qualité de ce formateur n'a pas pu être relu.",
} as const;

/** Ils refusent une NOUVELLE mission ; une mission déjà acceptée est maintenue. */
export const MANQUES_SUIVI_QUALITE_SET: ReadonlySet<string> = new Set(
  Object.values(MANQUES_SUIVI_QUALITE),
);

/**
 * Les manques du suivi qualité pour la mission en jeu. `enJeu.sessionId` : la mission
 * dont on décide ; elle n'est jamais comptée comme « autre mission ».
 */
export function manquesSuiviQualite(
  f: FaitsSuiviQualite,
  enJeu: { readonly sessionId?: string } | undefined,
  maintenant: Date,
  R: ReglagesSuiviQualite = DEFAUTS,
): string[] {
  if (!concerne(f)) return [];
  const manques: string[] = [];
  const suivies = missionsSuivies(f);
  const autres = suivies.filter((m) => m.sessionId !== enJeu?.sessionId);
  const obs = etatObservation(f, maintenant, R);
  if (autres.length > 0 && !obs.confirmee) {
    manques.push(
      obs.observation === null
        ? MANQUES_SUIVI_QUALITE.observation
        : MANQUES_SUIVI_QUALITE.observationInsuffisante,
    );
  }
  if (missionsAReprendre(f, R).suspension.length > 0)
    manques.push(MANQUES_SUIVI_QUALITE.suspension);
  if (etatReevaluation(f, maintenant, R).etat === "echue") {
    manques.push(MANQUES_SUIVI_QUALITE.reevaluation);
  }
  return manques;
}
