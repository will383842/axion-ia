/**
 * OUT-1 — ce qu'il faut savoir d'un envoi approuvé depuis la corbeille, sans charger la file.
 *
 * Module VOLONTAIREMENT léger : il n'importe ni `health.ts` ni `queues.ts` (ni Redis, ni BullMQ).
 * Il est lu par la file (`queues.ts`), l'action d'approbation, le balayage horaire et le lecteur
 * « un e-mail de ce devis attend-il ? », qui ne doivent pas se tirer les uns les autres.
 *
 * Aucune donnée de personne ici : des identifiants de ligne et des dates seulement.
 */

/** Identifiant de la tâche d'envoi d'une ligne de corbeille : un seul par ligne, jamais un tirage au sort. */
export function cleTacheOutbox(id: string): string {
  return "outbox-" + id;
}

/**
 * Temps accordé à la mise en file d'un envoi approuvé. Passé ce délai, l'issue est INCONNUE (la
 * tâche a pu entrer dans la file) : on ne remet rien « à valider ». Doit rester inférieur au délai
 * de la transaction qui enfile (`lien-a-l-envoi.ts`) : voir sa garde.
 */
export const DELAI_MISE_EN_FILE_OUTBOX_MS = 20_000;

/**
 * OUT-1 — la file d'envoi ne répond pas : RIEN n'y est entré (aucune commande n'a été émise vers
 * Redis, donc rien n'est en vol). L'appelant peut remettre l'envoi à plus tard sans risque de doublon.
 */
export class FileInjoignable extends Error {
  constructor() {
    super("file d'envoi injoignable");
    this.name = "FileInjoignable";
  }
}

/**
 * OUT-1 — la commande d'ajout est partie vers Redis et on n'a pas eu de réponse à temps : la tâche
 * a pu entrer dans la file. L'issue est INCONNUE ; elle n'est jamais traitée comme « rien n'est parti ».
 */
export class MiseEnFileIncertaine extends Error {
  constructor() {
    super("mise en file incertaine");
    this.name = "MiseEnFileIncertaine";
  }
}

/** Un « approuvé » sans envoi au-delà de ce délai (minutes) est un tombeau, sauf journal « en attente ». */
export const AGE_APPROUVE_ABANDONNE_MIN = 15;

/** Lecteur minimal du journal d'envoi : « existe-t-il une ligne en attente pour ces tâches ? ». */
export interface LecteurJournalOutbox {
  emailLog: {
    findFirst: (args: {
      where: { jobId: string | { in: string[] }; status: "pending" };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
}

/**
 * Vrai si l'approbation est encore « en cours » : approuvée depuis moins de 15 minutes, OU
 * une ligne `pending` du journal porte déjà la tâche de cette ligne (la mise en file a pu aboutir :
 * l'issue est inconnue, jamais « rien n'est parti »).
 */
export async function approuveEncoreEnCours(
  db: LecteurJournalOutbox,
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
