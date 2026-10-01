/**
 * Les sessions RÉALISÉES proposées à l'échantillonnage, depuis le mode auditeur.
 *
 * L'auditrice tire une session et demande son dossier. Le bouton « Dossier
 * d'audit de la session » n'existait que sur la fiche de chaque session : elle
 * devait quitter l'écran de contrôle, chercher la session dans la liste,
 * l'ouvrir, et revenir. La liste courte ci-dessous lui épargne ce détour ; la
 * liste complète reste à l'écran des sessions, et le plafond est DIT.
 *
 * Stub-aware et fail-soft : `null` = illisible (jamais « aucune session »).
 */

import { prisma } from "@/lib/prisma";

/** Nombre de sessions listées sur l'écran du mode auditeur. */
export const NB_SESSIONS_ECHANTILLON = 12;

export interface SessionEchantillon {
  readonly id: string;
  readonly numero: string;
  readonly titre: string;
  readonly dateDebut: Date;
  readonly dateFin: Date;
}

export interface EchantillonSessions {
  readonly sessions: readonly SessionEchantillon[];
  /** Nombre total de sessions réalisées : la liste peut être plafonnée. */
  readonly total: number;
}

export async function listerSessionsRealiseesPourEchantillon(): Promise<EchantillonSessions | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { sessions: [], total: 0 };
  }
  try {
    const [sessions, total] = await Promise.all([
      prisma.trainingSession.findMany({
        where: { statut: "realisee" },
        select: { id: true, numero: true, titreSession: true, dateDebut: true, dateFin: true },
        orderBy: { dateDebut: "desc" },
        take: NB_SESSIONS_ECHANTILLON,
      }),
      prisma.trainingSession.count({ where: { statut: "realisee" } }),
    ]);
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        numero: s.numero,
        titre: s.titreSession,
        dateDebut: s.dateDebut,
        dateFin: s.dateFin,
      })),
      total,
    };
  } catch {
    return null;
  }
}
