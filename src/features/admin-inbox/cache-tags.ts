// Tags de cache de la boîte de réception — module VOLONTAIREMENT SANS DÉPENDANCE.
//
// Pourquoi ce fichier existe plutôt qu'une constante dans `counters.ts` :
//
// Les Server Actions qui font bouger les compteurs (répondre à un message,
// archiver, enrichir un appel) ont besoin du NOM du tag, rien de plus. En le
// prenant dans `counters.ts`, elles importaient au passage `unstable_cache` et
// le client Prisma — et cassaient net les 11 tests de `reply-actions` qui
// mockent `next/cache` partiellement : `unstable_cache` y valait `undefined`,
// donc le module explosait au chargement.
//
// Une chaîne de caractères n'a pas à traîner un module d'accès base derrière
// elle. Ce fichier ne doit JAMAIS acquérir d'import.

/** Tag d'invalidation des compteurs « à traiter » de la sidebar. */
export const INBOX_COUNTS_TAG = "admin:inbox-counts";
