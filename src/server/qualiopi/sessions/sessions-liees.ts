/**
 * 🔴 Lot L4 (2026-09-30) — les liens RETOUR vers la fiche session.
 *
 * Constat de l'audit UX : depuis une fiche formation ou une fiche formateur, on
 * ne pouvait pas rejoindre les sessions concernées. On y revenait par le menu,
 * puis par la liste, en cherchant le numéro — c'est ainsi qu'on se perd. Les
 * fiches listent désormais leurs sessions, chacune avec UN lien vers LA fiche.
 *
 * Le formateur est rattaché par l'invariant nommé du dépôt,
 * `whereSessionsDuFormateur` (principal OU co-animateur) — jamais par
 * `formateurPrincipalId` seul, qui taierait les co-animations.
 *
 * Plafonné et DIT : une liste coupée en silence se lit comme une liste complète.
 * Stub-safe / fail-soft : un échec de lecture rend `erreur: true`, que l'écran
 * affiche — jamais une liste vide qui se ferait passer pour « aucune session ».
 */

import { prisma } from "@/lib/prisma";
import { whereSessionsDuFormateur } from "@/server/formateur/collectif-queries";

export const PLAFOND_SESSIONS_LIEES = 50;

export interface SessionLiee {
  id: string;
  numero: string;
  titreSession: string;
  statut: string;
  dateDebut: Date;
  dateFin: Date;
}

export interface SessionsLiees {
  lignes: SessionLiee[];
  /** Vrai quand d'autres sessions existent au-delà du plafond. */
  tronque: boolean;
  erreur: boolean;
}

export type CibleSessionsLiees = { formationId: string } | { trainerId: string };

export async function listerSessionsLiees(cible: CibleSessionsLiees): Promise<SessionsLiees> {
  const where =
    "formationId" in cible
      ? { formationId: cible.formationId }
      : whereSessionsDuFormateur(cible.trainerId);
  try {
    // Un de plus que le plafond : c'est ce qui dit « il y en a d'autres ».
    const lignes = await prisma.trainingSession.findMany({
      where,
      orderBy: [{ dateDebut: "desc" }, { id: "desc" }],
      take: PLAFOND_SESSIONS_LIEES + 1,
      select: {
        id: true,
        numero: true,
        titreSession: true,
        statut: true,
        dateDebut: true,
        dateFin: true,
      },
    });
    return {
      lignes: lignes.slice(0, PLAFOND_SESSIONS_LIEES),
      tronque: lignes.length > PLAFOND_SESSIONS_LIEES,
      erreur: false,
    };
  } catch {
    return { lignes: [], tronque: false, erreur: true };
  }
}
