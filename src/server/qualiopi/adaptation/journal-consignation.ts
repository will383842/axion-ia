/**
 * La DATE des réponses d'adaptation consignées (ind. 10), lue au journal.
 *
 * `Enrollment.adaptationsRealisees` ne porte pas d'horodatage, et une colonne
 * ne se crée pas pour cela : l'unique écrivain de la colonne
 * (`setEnrollmentAdaptationsAction`) journalise chaque geste, sans le texte. Ce
 * lecteur en tire, par inscription, depuis quand la réponse actuelle est
 * consignée — ce que l'auditrice compare au début de la session.
 *
 * Un seul aller-retour pour toutes les inscriptions demandées.
 */

import { prisma } from "@/lib/prisma";
import {
  ACTION_JOURNAL_ADAPTATIONS,
  debutConsignationCourante,
  type EntreeJournalAdaptation,
} from "./reponse-organisme";

export async function datesConsignationAdaptation(
  enrollmentIds: readonly string[],
): Promise<ReadonlyMap<string, Date>> {
  const resultat = new Map<string, Date>();
  if (enrollmentIds.length === 0) return resultat;
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return resultat;

  const lignes = await prisma.activityLog.findMany({
    where: {
      action: ACTION_JOURNAL_ADAPTATIONS,
      targetType: "Enrollment",
      targetId: { in: [...enrollmentIds] },
    },
    select: { targetId: true, createdAt: true, changes: true },
    orderBy: { createdAt: "asc" },
  });

  const parInscription = new Map<string, EntreeJournalAdaptation[]>();
  for (const l of lignes) {
    if (l.targetId === null) continue;
    const changes = l.changes as { adaptationsRenseignees?: unknown } | null;
    const liste = parInscription.get(l.targetId) ?? [];
    liste.push({ createdAt: l.createdAt, renseignee: changes?.adaptationsRenseignees === true });
    parInscription.set(l.targetId, liste);
  }
  for (const [id, entrees] of parInscription) {
    const depuis = debutConsignationCourante(entrees);
    if (depuis !== null) resultat.set(id, depuis);
  }
  return resultat;
}
