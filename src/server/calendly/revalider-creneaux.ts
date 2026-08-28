/**
 * Invalidation du cache des créneaux de `/appel` (2026-08-26).
 *
 * POURQUOI CE FICHIER EXISTE
 * --------------------------
 * `fetchAvailableSlots()` étiquette sa requête avec `CALENDLY_SLOTS_TAG` depuis
 * l'ADR 0038, sous le commentaire « permet une invalidation à la réservation ».
 * L'invalidation, elle, n'a jamais été écrite : `revalidateTag("calendly-slots")`
 * n'apparaissait NULLE PART dans `src/`. L'étiquette était donc décorative, et le
 * seul mécanisme de fraîcheur restait le TTL de 900 s de la page.
 *
 * Mesuré en production le 2026-08-26, événement témoin à l'appui : un rendez-vous
 * posé dans Google Agenda ferme le créneau chez Calendly en **11 secondes**, et
 * `/appel` continuait de le proposer **13 minutes**. Le visiteur qui cliquait un
 * créneau périmé n'était pas refusé — Calendly lui ouvrait le formulaire complet
 * et ne le rejetait qu'à la confirmation.
 *
 * DEUX CHEMINS, ET IL EN FAUT DEUX
 * --------------------------------
 * · Le **webhook** (`api/calendly/webhook`) couvre les réservations et
 *   annulations prises sur calendly.com. Décalage ramené à zéro.
 * · Le **cron du worker** (`calendly-poll`, toutes les 2 min) couvre le cas que
 *   le webhook NE PEUT PAS voir : un rendez-vous posé à la main dans Google
 *   Agenda ou sur l'iPhone. Calendly ferme bien le créneau, mais ne notifie
 *   personne — il faut donc aller regarder. C'est précisément le cas qui a
 *   déclenché l'audit.
 *
 * ⚠️ POURQUOI DEUX IMPLÉMENTATIONS ET PAS UNE. `revalidateTag`/`revalidatePath`
 * exigent un contexte de requête : dans un worker BullMQ ils LÈVENT une erreur
 * explicite (`Invariant: static generation store missing`, E263) — et non des
 * no-op silencieux comme l'affirmait ce paragraphe jusqu'au 2026-08-27. Trois
 * fichiers du dépôt répétaient la même erreur ; la conclusion pratique ne change
 * pas — le worker passe par `api/internal/revalidate` — mais un no-op silencieux
 * et un throw ne se diagnostiquent pas du tout de la même façon.
 *
 * Ce module tient les deux bouts pour que la liste des chemins et l'étiquette ne
 * divergent jamais.
 *
 * 🔴 CE QUI ÉTAIT RÉELLEMENT CASSÉ, mesuré le 2026-08-27. Ni cette fonction ni le
 * profil de cache : le `revalidatePath` ci-dessous expire en dur et purge bien
 * l'entrée `fetch`. Le défaut était que **le seul appelant vivant n'envoyait que
 * la moitié qui n'expire pas** — `calendly-poll-worker.ts` passait `tags` sans
 * `paths`. Le webhook, lui, appelait correctement cette fonction… mais il est
 * éteint tant que le plan Calendly est gratuit.
 *
 * ⚠️ AUCUNE PURGE CLOUDFLARE ICI, délibérément. `/appel` répond
 * `Cache-Control: private, no-store` et sort en `cf-cache-status: BYPASS`
 * (relevé le 2026-08-26) : il n'y a pas de copie d'edge à invalider. En purger
 * une toutes les 2 min consommerait le quota Free pour rien.
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { CALENDLY_SLOTS_TAG } from "./availability";
import { EXPIRATION_IMMEDIATE } from "@/server/cache/expiration-immediate";

/**
 * Chemins de la page de réservation, un par locale.
 *
 * ⚠️ Le segment est traduit (`routing.ts` : `"/appel": { fr: "/appel", en:
 * "/book-a-call" }`), donc la locale ne suffit pas — recopier `/fr/appel` pour
 * l'anglais invaliderait une route qui n'existe pas. EN est redirigé en 301
 * vers FR depuis le 2026-05-16 et sa page n'est plus servie ; le chemin est
 * conservé ici pour que la réactivation d'EN (procédure dans AGENTS.md) n'ait
 * pas à repasser par ce fichier.
 */
export const CALENDLY_SLOTS_PATHS: readonly string[] = ["/fr/appel", "/en/book-a-call"];

/**
 * Invalide créneaux + page, DANS UN CONTEXTE DE REQUÊTE (route handler, server
 * action). Ne throw jamais : rater une invalidation ne doit pas transformer un
 * webhook accepté en 500, ce qui déclencherait un rejeu Calendly.
 *
 * `origine` n'est là que pour le journal — savoir lequel des deux chemins a
 * tiré change tout au diagnostic.
 */
export function invaliderCreneaux(origine: string): void {
  try {
    // 🔴 CORRECTION 2026-08-27. Le commentaire retiré affirmait que `"default"`
    // « reproduit le comportement de `revalidateTag(tag)` des versions 14/15 ».
    // C'est l'INVERSE : `default.expire` vaut ~136 ans, l'entrée est seulement
    // marquée périmée, et Next sert la version périmée au visiteur suivant.
    // Voir `@/server/cache/expiration-immediate` pour la mesure.
    //
    // ⚠️ Cette fonction n'était PAS le défaut vivant : le `revalidatePath`
    // ci-dessous, appelé sans profil, expire en dur — et il purge aussi
    // l'entrée `fetch` des créneaux, qui porte l'étiquette implicite du chemin.
    // C'est la seule chose qui marchait. Le défaut était que le webhook, seul
    // appelant de cette fonction, est éteint sur le plan Calendly gratuit,
    // pendant que le cron du worker n'envoyait QUE des étiquettes.
    revalidateTag(CALENDLY_SLOTS_TAG, EXPIRATION_IMMEDIATE);
    for (const chemin of CALENDLY_SLOTS_PATHS) revalidatePath(chemin);
  } catch (e) {
    // Journalisé, jamais avalé en silence : une invalidation morte se lit
    // exactement comme un agenda à jour, et c'est ce qui a coûté quatre semaines
    // à l'étiquette qui ne servait à rien.
    console.error(
      JSON.stringify({
        event: "calendly_slots_revalidate_failed",
        origine,
        raison: e instanceof Error ? e.message : String(e),
      }),
    );
  }
}
