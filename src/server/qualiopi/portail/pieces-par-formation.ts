/**
 * Regroupement des pièces remises au bénéficiaire — par DOSSIER, pas par type.
 *
 * ## Le défaut que ce module ferme
 *
 * `getEspaceStagiaire` dédupliquait les pièces **par TYPE, toutes sessions
 * confondues**, premier arrivé gagnant :
 *
 * ```ts
 * if (!parType.has(d.type)) parType.set(d.type, d);
 * ```
 *
 * Le raisonnement d'origine est écrit dans le code, et il est juste — « les
 * régénérations créent des doublons, et présenter au stagiaire deux règlements
 * intérieurs de dates différentes est pire que n'en présenter aucun ». Il est
 * juste **pour un stagiaire à une session**. À deux, il efface : la convocation
 * d'une formation masque celle de l'autre, et l'ordre n'est pas garanti.
 *
 * Constaté le 16/08/2026 sur un espace réel — une stagiaire inscrite à deux
 * sessions du même client, l'une réalisée le 31/07, l'autre le jour même.
 *
 * ## Ce que la règle conserve, et ce qu'elle retire
 *
 * On garde la déduplication **là où elle protège** (deux pièces du même type
 * dans la MÊME session : la plus récente gagne) et on la retire **là où elle
 * efface** (deux sessions différentes).
 *
 * Module PUR : aucune dépendance Prisma, R2 ni Next. La fonction est donc celle
 * que les tests exercent — pas une copie qui divergerait un jour.
 */

/** Le minimum dont le regroupement a besoin d'un document. */
export interface DocumentRegroupable {
  type: string;
  createdAt: Date;
}

/** Une inscription et les pièces de sa session. */
export interface InscriptionAvecPieces<D extends DocumentRegroupable> {
  sessionId: string | null;
  sessionTitre: string;
  documents: readonly D[];
}

/** Une pièce retenue, avec le dossier auquel elle appartient. */
export interface PieceRetenue<D extends DocumentRegroupable> {
  doc: D;
  sessionId: string | null;
  sessionTitre: string;
}

/**
 * Retient une pièce par couple (session, type) — la plus récente.
 *
 * ⚠️ Les inscriptions **sans session** sont regroupées sous une clé commune
 * plutôt qu'écartées : une pièce orpheline reste une pièce remise au
 * bénéficiaire, et la faire disparaître serait exactement le défaut qu'on
 * corrige, sous un autre nom.
 */
export function retenirPiecesParSessionEtType<D extends DocumentRegroupable>(
  inscriptions: readonly InscriptionAvecPieces<D>[],
): PieceRetenue<D>[] {
  const parSessionEtType = new Map<string, PieceRetenue<D>>();
  for (const inscription of inscriptions) {
    for (const doc of inscription.documents) {
      const cle = `${inscription.sessionId ?? "sans-session"}::${doc.type}`;
      const existant = parSessionEtType.get(cle);
      if (existant === undefined || doc.createdAt > existant.doc.createdAt) {
        parSessionEtType.set(cle, {
          doc,
          sessionId: inscription.sessionId,
          sessionTitre: inscription.sessionTitre,
        });
      }
    }
  }
  return [...parSessionEtType.values()];
}
