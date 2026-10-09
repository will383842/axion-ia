// Banc @formateurs — le client Prisma des specs, et le ménage après chaque test.
//
// Même import que les autres specs de bout en bout (`index.js` explicite : le
// dépôt est en ESM, un import de dossier ne s'y résout pas).
//
// 🔑 Chaque test EFFACE ce qu'il a écrit. La base E2E est partagée par toute la
// suite Gate B : un rendez-vous laissé derrière soi changerait les comptes de
// l'onglet Rendez-vous que d'autres specs lisent.

import { PrismaClient } from "../../../../prisma/generated/client/index.js";

import { eventUriDe, type RendezVousSimule } from "./calendly-simule";

export const prisma = new PrismaClient();

/** La ligne `calendly_events` d'un rendez-vous simulé, ou `null`. */
export function ligneDuRendezVous(rdv: RendezVousSimule) {
  return prisma.calendlyEvent.findFirst({
    where: { eventUri: eventUriDe(rdv) },
    select: {
      id: true,
      status: true,
      source: true,
      typeRendezVous: true,
      eventTypeName: true,
      inviteeEmail: true,
      linkedSubmissionId: true,
    },
  });
}

/** Les lignes d'outbox CRM d'un rendez-vous (`subject_ref = site:calendly_event:<id>`). */
export function outboxCrmDuRendezVous(calendlyEventId: string) {
  return prisma.crmSyncOutbox.findMany({
    where: { subjectRef: `site:calendly_event:${calendlyEventId}` },
    select: { eventType: true, universe: true, subjectRef: true },
  });
}

/**
 * Efface tout ce que la chaîne a pu écrire pour ce rendez-vous : outbox CRM,
 * fiche apporteur créée à la réservation (et son journal d'activité), ligne.
 */
export async function effacerRendezVous(rdv: RendezVousSimule): Promise<void> {
  const ligne = await prisma.calendlyEvent.findFirst({
    where: { eventUri: eventUriDe(rdv) },
    select: { id: true },
  });
  if (ligne === null) return;
  await prisma.crmSyncOutbox.deleteMany({
    where: { subjectRef: `site:calendly_event:${ligne.id}` },
  });
  const fiches = await prisma.submission.findMany({
    where: { details: { path: ["calendlyEventId"], equals: ligne.id } },
    select: { id: true },
  });
  const ids = fiches.map((f) => f.id);
  await prisma.calendlyEvent.delete({ where: { id: ligne.id } });
  if (ids.length > 0) {
    await prisma.activityLog.deleteMany({ where: { targetId: { in: ids } } });
    await prisma.submission.deleteMany({ where: { id: { in: ids } } });
  }
}
