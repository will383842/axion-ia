/**
 * Alerte `convention_non_validee_avant_session` — lot L5h.
 *
 * Une convention de formation dont l'e-mail d'envoi est garé « à valider » dans
 * `email_outbox` n'est PAS partie chez le client. Rien ne le disait : à l'approche
 * de la date de convocation, la session démarre alors sans convention transmise.
 *
 *   - session `planifiee` qui commence dans 7 jours ou moins (et pas déjà passée) ;
 *   - au moins un `convention-envoi` au statut `a_valider` rattaché à une pièce
 *     (`DocumentGenere`) de cette session ;
 *   - UNE seule alerte par session, quel que soit le nombre de conventions garées ;
 *   - se referme seule dès que l'e-mail est approuvé, refusé ou envoyé (plus de
 *     ligne `a_valider`), ou que la session est passée.
 *
 * Lecture seule : ne valide, n'envoie et ne modifie rien.
 */

import { prisma } from "@/lib/prisma";
import type { AlerteNiveau } from "../../../../prisma/generated/client";
import type { AlerteCandidate } from "./evaluateur";

export const HORIZON_CONVENTION_NON_VALIDEE_JOURS = 7;
const JOUR_MS = 24 * 60 * 60 * 1000;

export async function regleConventionNonValideeAvantSession(now: Date): Promise<AlerteCandidate[]> {
  const garees = await prisma.emailOutbox.findMany({
    where: { template: "convention-envoi", statut: "a_valider", entityType: "DocumentGenere" },
    select: { entityId: true },
  });
  const pieces = [...new Set(garees.map((g) => g.entityId).filter((id): id is string => !!id))];
  if (pieces.length === 0) return [];

  const documents = await prisma.documentGenere.findMany({
    where: {
      id: { in: pieces },
      session: {
        statut: "planifiee",
        dateDebut: {
          gte: now,
          lte: new Date(now.getTime() + HORIZON_CONVENTION_NON_VALIDEE_JOURS * JOUR_MS),
        },
      },
    },
    select: { session: { select: { id: true, numero: true } } },
  });

  const parSession = new Map<string, string>();
  for (const d of documents) {
    if (d.session && !parSession.has(d.session.id)) parSession.set(d.session.id, d.session.numero);
  }
  return [...parSession].map(([id, numero]) => ({
    code: "convention_non_validee_avant_session",
    niveau: "important" as AlerteNiveau,
    titre: "Convention non validée à l'approche de la session",
    message:
      `L'e-mail d'envoi de la convention de la session ${numero} attend toujours votre ` +
      `validation, et la session commence dans ${HORIZON_CONVENTION_NON_VALIDEE_JOURS} jours ` +
      "ou moins : le client ne l'a pas reçue. Validez l'e-mail dans la corbeille de " +
      "validation, ou refusez-le. Cette alerte se referme dès qu'il n'est plus en attente.",
    cibleType: "TrainingSession",
    cibleId: id,
  }));
}
