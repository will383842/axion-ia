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
  // 🔴 2026-08-24, cahier D9-2 — LECTURE CROISÉE, comme pour les sessions.
  //
  // Le commentaire ci-dessus constate l'héritage et s'arrête là : `AXI-FORM`
  // était « aussi frappé — pour d'autres pièces — dans `documents_generes` ».
  // `formats.ts` chiffre le reste : « AXI-FORM-2026-001 désigne à la fois une
  // formation du catalogue et un livret d'accueil — vérifié en production le
  // 2026-07-26 : 7 numéros dans ce cas ».
  //
  // Les sessions ont reçu la borne croisée (V19/V20). Les formations, non —
  // alors que l'héritage est le même. Deux artefacts distincts sous la même
  // référence, c'est un point d'audit, pas un incident technique : rien ne
  // plante, chaque index `@unique` de table est satisfait.
  //
  // ⚠️ Comme pour les sessions, ceci ne GARANTIT pas l'unicité inter-registres :
  // seule une table `numero_registre` alimentée par tous les allocateurs le
  // ferait (cf. « ce qui reste ouvert » de l'ADR 0035). On supprime la collision
  // constatée, pas la classe entière.
  return nextNumero("formation", year, async (prefixe) => {
    const [formations, pieces] = await Promise.all([
      db.formation.findMany({
        where: { numero: { startsWith: prefixe } },
        select: { numero: true },
      }),
      db.documentGenere.findMany({
        where: { numero: { startsWith: prefixe } },
        select: { numero: true },
      }),
    ]);
    return [...formations, ...pieces];
  });
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
  // 🔴 2026-08-23 — LA COLLISION ANNONCÉE PAR L'ADR 0035 §5 EST FERMÉE ICI,
  // SANS TOUCHER À UNE SEULE LIGNE DE PRODUCTION.
  //
  // Ce commentaire disait, jusqu'à aujourd'hui : « dette connue et non fermée
  // par ce lot — `documents_generes` porte déjà `AXI-SESS-2026-003` alors que
  // `training_sessions` s'arrête à -002 ; la prochaine session créée entrera en
  // collision ; seule la purge des 9 tirages antérieurs ferme le cas. »
  //
  // Une collision annoncée comme CERTAINE n'a pas à attendre une décision de
  // purge : il suffit que la borne haute cesse d'être aveugle à l'autre
  // registre. La purge (branche A de l'ADR) reste possible et souhaitable pour
  // la propreté des deux séries, mais elle n'est plus le seul remède, et elle
  // n'est plus urgente.
  //
  // ## Pourquoi cette lecture croisée ne contredit PAS la décision §1 de l'ADR
  //
  // §1 pose que les deux registres ont des espaces de noms DISJOINTS — et c'est
  // vrai pour tout ce qui est émis depuis le 2026-07-26 : le registre
  // documentaire n'émet plus que `AXI-DOC`, `AXI-ATT`, `AXI-CERT`. Interroger
  // `documents_generes` sur le préfixe `AXI-SESS-<année>-` ne peut donc ramener
  // QUE les pièces de l'ancienne numérotation, énumérées une à une par §4 :
  // un ensemble FIGÉ de 9 lignes, qui ne grandira jamais.
  //
  // Autrement dit, cette lecture n'ouvre pas un couplage permanent entre les
  // deux registres : elle rend la borne haute consciente d'un héritage clos.
  // Le jour où la branche A est jouée, elle ne ramènera plus rien et deviendra
  // un no-op — sans qu'il faille y repenser.
  //
  // ⚠️ Ce que ce correctif NE fait PAS : il ne rend pas l'unicité
  // inter-registres GARANTIE (cf. « ce qui reste ouvert » de l'ADR : seule une
  // table `numero_registre` alimentée par tous les allocateurs le ferait). Il
  // supprime la collision annoncée, pas la classe entière de défauts.
  return nextNumero(
    "session",
    year,
    async (prefixe) => {
      const [sessions, pieces] = await Promise.all([
        db.trainingSession.findMany({
          where: { numero: { startsWith: prefixe } },
          select: { numero: true },
        }),
        db.documentGenere.findMany({
          where: { numero: { startsWith: prefixe } },
          select: { numero: true },
        }),
      ]);
      return [...sessions, ...pieces];
    },
    opts?.recurrence,
  );
}
