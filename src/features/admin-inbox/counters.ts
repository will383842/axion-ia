// Boîte de réception — compteurs pour les badges de la sidebar (2026-07-29).
//
// Décision Will : un badge doit compter **ce qu'il reste à faire**, pas le
// volume total. Un compteur qui ne descend jamais finit ignoré ; celui-ci
// tombe à zéro quand la boîte est traitée, ce qui en fait un vrai signal.
//
// POURQUOI PAS `listInbox()` ICI : le layout admin est rendu à CHAQUE page de
// la console (force-dynamic). `listInbox` lit jusqu'à 100 lignes par canal,
// déchiffre les PII et trie en mémoire — hors de question de payer ça pour
// afficher quatre nombres. On fait donc quatre `count()` SQL, que Postgres
// résout sur index, mis en cache 30 s comme le compteur « contacts sans
// réponse » qui existait déjà.
//
// ⚠️ Les critères ci-dessous DOIVENT rester alignés sur les `needsAction` de
// `queries.ts` : un badge qui annonce 3 en face d'une liste qui en montre 5
// est pire que pas de badge. Un test verrouille cet alignement.

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { InboxChannel } from "./types";

export const INBOX_COUNTS_TAG = "admin:inbox-counts";

export type InboxActionCounts = Record<InboxChannel, number>;

const EMPTY: InboxActionCounts = { appel: 0, message: 0, candidature: 0, podcast: 0 };

async function computeInboxActionCounts(): Promise<InboxActionCounts> {
  const [message, appel, candidature, podcast] = await Promise.all([
    // Aligné sur le badge « contacts sans réponse » préexistant.
    prisma.submission.count({ where: { needsAttention: true, archivedAt: null } }).catch(() => 0),
    // Un appel programmé dont on ignore encore avec qui il a lieu.
    prisma.calendlyEvent
      .count({
        where: {
          status: "scheduled",
          OR: [{ inviteeName: null }, { inviteeEmail: null }],
        },
      })
      .catch(() => 0),
    prisma.jobApplication.count({ where: { needsAttention: true } }).catch(() => 0),
    prisma.podcastRequest.count({ where: { status: "new" } }).catch(() => 0),
  ]);
  return { message, appel, candidature, podcast };
}

/**
 * Compteurs « à traiter » par canal, cachés 30 s.
 *
 * Invalidation ciblée via `revalidateTag(INBOX_COUNTS_TAG)` depuis les actions
 * qui font baisser un compteur (réponse, archivage, enrichissement d'un appel).
 * Sans cela le badge resterait faux jusqu'à 30 s après une action — court, mais
 * suffisant pour faire douter de la fiabilité du chiffre.
 */
export const getInboxActionCounts = unstable_cache(
  async (): Promise<InboxActionCounts> => {
    try {
      return await computeInboxActionCounts();
    } catch {
      // Un compteur indisponible ne doit jamais empêcher la console de
      // s'afficher : pas de badge vaut mieux qu'une page blanche.
      return EMPTY;
    }
  },
  ["admin-inbox-action-counts"],
  { revalidate: 30, tags: [INBOX_COUNTS_TAG] },
);

export { EMPTY as EMPTY_INBOX_COUNTS };
