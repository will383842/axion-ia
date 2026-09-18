import "server-only";

/**
 * Lecture GROUPÉE des accusés de réception automatiques, pour n'importe quelle
 * entité — une requête pour toute une page, jamais une par ligne.
 *
 * Paramétrée par `{ entityType, gabarits }` : la fiche d'une candidature
 * (`JobApplication`, `candidature-recue`) et la liste des messages
 * (`Submission`, sept gabarits) lisent par la MÊME porte.
 *
 * ⚠️ Aucune garde de droit ici, délibérément : chaque appelant décide qui a le
 * droit de voir quoi (le dossier candidat a son prédicat, la boîte des messages
 * est déjà gardée par sa page). Ce module lit ; il ne décide d'aucun droit.
 */

import { prisma } from "@/lib/prisma";
import {
  FENETRE_APRES_MS,
  MARGE_AVANT_MS,
  SELECT_LIGNE_ACCUSE,
  attribuerAccuses,
  type AccuseReception,
  type EntiteAccusee,
} from "./accuse-noyau";

export interface CibleAccuse {
  /** `EmailLog.entityType` posé à l'enfilage de l'accusé. */
  readonly entityType: string;
  /** Gabarits qui accusent réception de ce type d'entité. */
  readonly gabarits: ReadonlyArray<string>;
}

/** Plafond de lignes lues pour UNE page (25 lignes × quelques envois chacune). */
const PLAFOND_LIGNES = 500;

export async function lireAccuses(
  cible: CibleAccuse,
  entites: ReadonlyArray<EntiteAccusee>,
): Promise<Map<string, AccuseReception>> {
  if (entites.length === 0) return new Map();

  // Une adresse vide (déchiffrement raté) ne cherche QUE le lien exact : un
  // filtre sur une chaîne vide ne trouverait rien, mais il ne doit pas non
  // plus avoir l'air d'avoir cherché.
  const adresses = [...new Set(entites.map((e) => e.email.trim()).filter((a) => a.length > 0))];
  const instants = entites.map((e) => e.submittedAt.getTime());

  const lignes = await prisma.emailLog.findMany({
    where: {
      template: { in: [...cible.gabarits] },
      OR: [
        { entityType: cible.entityType, entityId: { in: entites.map((e) => e.id) } },
        ...(adresses.length > 0
          ? [
              {
                recipient: { in: adresses },
                createdAt: {
                  gte: new Date(Math.min(...instants) - MARGE_AVANT_MS),
                  lte: new Date(Math.max(...instants) + FENETRE_APRES_MS),
                },
              },
            ]
          : []),
      ],
    },
    orderBy: { createdAt: "asc" },
    take: PLAFOND_LIGNES,
    select: SELECT_LIGNE_ACCUSE,
  });

  return attribuerAccuses(cible.entityType, entites, lignes);
}
