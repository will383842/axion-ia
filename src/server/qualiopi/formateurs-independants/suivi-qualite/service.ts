/**
 * Suivi de la qualité pédagogique des intervenants (Qualiopi ind. 21) — ÉCRITURES de la
 * console : une grille (observation, après mission, réévaluation) ou une décision motivée
 * (entretien, reprise après suspension).
 *
 * 🔑 AJOUT SEUL : rien n'est jamais modifié ni supprimé (trigger en base). Une correction
 * est une nouvelle grille, numérotée ; la plus récente fait foi.
 * 🔑 SIGNÉE : l'auteur est l'utilisateur de la console (identifiant + nom relu en base au
 * moment de la saisie), jamais une valeur du formulaire.
 * 🔑 IDOR : la session doit être une mission de CE formateur ; un identifiant inventé ou
 * celui d'une autre session est refusé comme « introuvable ».
 * 🔑 Chaque écriture est tracée au journal, dans la même transaction (sans trace, pas
 * d'acte).
 *
 * Éteint (`formateurs.suivi_qualite`) : tout est refusé.
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";

import { jourParis } from "../argent/dates";
import { lireFaitsSuiviQualite, suiviQualiteAllumeLe } from "./lecture";
import { REGLAGES_SUIVI_QUALITE, type TypeGrilleSuivi } from "./reglages";
import {
  missionsSuspensives,
  niveauSatisfaction,
  satisfactionPlancher,
  validerGrille,
  type ErreurGrille,
} from "./regles";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const MOTIF_MAX_CARACTERES = 2000;

export interface Auteur {
  readonly userId: string;
}

export type IssueSuivi =
  | { readonly ok: true; readonly id: string; readonly numero?: number }
  | {
      readonly ok: false;
      readonly erreur:
        | ErreurGrille
        | "eteint"
        | "non_concerne"
        | "introuvable"
        | "trop_tot"
        | "auteur_inconnu"
        | "motif_invalide"
        | "sans_objet";
    };

const refus = (erreur: Extract<IssueSuivi, { ok: false }>["erreur"]): IssueSuivi => ({
  ok: false,
  erreur,
});

async function nomAuteur(userId: string): Promise<string | null> {
  const u = await prisma.adminUser.findUnique({ where: { id: userId }, select: { name: true } });
  const nom = u?.name?.trim() ?? "";
  return nom === "" ? null : nom.slice(0, 200);
}

/** La session, si et seulement si c'est une mission de CE formateur. */
async function missionDuFormateur(trainerId: string, sessionId: string) {
  return prisma.trainingSession.findFirst({
    where: {
      id: sessionId,
      OR: [{ formateurPrincipalId: trainerId }, { sessionFormateurs: { some: { trainerId } } }],
    },
    select: { id: true, dateDebut: true, dateFin: true, statut: true },
  });
}

async function externe(trainerId: string): Promise<boolean | null> {
  const t = await prisma.trainer.findUnique({ where: { id: trainerId }, select: { statut: true } });
  return t === null ? null : t.statut === "sous_traitant";
}

async function verrouillerFormateur(tx: Tx, trainerId: string): Promise<void> {
  // Deux saisies simultanées ne prennent pas le même numéro.
  await tx.$queryRaw`SELECT id FROM "trainers" WHERE id = ${trainerId}::uuid FOR UPDATE`;
}

export interface SaisieGrilleConsole {
  readonly type: TypeGrilleSuivi;
  readonly trainerId: string;
  /** Obligatoire pour l'observation et la grille après mission ; absent pour la réévaluation. */
  readonly sessionId: string | null;
  readonly notes: Readonly<Record<string, number | undefined>>;
  readonly conclusion: string;
  readonly date: Date;
  readonly observateur?: string;
  readonly satisfaction?: number | null;
  readonly auteur: Auteur;
  readonly maintenant: Date;
}

export async function enregistrerGrille(s: SaisieGrilleConsole): Promise<IssueSuivi> {
  if ((await suiviQualiteAllumeLe()) === null) return refus("eteint");
  const ext = await externe(s.trainerId);
  if (ext === null) return refus("introuvable");
  if (!ext) return refus("non_concerne");

  if (s.type === "reevaluation") {
    if (s.sessionId !== null) return refus("introuvable");
  } else {
    if (s.sessionId === null) return refus("introuvable");
    const m = await missionDuFormateur(s.trainerId, s.sessionId);
    if (m === null) return refus("introuvable");
    if (m.statut === "annulee" || m.statut === "reportee") return refus("non_concerne");
    const aujourdhui = jourParis(s.maintenant);
    // L'observation se fait pendant la mission ; la grille après mission, une fois finie.
    const borne = s.type === "observation" ? jourParis(m.dateDebut) : jourParis(m.dateFin);
    if (aujourdhui < borne) return refus("trop_tot");
  }

  const v = validerGrille(s.type, {
    notes: s.notes,
    conclusion: s.conclusion,
    date: s.date,
    ...(s.observateur !== undefined ? { observateur: s.observateur } : {}),
    ...(s.type === "evaluation_mission" ? { satisfaction: s.satisfaction ?? null } : {}),
    maintenant: s.maintenant,
  });
  if (!v.ok) return refus(v.erreur);
  const auteurNom = await nomAuteur(s.auteur.userId);
  if (auteurNom === null) return refus("auteur_inconnu");

  return prisma.$transaction(async (tx) => {
    await verrouillerFormateur(tx, s.trainerId);
    const deja = await tx.grilleSuiviFormateur.count({
      where: { trainerId: s.trainerId, type: s.type, sessionId: s.sessionId },
    });
    const numero = deja + 1;
    const g = await tx.grilleSuiviFormateur.create({
      data: {
        trainerId: s.trainerId,
        sessionId: s.sessionId,
        type: s.type,
        numero,
        versionGrille: v.version,
        criteres: v.criteres.map((c) => ({ ...c })),
        moyenneCentiemes: v.moyenneCentiemes,
        favorable: v.favorable,
        conclusion: s.conclusion.trim(),
        observateur: s.type === "observation" ? (s.observateur ?? "").trim().slice(0, 200) : null,
        dateEvaluation: s.date,
        satisfactionSaisie: s.type === "evaluation_mission" ? (s.satisfaction ?? null) : null,
        auteurId: s.auteur.userId,
        auteurNom,
      },
      select: { id: true },
    });
    await journaliser(
      tx,
      {
        action: "qualiopi.formateur.suivi_qualite_grille",
        targetType: "GrilleSuiviFormateur",
        targetId: g.id,
        changes: {
          trainerId: s.trainerId,
          sessionId: s.sessionId,
          type: s.type,
          numero,
          versionGrille: v.version,
          moyenneCentiemes: v.moyenneCentiemes,
          favorable: v.favorable,
        },
        session: { userId: s.auteur.userId },
      },
      { exiger: true },
    );
    return { ok: true as const, id: g.id, numero };
  });
}

export interface SaisieDecisionConsole {
  readonly trainerId: string;
  readonly sessionId: string;
  readonly type: "entretien" | "levee_suspension";
  readonly motif: string;
  readonly auteur: Auteur;
  readonly maintenant: Date;
}

/**
 * Une décision motivée sur une mission dont la satisfaction est sous un seuil : un
 * entretien (sous le seuil d'entretien), ou la reprise des nouvelles missions (sous le
 * seuil de suspension). Sans objet ailleurs : on ne « lève » pas ce qui n'est pas suspendu.
 */
export async function enregistrerDecision(d: SaisieDecisionConsole): Promise<IssueSuivi> {
  const allumeLe = await suiviQualiteAllumeLe();
  if (allumeLe === null) return refus("eteint");
  const motif = d.motif.trim();
  if (
    motif.length < REGLAGES_SUIVI_QUALITE.texteMinCaracteres ||
    motif.length > MOTIF_MAX_CARACTERES
  ) {
    return refus("motif_invalide");
  }
  const f = await lireFaitsSuiviQualite(d.trainerId, allumeLe);
  if (!f.trouve) return refus("introuvable");
  if (!f.externe) return refus("non_concerne");
  // La mission doit être une mission de CE formateur (IDOR compris). Une mission annulée ou
  // reportée garde sa suspension : seule la `levee_suspension` y est admise.
  const m = missionsSuspensives(f).find((x) => x.sessionId === d.sessionId);
  if (m === undefined) return refus("introuvable");
  const niveau = niveauSatisfaction(satisfactionPlancher(m));
  if (m.annulee && d.type !== "levee_suspension") return refus("non_concerne");
  if (niveau === "ok" || (d.type === "levee_suspension" && niveau !== "suspension")) {
    return refus("sans_objet");
  }
  const auteurNom = await nomAuteur(d.auteur.userId);
  if (auteurNom === null) return refus("auteur_inconnu");

  return prisma.$transaction(async (tx) => {
    const r = await tx.decisionSuiviFormateur.create({
      data: {
        trainerId: d.trainerId,
        sessionId: d.sessionId,
        type: d.type,
        motif,
        auteurId: d.auteur.userId,
        auteurNom,
      },
      select: { id: true },
    });
    await journaliser(
      tx,
      {
        action: "qualiopi.formateur.suivi_qualite_decision",
        targetType: "DecisionSuiviFormateur",
        targetId: r.id,
        changes: { trainerId: d.trainerId, sessionId: d.sessionId, type: d.type },
        session: { userId: d.auteur.userId },
      },
      { exiger: true },
    );
    return { ok: true as const, id: r.id };
  });
}
