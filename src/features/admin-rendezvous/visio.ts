/**
 * « Rejoindre la visio » depuis la console (2026-09-27).
 *
 * ## Le besoin
 *
 * Will lançait ses visios en allant chercher le lien dans Google Agenda ou dans
 * l'e-mail Calendly. La console connaissait pourtant ce lien depuis la
 * réservation — colonne `location` — mais ne le montrait nulle part sous une
 * forme cliquable.
 *
 * ## Pourquoi le bouton passe par la console au lieu de pointer sur le lien
 *
 * Mesuré en production le 2026-09-27 sur le rendez-vous TELEOS du 28/09 : ce
 * que Calendly enregistre n'est PAS le lien Meet, c'est une redirection
 * Calendly (`https://calendly.com/events/<uuid>/google_meet` → 302 →
 * `https://meet.google.com/wts-pffy-ktm`). Et cette redirection **jette la
 * chaîne de requête** : `?authuser=…` posé sur le lien Calendly n'arrive pas
 * chez Google (vérifié au `curl -I`).
 *
 * Or c'est `authuser` qui fait ouvrir Meet sur le BON compte Google — celui qui
 * organise, donc celui qui fait entrer les invités sans « demander à
 * participer ». La route `/api/admin/appels/[id]/visio` suit donc la
 * redirection côté serveur, pose `authuser` sur le vrai lien Meet, et renvoie
 * le navigateur dessus. Aucune vérification à faire de la part de Will.
 *
 * Le compte organisateur n'est pas écrit en dur : il est lu dans la charge
 * Calendly (`event.event_memberships[].user_email`), qui nomme l'hôte réel.
 */

/** Le bouton passe en évidence ce nombre de minutes avant le début. */
export const MINUTES_AVANT_VISIO = 10;

/** Marge après le début quand l'heure de fin est inconnue (appel client : 45 min). */
const DUREE_PAR_DEFAUT_MINUTES = 60;

/**
 * Le lieu est-il un lien de visio qu'on peut ouvrir ?
 *
 * `https` seulement : `location` est modifiable à la main dans la fiche, et un
 * `javascript:` ou un `http:` n'a rien à faire derrière un bouton. Une adresse
 * postale ou un numéro de téléphone ne sont pas des URL : ils rendent `false`.
 */
export function estLienVisio(location: string | null | undefined): boolean {
  if (!location) return false;
  try {
    return new URL(location.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

/** L'adresse de la route qui ouvre la visio d'un rendez-vous Calendly. */
export function hrefRejoindreVisio(calendlyEventId: string): string {
  return `/api/admin/appels/${encodeURIComponent(calendlyEventId)}/visio`;
}

/** L'adresse de la route, ou `null` quand le rendez-vous n'a pas de lien de visio. */
export function lienRejoindreVisio(
  calendlyEventId: string,
  location: string | null | undefined,
): string | null {
  return estLienVisio(location) ? hrefRejoindreVisio(calendlyEventId) : null;
}

function evenementBrut(rawPayload: unknown): Record<string, unknown> | null {
  if (typeof rawPayload !== "object" || rawPayload === null) return null;
  const ev = (rawPayload as Record<string, unknown>)["event"];
  return typeof ev === "object" && ev !== null ? (ev as Record<string, unknown>) : null;
}

function emails(liste: unknown, champ: string): string[] {
  if (!Array.isArray(liste)) return [];
  return liste.flatMap((x) => {
    const v = typeof x === "object" && x !== null ? (x as Record<string, unknown>)[champ] : null;
    return typeof v === "string" && v.includes("@") ? [v.trim()] : [];
  });
}

/** Le compte Google de l'hôte Calendly — celui qui organise la visio. */
export function compteOrganisateur(rawPayload: unknown): string | null {
  return emails(evenementBrut(rawPayload)?.["event_memberships"], "user_email")[0] ?? null;
}

/**
 * Les personnes que l'invité a ajoutées lui-même à la réservation.
 *
 * La colonne `inviteeEmail` ne porte que l'invité principal ; les autres ne
 * vivent que dans la charge brute (`event.event_guests`). Sur TELEOS : Philippe
 * Legrand en invité principal, un collègue en invité supplémentaire.
 */
export function invitesSupplementaires(rawPayload: unknown): string[] {
  return emails(evenementBrut(rawPayload)?.["event_guests"], "email");
}

/**
 * La redirection Calendly vers la conférence, qu'on sait suivre côté serveur.
 *
 * Seule URL que la route accepte d'appeler : `location` est modifiable à la
 * main, et une route qui irait chercher n'importe quelle adresse saisie serait
 * une porte ouverte sur le réseau interne.
 */
export function estRedirectionCalendly(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" && u.hostname === "calendly.com" && u.pathname.startsWith("/events/")
    );
  } catch {
    return false;
  }
}

/**
 * Pose le compte Google sur un lien Meet (`?authuser=`).
 *
 * Sans effet sur un lien qui n'est pas Meet (Zoom, Teams…) ou sans compte connu.
 */
export function avecCompteGoogle(url: string, compte: string | null): string {
  if (!compte) return url;
  try {
    const u = new URL(url);
    if (u.hostname !== "meet.google.com") return url;
    u.searchParams.set("authuser", compte);
    return u.toString();
  } catch {
    return url;
  }
}

export type MomentVisio = "a-venir" | "imminente" | "terminee";

/**
 * Où en est la visio par rapport à maintenant.
 *
 * · `imminente` — de 10 minutes avant le début jusqu'à la fin : le bouton passe
 *   en évidence ;
 * · `terminee` — après la fin : le bouton disparaît, rejoindre une salle vide
 *   n'aide personne ;
 * · `a-venir` — le reste du temps : le bouton est là, discret.
 */
export function momentVisio(
  debut: Date | null,
  fin: Date | null,
  maintenant: Date = new Date(),
): MomentVisio {
  if (!debut) return "a-venir";
  const t = maintenant.getTime();
  const finEffective = fin ?? new Date(debut.getTime() + DUREE_PAR_DEFAUT_MINUTES * 60_000);
  if (t > finEffective.getTime()) return "terminee";
  if (t >= debut.getTime() - MINUTES_AVANT_VISIO * 60_000) return "imminente";
  return "a-venir";
}
