// Numérotation factures immuables AXION-YYYY-NNNN (Sprint X.10).
//
// Doctrine : Agent 11 P0-1 + CGI 242 nonies A FR + EE — pas de trou,
// série séquentielle par année, atomique sous charge concurrente.
//
// Mécanique :
//   1. `pg_advisory_xact_lock(hashtext('invoice_seq_YYYY'))` — sérialise les
//      accès concurrents au compteur dans la même transaction.
//   2. `SELECT MAX(number) WHERE number LIKE 'AXION-YYYY-%'` — lit le dernier
//      numéro de l'année (le lock garantit qu'aucune autre tx n'insère
//      entre lecture et insert).
//   3. Construit `AXION-YYYY-NNNN` (padding zéro à 4 chiffres, max 9999/an,
//      pivot à 5 chiffres si scaling >10k/an).
//
// Le lock est libéré automatiquement au COMMIT/ROLLBACK de la transaction.
//
// Tests dédiés : `invoice-numbering.test.ts` (1000 inserts parallèles → 1000
// numéros uniques + pas de doublon).

import type { Prisma } from "../../prisma/generated/client";

export const INVOICE_PREFIX = "AXION";

/**
 * Compute next invoice number for the given year (default = current year),
 * holding an advisory lock for the duration of the surrounding transaction.
 *
 * MUST be called inside a `prisma.$transaction(async (tx) => { ... })` block.
 * Calling outside a transaction defeats the lock and risks duplicates.
 */
export async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const key = `invoice_seq_${year}`;

  // Advisory lock — bloque toute autre tx qui appelle nextInvoiceNumber()
  // jusqu'au commit/rollback de la nôtre. hashtext renvoie int4, suffisant.
  await tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(hashtext('${key.replace(/'/g, "''")}'))`,
  );

  const prefix = `${INVOICE_PREFIX}-${year}-`;
  const rows = await tx.$queryRaw<Array<{ max: string | null }>>`
    SELECT MAX(number) AS max FROM invoices
    WHERE number LIKE ${`${prefix}%`}
  `;

  const max = rows[0]?.max ?? null;
  let next = 1;
  if (max) {
    const seq = parseInt(max.slice(prefix.length), 10);
    if (Number.isFinite(seq) && seq > 0) next = seq + 1;
  }

  return `${prefix}${String(next).padStart(4, "0")}`;
}

/**
 * Parse un numéro AXION-YYYY-NNNN. Renvoie null si format invalide.
 */
export function parseInvoiceNumber(num: string): { year: number; sequence: number } | null {
  const match = /^AXION-(\d{4})-(\d{4,})$/.exec(num);
  if (!match || !match[1] || !match[2]) return null;
  return { year: parseInt(match[1], 10), sequence: parseInt(match[2], 10) };
}
