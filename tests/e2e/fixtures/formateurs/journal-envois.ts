// Banc @formateurs — lire le JOURNAL DES ENVOIS (`email_logs`).
//
// ⚠️ Sous Gate B, `BULLMQ_DISABLED=true` : `enqueueEmail` rend
// `{ enqueued: false }` AVANT d'écrire au journal (`src/server/queue/queues.ts`,
// garde `if (!emailsQueue)`). Ce banc ne prouve donc AUCUN envoi — un journal
// vide y est l'état attendu, pas une preuve d'absence. Les e-mails seront
// prouvés par un autre banc, où la file existe. Ces lectures servent dès
// maintenant à affirmer qu'un écran ou une garde n'a RIEN fait partir par un
// autre chemin, et serviront telles quelles au banc des e-mails.

import { prisma } from "./base";

export interface FiltreJournal {
  /** Destinataire exact (insensible à la casse : colonne `citext`). */
  readonly destinataire?: string;
  /** Nom du gabarit (`EmailJobName`). */
  readonly gabarit?: string;
  /** Ne garder que les lignes créées à partir de cet instant. */
  readonly depuis?: Date;
}

/** Les lignes du journal qui correspondent, les plus anciennes d'abord. */
export function lireJournalEnvois(filtre: FiltreJournal) {
  return prisma.emailLog.findMany({
    where: {
      ...(filtre.destinataire ? { recipient: filtre.destinataire } : {}),
      ...(filtre.gabarit ? { template: filtre.gabarit } : {}),
      ...(filtre.depuis ? { createdAt: { gte: filtre.depuis } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, template: true, recipient: true, status: true, createdAt: true },
  });
}

/** Le nombre de lignes pour un destinataire — la forme courte des constats. */
export async function compterEnvois(destinataire: string, depuis?: Date): Promise<number> {
  return (await lireJournalEnvois({ destinataire, ...(depuis ? { depuis } : {}) })).length;
}
