/**
 * OUT-1 — un envoi depuis la corbeille ne produit jamais deux tâches.
 *
 * Module LÉGER : aucun import de `health.ts` ni de `queues.ts` (il est lu par l'enveloppe du lien
 * de signature, par la liste des devis et par la file elle-même).
 *
 * Le seul identifiant de tâche d'un envoi approuvé est `outbox-<id de la ligne>` : deux
 * approbations de la même ligne (pendant une coupure de Redis, après la remise « à valider » du
 * balayage) visent donc LA MÊME tâche, et BullMQ ignore la seconde.
 */

/** Une ligne « approuvé » plus vieille que ce délai (minutes) est considérée abandonnée. */
export const AGE_APPROUVE_ABANDONNE_MIN = 15;

/** Budget total (ms) de la mise en file d'un envoi de la corbeille, avant « issue inconnue ». */
export const DELAI_MISE_EN_FILE_OUTBOX_MS = 20_000;

/** Attente maximale (ms) de la connexion à la file avant de renoncer, sans rien avoir envoyé. */
export const DELAI_CONNEXION_FILE_MS = 5_000;

/** Identifiant de tâche BullMQ d'un envoi approuvé depuis la corbeille. */
export function cleTacheOutbox(id: string): string {
  return `outbox-${id}`;
}

/** La file n'a pas répondu à temps : AUCUNE commande n'a été émise, rien n'est en vol. */
export class FileInjoignable extends Error {
  constructor() {
    super("file d'envoi injoignable");
    this.name = "FileInjoignable";
  }
}

/** L'ajout a été émis et n'a pas répondu à temps : on ne sait pas si l'e-mail est parti. */
export class MiseEnFileIncertaine extends Error {
  constructor() {
    super("mise en file incertaine");
    this.name = "MiseEnFileIncertaine";
  }
}

interface LecteurJournal {
  emailLog: {
    findFirst: (args: {
      where: { jobId: string; status: "pending" };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
}

/**
 * Une ligne « approuvé » est-elle encore en cours d'envoi ? Vrai si approuvée depuis moins de
 * 15 minutes, OU si le journal garde une ligne `pending` pour sa tâche (issue inconnue : ne pas
 * rouvrir le devis, ne pas laisser croire que rien n'est parti).
 */
export async function approuveEncoreEnCours(
  db: LecteurJournal,
  ligne: { id: string; approuveAt: Date | null },
  maintenant: Date = new Date(),
): Promise<boolean> {
  const seuil = maintenant.getTime() - AGE_APPROUVE_ABANDONNE_MIN * 60_000;
  if (ligne.approuveAt !== null && ligne.approuveAt.getTime() >= seuil) return true;
  const pending = await db.emailLog.findFirst({
    where: { jobId: cleTacheOutbox(ligne.id), status: "pending" },
    select: { id: true },
  });
  return pending !== null;
}
