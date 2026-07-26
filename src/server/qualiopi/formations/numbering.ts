/**
 * Qualiopi — Allocation des numéros de documents Formation / Session.
 *
 * Implémentation count+1 simple (pas de séquence DB dédiée).
 * L'unicité @unique sur `numero` dans le schéma Prisma est le garde-fou
 * final contre les collisions (race condition extrêmement rare à faible
 * concurrence).
 *
 * En cas de collision P2002, le retry est géré au niveau de l'action.
 *
 * Tous les appels sont stub-safe via formatDocumentNumber (pur).
 */

import { prisma } from "@/lib/prisma";
import { formatDocumentNumber } from "@/server/qualiopi/numbering/formats";
import type { Prisma } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Formation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alloue le prochain numéro de formation (AXI-FORM-YYYY-NNN).
 *
 * @param tx Client transactionnel optionnel (pour atomicité avec la création).
 * @returns Numéro de document bien formé, ex. "AXI-FORM-2026-001".
 */
export async function allocateFormationNumero(tx?: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const db = tx ?? prisma;
  // 🔴 Audit certification 2026-07-26 (F63). Le comptage portait sur la table
  // ENTIÈRE, sans filtre d'année, tout en estampillant l'année courante. Avec 57
  // formations numérotées AXI-FORM-2026-001 → -057, la première formation créée
  // le 1er janvier 2027 aurait reçu AXI-FORM-2027-058 : la séquence 2027
  // n'aurait jamais eu de 001 à 057.
  //
  // L'incohérence était interne au module : la numérotation des factures filtre
  // correctement par année (`startsWith AXI-FACT-{annee}-`). On aligne.
  const count = await db.formation.count({
    where: { numero: { startsWith: `AXI-FORM-${year}-` } },
  });
  return formatDocumentNumber("formation", year, count + 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────────────────────────────────────

export interface AllocateSessionNumeroOpts {
  /** Numéro de récurrence (ex. 1 pour la 1ère occurrence d'une session récurrente). */
  recurrence?: number;
  /** Client transactionnel optionnel. */
  tx?: Prisma.TransactionClient;
}

/**
 * Alloue le prochain numéro de session (AXI-SESS-YYYY-NNN ou AXI-SESS-YYYY-NNN-R0N).
 *
 * @param opts.recurrence Numéro d'occurrence pour les sessions récurrentes.
 * @param opts.tx         Client transactionnel optionnel.
 * @returns Numéro de document bien formé, ex. "AXI-SESS-2026-001" ou "AXI-SESS-2026-001-R01".
 */
export async function allocateSessionNumero(opts?: AllocateSessionNumeroOpts): Promise<string> {
  const year = new Date().getFullYear();
  const db = opts?.tx ?? prisma;
  // F63 — même défaut que pour les formations : le comptage ignorait l'année.
  const count = await db.trainingSession.count({
    where: { numero: { startsWith: `AXI-SESS-${year}-` } },
  });
  return formatDocumentNumber("session", year, count + 1, opts?.recurrence);
}
