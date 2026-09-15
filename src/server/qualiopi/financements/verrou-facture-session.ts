/**
 * Qualiopi — VERROU CONSULTATIF de facturation d'une session.
 *
 * Toute écriture qui décide « cette session a-t-elle déjà sa facture ? » puis
 * agit en conséquence passe par ici : l'émission (bouton « Générer la facture de
 * formation » ET automate du lendemain) et la reprise d'une facture automatique
 * restée sans PDF ni e-mail. Lire puis écrire se traverse à deux ; le verrou
 * sérialise sans migration.
 *
 * `pg_try_advisory_xact_lock` et non la variante bloquante : celui qui trouve la
 * session tenue ne doit pas attendre pour constater ensuite qu'elle est
 * facturée — il le DIT (bouton) ou s'abstient (cron).
 *
 * ⚠️ Le verrou est tenu par la connexion de la transaction ; le travail passé en
 * rappel utilise le client global. C'est voulu (une émission ne peut pas vivre
 * dans une transaction interactive : sa reprise sur P2002 aborterait la
 * transaction), et c'est correct pour un verrou consultatif. Coût : une
 * connexion du pool occupée pendant l'émission.
 *
 * ⚠️ Si le rappel dépasse le délai de la transaction, celle-ci lève alors que
 * l'écriture a pu aboutir. L'appelant ne doit donc JAMAIS conclure « rien n'a
 * été écrit » d'une exception : les factures incomplètes sont retrouvées par
 * l'état de la base (`facturesSessionIncompletes`), pas par un journal.
 */

import { prisma } from "@/lib/prisma";

export function cleVerrouFactureSession(sessionId: string): string {
  return `facture_session:${sessionId}`;
}

export type IssueVerrou<T> = { acquis: true; valeur: T } | { acquis: false };

export async function avecVerrouFactureSession<T>(
  sessionId: string,
  travail: () => Promise<T>,
): Promise<IssueVerrou<T>> {
  const cle = cleVerrouFactureSession(sessionId);
  return prisma.$transaction(
    async (tx) => {
      const lignes = await tx.$queryRaw<Array<{ acquis: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtext(${cle})) AS acquis`;
      if (lignes[0]?.acquis !== true) return { acquis: false } as const;
      return { acquis: true, valeur: await travail() } as const;
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}
