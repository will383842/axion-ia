// Tour de France IA — la porte d'aperçu (2026-10-25).
//
// Tant que `TOUR_PUBLIC` est faux, `/tourdefrance-ia…` n'existe pour personne,
// sauf pour qui porte le cookie d'aperçu `tdf_apercu`. Ce cookie ne contient
// pas le jeton : il contient son EMPREINTE SHA-256 (hexadécimale). Le jeton
// lui-même ne vit que dans la variable `TOUR_APERCU_JETON` du serveur, et ne
// passe qu'une fois, dans l'adresse `/api/tourdefrance-ia/apercu?jeton=…`.
//
// 🔴 Variable absente ou vide : la porte reste FERMÉE pour tout le monde. Une
// empreinte de chaîne vide serait un cookie que n'importe qui peut fabriquer.
//
// Module sans import Node : il tourne dans le proxy (Web Crypto) comme dans la
// route d'aperçu et dans les tests.

import { TOUR_PREFIX } from "./visibilite";

/** Le nom du cookie d'aperçu. */
export const COOKIE_APERCU = "tdf_apercu";

/** Durée de vie du cookie d'aperçu : 30 jours. */
export const DUREE_APERCU_SECONDES = 30 * 24 * 60 * 60;

/** Vrai pour `/tourdefrance-ia` et tout ce qui est en dessous — jamais `/tourdefrance-ia-x`. */
export function estCheminDuTour(pathname: string): boolean {
  return pathname === TOUR_PREFIX || pathname.startsWith(`${TOUR_PREFIX}/`);
}

/** L'empreinte SHA-256, en hexadécimal minuscule, d'un texte. */
export async function empreinte(texte: string): Promise<string> {
  const octets = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(octets), (o) => o.toString(16).padStart(2, "0")).join("");
}

/**
 * Comparaison en temps constant de deux chaînes : la durée ne dépend que de la
 * longueur de la plus longue, jamais de la position du premier écart.
 */
export function egalEnTempsConstant(a: string, b: string): boolean {
  const n = Math.max(a.length, b.length);
  let ecart = a.length ^ b.length;
  for (let i = 0; i < n; i++) ecart |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return ecart === 0;
}

/** Le jeton configuré, nettoyé ; `null` s'il est absent ou vide. */
export function jetonConfigure(valeur: string | undefined): string | null {
  const v = valeur?.trim();
  return v ? v : null;
}

/**
 * Le verdict de la porte pour une requête.
 *
 * · `hors-tour` : le chemin n'est pas celui du Tour, la porte ne dit rien ;
 * · `public`    : le Tour est ouvert, la page se sert normalement ;
 * · `apercu`    : Tour fermé, cookie valide — la page se sert, `noindex`, `no-store` ;
 * · `refuser`   : Tour fermé, sans cookie valide (ou sans jeton configuré) — 404.
 */
export type VerdictPorte = "hors-tour" | "public" | "apercu" | "refuser";

export async function verdictDeLaPorte(entree: {
  readonly pathname: string;
  readonly ouvert: boolean;
  readonly cookie: string | undefined;
  readonly jeton: string | undefined;
}): Promise<VerdictPorte> {
  if (!estCheminDuTour(entree.pathname)) return "hors-tour";
  if (entree.ouvert) return "public";
  const jeton = jetonConfigure(entree.jeton);
  if (!jeton || !entree.cookie) return "refuser";
  return egalEnTempsConstant(entree.cookie, await empreinte(jeton)) ? "apercu" : "refuser";
}

/** Les en-têtes d'une réponse du Tour fermé : jamais en cache partagé, jamais indexée. */
export const ENTETES_TOUR_FERME: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

/** La réponse 404 du Tour fermé : texte brut, rien qui trahisse l'existence de la page. */
export function reponseTourIntrouvable(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...ENTETES_TOUR_FERME },
  });
}
