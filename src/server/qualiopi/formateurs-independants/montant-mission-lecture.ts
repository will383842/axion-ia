/**
 * Formateurs indépendants — LECTURE du montant HT d'une mission en jeu (étape 3 du C4).
 * La règle vit dans `montant-mission.ts` (pure) ; ici, la base seulement.
 *
 * 🔴 Garde FERMÉE : une lecture en échec rend `null`, que la garde lit « attestation
 * exigée ». Aucun montant n'est journalisé.
 *
 * Module neutre (Prisma seulement) : lu par les actions de la console ET par le worker.
 */

import { prisma } from "@/lib/prisma";

import { montantMissionHtCents } from "./montant-mission";

/** La mission dont on décide : une session existante, ou une session pas encore créée. */
export type MissionEnJeu =
  | {
      readonly sessionId: string;
      /** La mission précise (acceptation, lettre) : ses conditions figées priment. */
      readonly missionId?: string;
    }
  | {
      /** Création de session : rien n'est encore en base. */
      readonly nouvelleSession: {
        readonly debut: Date;
        readonly fin: Date | null;
        readonly distanciel: boolean;
      };
    };

async function tarifFiche(trainerId: string): Promise<number | null> {
  const t = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { tarifJourneeHtCents: true },
  });
  return t?.tarifJourneeHtCents ?? null;
}

/** Montant HT (centimes) de la mission en jeu pour ce formateur ; `null` si illisible. */
export async function lireMontantMissionHtCents(
  trainerId: string,
  enJeu: MissionEnJeu,
): Promise<number | null> {
  try {
    if ("nouvelleSession" in enJeu) {
      const n = enJeu.nouvelleSession;
      return montantMissionHtCents({
        trainerId,
        affectes: [],
        distanciel: n.distanciel,
        jours: [],
        tarifFigeHtCents: null,
        forfaitFigeHtCents: null,
        tarifFicheHtCents: await tarifFiche(trainerId),
        repli: { debut: n.debut, fin: n.fin },
      });
    }
    const [session, missions, choix, fiche] = await Promise.all([
      prisma.trainingSession.findUnique({
        where: { id: enJeu.sessionId },
        select: {
          lieuType: true,
          dateDebut: true,
          dateFin: true,
          jours: { select: { date: true, heureDebut: true, heureFin: true, trainerId: true } },
          sessionFormateurs: { select: { trainerId: true } },
        },
      }),
      // Les conditions FIGÉES de la mission (celles que la lettre et le paiement lisent) :
      // la mission désignée, sinon la plus récente de ce couple qui en porte.
      prisma.missionFormateur.findMany({
        where: {
          sessionId: enJeu.sessionId,
          trainerId,
          ...(enJeu.missionId !== undefined
            ? { id: enJeu.missionId }
            : { tarifHtCents: { not: null } }),
        },
        orderBy: { solliciteAt: "desc" },
        take: 1,
        select: { tarifHtCents: true, forfaitDeplacementParJourHtCents: true },
      }),
      // À défaut, celles figées au choix (cartes), que la proposition recopiera.
      prisma.choixFormateurSession.findUnique({
        where: { sessionId_trainerId: { sessionId: enJeu.sessionId, trainerId } },
        select: { tarifHtCents: true, forfaitDeplacementParJourHtCents: true, sauteAt: true },
      }),
      tarifFiche(trainerId),
    ]);
    if (session === null) return null;
    const mission = missions[0] ?? null;
    const figees =
      mission !== null && mission.tarifHtCents !== null
        ? mission
        : choix !== null && choix.sauteAt === null && choix.tarifHtCents !== null
          ? choix
          : null;
    return montantMissionHtCents({
      trainerId,
      affectes: session.sessionFormateurs,
      distanciel: session.lieuType === "distanciel",
      jours: session.jours,
      tarifFigeHtCents: figees?.tarifHtCents ?? null,
      forfaitFigeHtCents: figees?.forfaitDeplacementParJourHtCents ?? null,
      tarifFicheHtCents: fiche,
      repli: { debut: session.dateDebut, fin: session.dateFin },
    });
  } catch {
    return null;
  }
}
