// V2-11 (GEO) — la date « Mis à jour le … » AFFICHÉE sur une page.
//
// Une seule source avec le `<lastmod>` du sitemap et le `dateModified` du JSON-LD :
// `dateModifiedDeChemin` (`fraicheur.ts`) — date éditoriale tenue à la main, sinon
// dernier commit git des sources de la route (manifeste généré au build). Jamais la
// date du jour : une route inconnue ne rend AUCUNE date (la page n'affiche rien).

import { dateModifiedDeChemin } from "@/lib/seo/fraicheur";

/** Date ISO (AAAA-MM-JJ) de dernière modification d'une route statique, ou `undefined`. */
export function dateAfficheeDeChemin(chemin: string, locale: string): string | undefined {
  const iso = dateModifiedDeChemin(chemin, locale);
  return iso ? iso.slice(0, 10) : undefined;
}

/** « 12 novembre 2026 » — fuseau UTC, donc identique au build et au rendu ISR. */
export function formaterDateAffichee(isoJour: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${isoJour}T00:00:00Z`));
}
