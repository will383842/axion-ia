/**
 * Suivi de la qualité pédagogique des intervenants (Qualiopi ind. 21) — LECTURE des faits
 * d'un formateur en base, pour les règles pures (`regles.ts`).
 *
 * Module NEUTRE (Prisma seulement, ni `server-only` ni Next) : la garde de mission, que le
 * worker charge, et l'évaluateur d'alertes le lisent.
 *
 * 🔑 Interrupteur `formateurs.suivi_qualite` : ligne ABSENTE ou arrêtée = éteint, rien
 * n'est lu. Allumé, une lecture qui échoue est rendue telle quelle à l'appelant (la garde
 * refuse, l'évaluateur compte la règle en échec) : jamais un « tout va bien » par défaut.
 */

import { prisma } from "@/lib/prisma";

import { jourParis, type JourCivil } from "../argent/dates";
import { cleSettingSignature, dateAllumageSignature } from "../interrupteurs";
import { satisfactionDeLaMission, type FaitsSuiviQualite, type MissionLue } from "./regles";

export const CLE_SUIVI_QUALITE = cleSettingSignature("suivi_qualite");

/** Jour (Paris) d'allumage de `formateurs.suivi_qualite`, ou `null` (éteint). Peut lever. */
export async function lireAllumageSuiviQualite(): Promise<JourCivil | null> {
  const ligne = await prisma.setting.findUnique({
    where: { key: CLE_SUIVI_QUALITE },
    select: { value: true, updatedAt: true },
  });
  if (ligne == null) return null;
  const d = dateAllumageSignature(ligne.value, ligne.updatedAt ?? null);
  return d === null ? null : jourParis(d);
}

/** Même lecture, sans jamais lever : un échec vaut « éteint » (écrans, saisie). */
export async function suiviQualiteAllumeLe(): Promise<JourCivil | null> {
  try {
    return await lireAllumageSuiviQualite();
  } catch {
    return null;
  }
}

const SELECT_SESSION = {
  id: true,
  dateDebut: true,
  dateFin: true,
  statut: true,
  enrollments: {
    select: {
      questionnaires: {
        where: { type: "satisfaction_chaud", reponduAt: { not: null }, noteGlobale: { not: null } },
        select: { noteGlobale: true },
      },
    },
  },
} as const;

/**
 * 🔑 Le point de jonction avec la « décision d'habilitation » : aujourd'hui, la plus
 * ANCIENNE habilitation encore active du formateur (`TrainerHabilitation.habiliteAt`,
 * qui porte l'auteur et la date). Une réévaluation favorable relance l'année pour toutes.
 * Si une décision d'habilitation datée vient à exister ailleurs, c'est ici qu'on la lit.
 */
function dateDecisionHabilitation(habilitations: ReadonlyArray<{ habiliteAt: Date }>): Date | null {
  let d: Date | null = null;
  for (const h of habilitations) if (d === null || h.habiliteAt < d) d = h.habiliteAt;
  return d;
}

/** Les faits d'UN formateur. `allumeLe` est celui lu par l'appelant (une seule lecture). */
export async function lireFaitsSuiviQualite(
  trainerId: string,
  allumeLe: JourCivil | null,
): Promise<FaitsSuiviQualite & { readonly trouve: boolean }> {
  const t = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      statut: true,
      habilitations: { where: { retireAt: null }, select: { habiliteAt: true } },
      grillesSuiviQualite: {
        select: {
          type: true,
          sessionId: true,
          favorable: true,
          satisfactionSaisie: true,
          createdAt: true,
        },
      },
      decisionsSuiviQualite: { select: { type: true, sessionId: true, createdAt: true } },
    },
  });
  const vide: FaitsSuiviQualite = {
    externe: false,
    allumeLe,
    missions: [],
    observations: [],
    evaluations: [],
    decisions: [],
    dateDecisionHabilitation: null,
    reevaluations: [],
  };
  if (t === null) return { ...vide, trouve: false };
  const externe = t.statut === "sous_traitant";
  if (!externe || allumeLe === null) return { ...vide, externe, trouve: true };

  const sessions = await prisma.trainingSession.findMany({
    where: {
      OR: [{ formateurPrincipalId: trainerId }, { sessionFormateurs: { some: { trainerId } } }],
      // Jamais rétroactif : seules les missions commencées le jour de l'allumage ou après.
      dateFin: { gte: new Date(`${allumeLe}T00:00:00Z`) },
    },
    select: SELECT_SESSION,
  });

  const grilles = t.grillesSuiviQualite;
  const saisieDe = (sessionId: string): number | null => {
    let d: { satisfactionSaisie: number | null; createdAt: Date } | null = null;
    for (const g of grilles) {
      if (g.type !== "evaluation_mission" || g.sessionId !== sessionId) continue;
      if (d === null || g.createdAt >= d.createdAt) d = g;
    }
    return d?.satisfactionSaisie ?? null;
  };

  const missions: MissionLue[] = sessions.map((s) => ({
    sessionId: s.id,
    debut: jourParis(s.dateDebut),
    fin: jourParis(s.dateFin),
    annulee: s.statut === "annulee" || s.statut === "reportee",
    satisfaction: satisfactionDeLaMission(
      s.enrollments.flatMap((e) =>
        e.questionnaires.map((q) => q.noteGlobale).filter((n): n is number => n !== null),
      ),
      saisieDe(s.id),
    ),
  }));

  const lue = (g: (typeof grilles)[number]) => ({
    sessionId: g.sessionId,
    favorable: g.favorable,
    creeLe: g.createdAt,
  });
  return {
    trouve: true,
    externe,
    allumeLe,
    missions,
    observations: grilles.filter((g) => g.type === "observation").map(lue),
    evaluations: grilles.filter((g) => g.type === "evaluation_mission").map(lue),
    reevaluations: grilles.filter((g) => g.type === "reevaluation").map(lue),
    decisions: t.decisionsSuiviQualite.map((d) => ({
      sessionId: d.sessionId,
      type: d.type,
      creeLe: d.createdAt,
    })),
    dateDecisionHabilitation: dateDecisionHabilitation(t.habilitations),
  };
}
