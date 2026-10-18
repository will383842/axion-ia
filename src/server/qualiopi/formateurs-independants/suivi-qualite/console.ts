/**
 * Suivi de la qualité pédagogique des intervenants (Qualiopi ind. 21) — LECTURE pour la
 * console : le dossier de suivi d'un formateur (fiche › Suivi qualité) et les grilles
 * rattachées à une session.
 *
 * Réservé à la console : aucune route de l'espace formateur ne lit ce module (le
 * formateur ne voit jamais les grilles).
 */

import { prisma } from "@/lib/prisma";

import { jourParis, type JourCivil } from "../argent/dates";
import { lireFaitsSuiviQualite, suiviQualiteAllumeLe } from "./lecture";
import type { ReglagesSuiviQualite } from "./reglages";
import { lireReglagesSuiviQualite } from "./reglages-lecture";
import type { CritereNote } from "./regles";
import {
  etatEvaluationMission,
  etatObservation,
  etatReevaluation,
  missionsAReprendre,
  missionsSuivies,
  niveauSatisfaction,
  satisfactionPlancher,
  type EtatObservation,
  type EtatReevaluation,
} from "./regles";

export interface GrilleConsole {
  readonly id: string;
  readonly type: "observation" | "evaluation_mission" | "reevaluation";
  readonly sessionId: string | null;
  readonly sessionNumero: string | null;
  readonly numero: number;
  readonly versionGrille: number;
  readonly criteres: ReadonlyArray<CritereNote>;
  readonly moyenneCentiemes: number;
  readonly favorable: boolean;
  readonly conclusion: string;
  readonly observateur: string | null;
  readonly dateEvaluation: Date;
  readonly satisfactionSaisie: number | null;
  readonly auteurNom: string;
  readonly createdAt: Date;
}

export interface DecisionConsole {
  readonly id: string;
  readonly type: "entretien" | "levee_suspension";
  readonly sessionId: string | null;
  readonly sessionNumero: string | null;
  readonly motif: string;
  readonly auteurNom: string;
  readonly createdAt: Date;
}

export interface MissionConsole {
  readonly sessionId: string;
  readonly numero: string;
  readonly titre: string;
  readonly debut: JourCivil;
  readonly fin: JourCivil;
  readonly finie: boolean;
  readonly evaluationSaisie: boolean;
  readonly evaluation: "relance" | "alerte" | null;
  readonly satisfaction: number | null;
  readonly niveau: "ok" | "entretien" | "suspension";
  readonly decisionPrise: boolean;
  readonly suspensionLevee: boolean;
  /** Mission annulée ou reportée qui garde une suspension (seule la levée motivée s'y applique). */
  readonly annulee: boolean;
  /** Suspendu, note corrigée depuis à la hausse : décision motivée requise. */
  readonly noteCorrigeeDepuis: number | null;
}

export interface EcranSuiviQualite {
  readonly trainerId: string;
  readonly nom: string;
  readonly externe: boolean;
  readonly allumeLe: JourCivil | null;
  readonly observation: EtatObservation | null;
  readonly reevaluation: EtatReevaluation | null;
  readonly missions: ReadonlyArray<MissionConsole>;
  readonly grilles: ReadonlyArray<GrilleConsole>;
  readonly decisions: ReadonlyArray<DecisionConsole>;
  /** Les seuils et délais RÉGLÉS (ou leurs défauts) : ceux que l'écran affiche et applique. */
  readonly reglages: ReglagesSuiviQualite;
}

function criteresLus(brut: unknown): CritereNote[] {
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((c) => {
    if (c === null || typeof c !== "object") return [];
    const o = c as Record<string, unknown>;
    return typeof o.code === "string" && typeof o.libelle === "string" && typeof o.note === "number"
      ? [{ code: o.code, libelle: o.libelle, note: o.note }]
      : [];
  });
}

const SELECT_GRILLE = {
  id: true,
  type: true,
  sessionId: true,
  session: { select: { numero: true } },
  numero: true,
  versionGrille: true,
  criteres: true,
  moyenneCentiemes: true,
  favorable: true,
  conclusion: true,
  observateur: true,
  dateEvaluation: true,
  satisfactionSaisie: true,
  auteurNom: true,
  createdAt: true,
} as const;

type GrilleBrute = {
  id: string;
  type: GrilleConsole["type"];
  sessionId: string | null;
  session: { numero: string } | null;
  numero: number;
  versionGrille: number;
  criteres: unknown;
  moyenneCentiemes: number;
  favorable: boolean;
  conclusion: string;
  observateur: string | null;
  dateEvaluation: Date;
  satisfactionSaisie: number | null;
  auteurNom: string;
  createdAt: Date;
};

const versConsole = (g: GrilleBrute): GrilleConsole => ({
  id: g.id,
  type: g.type,
  sessionId: g.sessionId,
  sessionNumero: g.session?.numero ?? null,
  numero: g.numero,
  versionGrille: g.versionGrille,
  criteres: criteresLus(g.criteres),
  moyenneCentiemes: g.moyenneCentiemes,
  favorable: g.favorable,
  conclusion: g.conclusion,
  observateur: g.observateur,
  dateEvaluation: g.dateEvaluation,
  satisfactionSaisie: g.satisfactionSaisie,
  auteurNom: g.auteurNom,
  createdAt: g.createdAt,
});

/** Le dossier de suivi d'un formateur, ou `null` s'il n'existe pas. */
export async function lireEcranSuiviQualite(
  trainerId: string,
  maintenant: Date,
): Promise<EcranSuiviQualite | null> {
  const t = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { id: true, nom: true, prenom: true, statut: true },
  });
  if (t === null) return null;
  const [allumeLe, reglages] = await Promise.all([
    suiviQualiteAllumeLe(),
    lireReglagesSuiviQualite(),
  ]);
  const externe = t.statut === "sous_traitant";
  const nom = `${t.prenom} ${t.nom}`.trim();
  const [grilles, decisions] = await Promise.all([
    prisma.grilleSuiviFormateur.findMany({
      where: { trainerId },
      orderBy: { createdAt: "desc" },
      select: SELECT_GRILLE,
    }),
    prisma.decisionSuiviFormateur.findMany({
      where: { trainerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        sessionId: true,
        session: { select: { numero: true } },
        motif: true,
        auteurNom: true,
        createdAt: true,
      },
    }),
  ]);
  const base = {
    trainerId,
    nom,
    externe,
    allumeLe,
    reglages,
    grilles: grilles.map(versConsole),
    decisions: decisions.map((d) => ({
      id: d.id,
      type: d.type,
      sessionId: d.sessionId,
      sessionNumero: d.session?.numero ?? null,
      motif: d.motif,
      auteurNom: d.auteurNom,
      createdAt: d.createdAt,
    })),
  };
  if (!externe || allumeLe === null) {
    return { ...base, observation: null, reevaluation: null, missions: [] };
  }

  const f = await lireFaitsSuiviQualite(trainerId, allumeLe);
  const suivies = missionsSuivies(f);
  const infos = await prisma.trainingSession.findMany({
    where: {
      id: {
        in: [...suivies, ...missionsAReprendre(f, reglages).suspension].map((m) => m.sessionId),
      },
    },
    select: { id: true, numero: true, titreSession: true },
  });
  const info = new Map(infos.map((i) => [i.id, i]));
  const aujourdhui = jourParis(maintenant);
  // Les missions annulées ne s'affichent que si elles portent une suspension non levée.
  const annuleesSuspendues = missionsAReprendre(f, reglages).suspension.filter((m) => m.annulee);
  const missions: MissionConsole[] = [...suivies, ...annuleesSuspendues].map((m) => {
    const saisie = f.evaluations.some((e) => e.sessionId === m.sessionId);
    const ds = f.decisions.filter((d) => d.sessionId === m.sessionId);
    const niveau = niveauSatisfaction(satisfactionPlancher(m), reglages);
    const corrigee =
      niveau === "suspension" && niveauSatisfaction(m.satisfaction, reglages) !== "suspension";
    return {
      sessionId: m.sessionId,
      numero: info.get(m.sessionId)?.numero ?? "—",
      titre: info.get(m.sessionId)?.titreSession ?? "",
      debut: m.debut,
      fin: m.fin,
      finie: m.fin <= aujourdhui,
      evaluationSaisie: saisie,
      evaluation:
        m.annulee || m.fin > aujourdhui
          ? null
          : etatEvaluationMission(m.fin, saisie, maintenant, reglages),
      satisfaction: m.satisfaction,
      niveau,
      decisionPrise: ds.length > 0,
      suspensionLevee: ds.some((d) => d.type === "levee_suspension"),
      annulee: m.annulee,
      noteCorrigeeDepuis: corrigee ? m.satisfaction : null,
    };
  });
  return {
    ...base,
    observation: etatObservation(f, maintenant, reglages),
    reevaluation: etatReevaluation(f, maintenant, reglages),
    missions,
  };
}

/** Les grilles rattachées à une session (page de la session), les plus récentes d'abord. */
export async function lireGrillesDeLaSession(
  sessionId: string,
): Promise<Array<GrilleConsole & { readonly trainerId: string; readonly formateur: string }>> {
  const gs = await prisma.grilleSuiviFormateur.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    select: { ...SELECT_GRILLE, trainerId: true, trainer: { select: { nom: true, prenom: true } } },
  });
  return gs.map((g) => ({
    ...versConsole(g),
    trainerId: g.trainerId,
    formateur: `${g.trainer.prenom} ${g.trainer.nom}`.trim(),
  }));
}
