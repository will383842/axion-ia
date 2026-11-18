/**
 * Le NOM de chaque destinataire d'un e-mail de la fiche. LECTURE SEULE.
 * ⛔ L'adresse sert à retrouver le contact, jamais à être rendue ni journalisée.
 */

import { prisma } from "@/lib/prisma";

/** Le NOM de chaque destinataire connu de la fiche, par clé d'événement. Jamais l'adresse. */
export async function nomsDesDestinataires(
  clientId: string,
  cles: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const idsLog = cles.filter((c) => c.startsWith("mail:")).map((c) => c.slice(5));
  const idsOutbox = cles.filter((c) => c.startsWith("outbox:")).map((c) => c.slice(7));
  const [logs, outbox, adresses] = await Promise.all([
    idsLog.length === 0
      ? []
      : prisma.emailLog.findMany({
          where: { id: { in: idsLog } },
          select: { id: true, recipient: true },
        }),
    idsOutbox.length === 0
      ? []
      : prisma.emailOutbox.findMany({
          where: { id: { in: idsOutbox } },
          select: { id: true, recipient: true },
        }),
    prisma.clientContactAdresse.findMany({
      where: { contact: { clientId } },
      select: { email: true, contact: { select: { nom: true } } },
    }),
  ]);
  const nomParAdresse = new Map(adresses.map((a) => [a.email.toLowerCase(), a.contact.nom]));
  const noms = new Map<string, string>();
  for (const l of logs) {
    const nom = nomParAdresse.get(l.recipient.toLowerCase());
    if (nom !== undefined) noms.set(`mail:${l.id}`, nom);
  }
  for (const o of outbox) {
    const nom = nomParAdresse.get(o.recipient.toLowerCase());
    if (nom !== undefined) noms.set(`outbox:${o.id}`, nom);
  }
  return noms;
}
