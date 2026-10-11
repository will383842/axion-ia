/**
 * Page « Missions » de la console (lot L11d) — les missions des formateurs
 * indépendants groupées par « qui doit agir ». MÊME calcul que le moteur
 * (`lireEtatMission` → `etapeMission`) : la page ne dit jamais autre chose
 * que ce que le moteur fera.
 *
 * Lecture seule. Ne lève jamais (une mission illisible est omise).
 */

import { prisma } from "@/lib/prisma";
import { STATUTS_ACCORD_DONNE } from "@/server/qualiopi/trainers/mission-formateur";

import { nomCourt } from "./choix-formateur";
import { ETAPES_MISSION, type EtapeMission, type QuiAgit } from "./etape-mission";
import { lireEtatMission } from "./moteur-mission";

export interface LigneMission {
  readonly missionId: string;
  readonly sessionId: string;
  readonly numero: string;
  readonly intitule: string;
  readonly dateDebut: Date;
  readonly formateur: string;
  readonly etape: EtapeMission;
  readonly libelle: string;
  readonly quiAgit: QuiAgit;
}

/** Au plus 200 missions lues : la page n'est pas un registre. */
export const MISSIONS_LUES_MAX = 200;

export async function lireMissionsConsole(maintenant: Date): Promise<ReadonlyArray<LigneMission>> {
  let ids: Array<{ id: string }>;
  try {
    ids = await prisma.missionFormateur.findMany({
      where: {
        role: "principal",
        statut: { in: ["en_attente", ...STATUTS_ACCORD_DONNE] },
        trainer: { statut: "sous_traitant", organismeSousTraitantId: null },
        session: { statut: { in: ["planifiee", "en_cours"] } },
      },
      orderBy: { session: { dateDebut: "asc" } },
      select: { id: true },
      take: MISSIONS_LUES_MAX,
    });
  } catch {
    return [];
  }
  const lignes: LigneMission[] = [];
  for (const { id } of ids) {
    try {
      const e = await lireEtatMission(id, maintenant);
      if (e === null || e.etape === "close") continue;
      const m = e.mission;
      lignes.push({
        missionId: m.id,
        sessionId: m.sessionId,
        numero: m.session.numero,
        intitule: m.session.titreSession,
        dateDebut: m.session.dateDebut,
        formateur: nomCourt(m.trainer.prenom, m.trainer.nom),
        etape: e.etape,
        libelle: ETAPES_MISSION[e.etape].libelle,
        quiAgit: ETAPES_MISSION[e.etape].quiAgit,
      });
    } catch {
      // Une mission illisible n'empêche pas les autres de s'afficher.
    }
  }
  return lignes;
}
