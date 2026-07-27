/**
 * Qualiopi — Allocation des numéros de documents Formation / Session.
 *
 * Implémentation MAX(séquence) + 1 via `nextNumero` (pas de séquence DB dédiée).
 *
 * 🔴 Ce module faisait `count(*) + 1`. Le commentaire qui suivait — « l'unicité
 * @unique est le garde-fou final » — décrivait une garantie qui n'existe pas :
 * un index unique protège de la collision CONCURRENTE, il est totalement
 * aveugle à la réattribution d'un numéro LIBÉRÉ par une suppression. Et comme
 * `withNumberRetry` rejoue la même closure, donc le même `count()`, la reprise
 * recalculait cinq fois le même numéro : le résultat n'était pas un doublon,
 * c'était un VERROU PERMANENT sur la création de formations (scénario déjà
 * atteignable via le cycle seed-demo / purge-demo).
 *
 * La borne haute ferme les deux : un numéro émis n'est jamais réattribué, et la
 * reprise P2002 converge parce que le MAX, lui, progresse.
 *
 * En cas de collision P2002, le retry est géré au niveau de l'action.
 *
 * Reste stub-safe au build : `nextNumero` n'utilise que `findMany`, que le Proxy
 * `stub.invalid` de `src/lib/prisma.ts` intercepte (→ `[]`). Aucun SQL brut.
 */

import { prisma } from "@/lib/prisma";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
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
  // F63 (2026-07-26) avait posé le filtre d'année ; il est désormais porté par
  // `seriesPrefix`. V20 corrige la MÉCANIQUE : borne haute et non cardinalité.
  //
  // La table est écrite ici, pas déduite du type : la série est le couple
  // (PRÉFIXE, TABLE), et `AXI-FORM` était aussi frappé — pour d'autres pièces —
  // dans `documents_generes` jusqu'au correctif V19.
  return nextNumero("formation", year, (prefixe) =>
    db.formation.findMany({ where: { numero: { startsWith: prefixe } }, select: { numero: true } }),
  );
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
  // Les occurrences récurrentes `…-NNN-R0N` contribuent au MAX par leur numéro
  // de BASE (cf. `parseSequence`) : N lignes insérées ne consomment qu'un seul
  // rang de série, ce qui est le comportement voulu.
  //
  // ⚠️ ATTENTION, DETTE CONNUE ET NON FERMÉE PAR CE LOT : `documents_generes`
  // porte déjà `AXI-SESS-2026-003` (ancienne numérotation, cf. ADR 0034) alors
  // que `training_sessions` s'arrête à -002. La prochaine session créée recevra
  // donc -003 et entrera en collision inter-registres avec cette pièce. Seule la
  // purge des 9 tirages antérieurs (branche A de l'ADR 0034) ferme le cas.
  return nextNumero(
    "session",
    year,
    (prefixe) =>
      db.trainingSession.findMany({
        where: { numero: { startsWith: prefixe } },
        select: { numero: true },
      }),
    opts?.recurrence,
  );
}
