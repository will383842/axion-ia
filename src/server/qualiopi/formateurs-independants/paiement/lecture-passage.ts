/**
 * Formateurs indépendants — lectures en base du PAIEMENT PAR MISSION (lot L12c).
 *
 * Sans `server-only` : appelé par le run mensuel (console) ET par le passage
 * quotidien (worker, sous `tsx`). L'interprétation de l'interrupteur reste dans
 * `interrupteurs.ts`.
 *
 * 🔴 ICI, UNE LECTURE QUI ÉCHOUE LÈVE. Un « pas de bascule » inventé faute de
 * base ferait traiter par le run mensuel une session déjà payée par mission :
 * un double paiement. Mieux vaut un run qui échoue qu'un run qui paie deux fois.
 */

import { cleSetting, lireValeur } from "../interrupteurs";

/** Le strict nécessaire d'un client Prisma (ou d'une transaction). */
export interface LecteurPassage {
  setting: {
    findUnique(a: {
      where: { key: string };
      select: { value: true };
    }): Promise<{ value: unknown } | null>;
  };
  $queryRawUnsafe<T = unknown>(sql: string, ...v: unknown[]): Promise<T>;
}

/** La date de bascule (`AAAA-MM-01`), ou `null` si l'interrupteur n'a pas de date. */
export async function lireDateBascule(db: LecteurPassage): Promise<string | null> {
  const ligne = await db.setting.findUnique({
    where: { key: cleSetting("passage_paiement") },
    select: { value: true },
  });
  return lireValeur("passage_paiement", ligne?.value).valeur;
}

/**
 * M-D est-il passé ? Tant que l'unique historique (formateur, année, mois) est
 * en base, un relevé de mission ne peut pas coexister avec le relevé mensuel du
 * même mois : le paiement par mission refuse de tourner.
 */
export async function uniqueHistoriqueRetire(db: LecteurPassage): Promise<boolean> {
  const r = await db.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*)::int AS n FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'statement_unique_trainer_periode'`,
  );
  return (r[0]?.n ?? 1) === 0;
}
