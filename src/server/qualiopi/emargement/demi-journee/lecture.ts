/**
 * Chantier QNC, lot L06 — lectures en base du lot. Aucune décision ici : ce
 * qui est ouvert, fermé ou dû se décide dans `fenetre.ts`.
 *
 * ⚠️ Atteint par le WORKER (rappel au début de chaque demi-journée) : aucun
 * import Next, `server-only` ni Server Action.
 */

import { prisma } from "@/lib/prisma";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import type { DemiJourneeLabel } from "@/server/qualiopi/presence/types";
import {
  besoinAdaptationDeclare,
  estReponseAucuneAdaptation,
  reponseAdaptationConsignee,
} from "@/server/qualiopi/adaptation/reponse-organisme";
import { colonneDeclarationDisponible } from "@/server/qualiopi/adaptation/colonne-declaration";
import type { DemiJourneePrevue } from "./fenetre";

interface JourDeclare {
  readonly date: Date;
  readonly heureDebut: string;
  readonly heureFin: string;
}

interface CreneauBrut {
  readonly id: string;
  readonly date: Date;
  readonly demiJournee: string;
}

/**
 * Pure : les créneaux d'un inscrit, avec les horaires de leur journée. Un
 * créneau dont la journée n'est pas déclarée est écarté — même règle que la
 * feuille du portail : sans horaires, il n'a pas de fenêtre.
 */
export function demiJourneesDepuis(
  creneaux: ReadonlyArray<CreneauBrut>,
  jours: ReadonlyArray<JourDeclare>,
): DemiJourneePrevue[] {
  const parJour = new Map(jours.map((j) => [parisDateISO(j.date), j] as const));
  return creneaux.flatMap((c) => {
    const date = parisDateISO(c.date);
    const jour = parJour.get(date);
    if (jour === undefined) return [];
    return [
      {
        creneauId: c.id,
        date,
        demiJournee: c.demiJournee as DemiJourneeLabel,
        jourHeureDebut: jour.heureDebut,
        jourHeureFin: jour.heureFin,
      },
    ];
  });
}

/** Les demi-journées prévues d'une inscription. */
export async function lireDemiJourneesInscription(
  enrollmentId: string,
): Promise<DemiJourneePrevue[]> {
  const e = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      presences: { select: { id: true, date: true, demiJournee: true } },
      session: { select: { jours: { select: { date: true, heureDebut: true, heureFin: true } } } },
    },
  });
  if (e === null) return [];
  return demiJourneesDepuis(e.presences, e.session.jours);
}

/**
 * Pure : la personne a-t-elle une ADAPTATION ? Un besoin déclaré (fiche,
 * aménagement, positionnement), ou une adaptation consignée par l'organisme —
 * « aucune adaptation nécessaire » ne compte pas.
 */
export function porteUneAdaptation(i: {
  readonly situationHandicap: boolean;
  readonly besoinAdaptationDeclareAt: Date | null | undefined;
  readonly reponsesPositionnements: readonly unknown[];
  readonly adaptationsRealisees: string | null;
}): boolean {
  if (besoinAdaptationDeclare(i)) return true;
  return (
    reponseAdaptationConsignee(i.adaptationsRealisees) &&
    !estReponseAucuneAdaptation(i.adaptationsRealisees)
  );
}

/**
 * La signature « nom tapé » est-elle ouverte à cette inscription ?
 *
 * 🔴 Ne lit que des booléens et la réponse de l'organisme, jamais le détail
 * déclaré (donnée de santé, RGPD art. 9).
 */
export async function inscriptionPorteUneAdaptation(enrollmentId: string): Promise<boolean> {
  const colonne = await colonneDeclarationDisponible();
  const e = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      adaptationsRealisees: true,
      besoinAdaptationDeclareAt: colonne,
      trainee: { select: { situationHandicap: true } },
      questionnaires: {
        where: { type: "positionnement", reponduAt: { not: null } },
        select: { reponses: true },
      },
    },
  });
  if (e === null) return false;
  return porteUneAdaptation({
    situationHandicap: e.trainee.situationHandicap,
    besoinAdaptationDeclareAt: e.besoinAdaptationDeclareAt ?? null,
    reponsesPositionnements: e.questionnaires.map((q) => q.reponses),
    adaptationsRealisees: e.adaptationsRealisees,
  });
}
