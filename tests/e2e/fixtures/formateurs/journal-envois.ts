// Banc @formateurs — lire le JOURNAL DES ENVOIS (`email_logs`).
//
// Le banc tourne dans son propre job CI (`banc-formateurs.yml`), où la file
// d'e-mails EXISTE : Redis réel, worker lancé en tâche de fond, puits SMTP
// local (`puits-smtp.ts`). Un envoi y laisse donc une ligne ici ET un message
// dans le puits — les deux se constatent.
//
// ⚠️ Hors de ce job (Gate B, poste de développement sans worker), sous
// `BULLMQ_DISABLED=true`, `enqueueEmail` rend `{ enqueued: false }` AVANT
// d'écrire au journal (`src/server/queue/queues.ts`, garde
// `if (!emailsQueue)`) : un journal vide n'y prouve rien.

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
