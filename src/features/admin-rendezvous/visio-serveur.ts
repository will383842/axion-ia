/**
 * Résoudre le lien d'une visio Calendly — CÔTÉ SERVEUR (déplacé de la route
 * `api/admin/appels/[id]/visio` le 2026-09-29, chantier visio PR 4).
 *
 * Calendly enregistre, comme lieu d'un rendez-vous Meet, une REDIRECTION
 * (`https://calendly.com/events/<uuid>/google_meet` → 302 → le vrai lien Meet)
 * qui jette `?authuser=` (voir `visio.ts`). On la suit donc ici, une fois,
 * sans suivre plus loin.
 *
 * ## La liste blanche vit DANS la fonction
 *
 * `location` est modifiable à la main dans la fiche : une fonction qui
 * irait chercher n'importe quelle adresse saisie serait une porte ouverte sur
 * le réseau interne du serveur. `resoudreConference` REFUSE donc elle-même
 * tout ce qui n'est pas une redirection Calendly (`estRedirectionCalendly`) —
 * l'appelant n'a plus à y penser — et ne rend qu'un lien `https`.
 *
 * Le module part d'ici pour être réutilisé (extension Meet, PR 5 : le code
 * Meet d'une rencontre Calendly) sans recopier la règle.
 */

import * as Sentry from "@sentry/nextjs";

import { estLienVisio, estRedirectionCalendly } from "./visio";

/** Au-delà, on renonce : le lien Calendly mène quand même à la salle. */
export const DELAI_RESOLUTION_MS = 5_000;

/**
 * Suit la redirection Calendly jusqu'à la conférence. `null` si l'adresse
 * n'est pas une redirection Calendly (liste blanche), ou si Calendly ne
 * répond pas une redirection `https` exploitable.
 */
export async function resoudreConference(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  if (!estRedirectionCalendly(url)) return null;
  try {
    const res = await fetcher(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(DELAI_RESOLUTION_MS),
      cache: "no-store",
    });
    await res.body?.cancel();
    const cible = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !cible) return null;
    const absolue = new URL(cible, url).toString();
    return estLienVisio(absolue) ? absolue : null;
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "appels-visio", etape: "resolution" } });
    return null;
  }
}
