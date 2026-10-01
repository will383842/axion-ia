/**
 * Le LIEN d'un document de projet (ADR 0063, D3) : `https://` seulement.
 *
 * `validerLienHttps` est le miroir du CHECK `documents_projet_lien_https`
 * (`^https://hôte-sans-@…`, sans espace ni caractère de contrôle, 2 000
 * caractères au plus) : ce que le code accepte, la base l'accepte — test
 * `__tests__/un-lien-n-est-accepte-qu-en-https.spec.ts`, qui rejoue la même
 * table de cas contre le motif lu dans la migration. Le code peut refuser
 * PLUS tôt que la base, jamais l'inverse.
 *
 * Module pur.
 */

export const LONGUEUR_MAX_LIEN = 2000;

/** Miroir JavaScript du motif POSIX du CHECK. */
const MOTIF_BASE = /^https:\/\/[^/?#@\s\x00-\x1f\x7f]+([/?#][^\s\x00-\x1f\x7f]*)?$/;

export type VerdictLien =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly raison: "vide" | "pas_https" | "illisible" | "trop_long" };

/** Le lien tel que Will l'a collé (sans les blancs autour), ou la raison du refus. */
export function validerLienHttps(texte: string): VerdictLien {
  const brut = texte.trim();
  if (brut === "") return { ok: false, raison: "vide" };
  if (brut.length > LONGUEUR_MAX_LIEN) return { ok: false, raison: "trop_long" };
  if (!/^https:\/\//i.test(brut)) return { ok: false, raison: "pas_https" };
  // Le CHECK est sensible à la casse : « HTTPS:// » est ramené à « https:// ».
  const url = `https://${brut.slice("https://".length)}`;
  let lu: URL;
  try {
    lu = new URL(url);
  } catch {
    return { ok: false, raison: "illisible" };
  }
  if (lu.protocol !== "https:" || lu.username !== "" || lu.password !== "" || lu.hostname === "")
    return { ok: false, raison: "illisible" };
  if (!MOTIF_BASE.test(url)) return { ok: false, raison: "illisible" };
  return { ok: true, url };
}

/** Le nom du site, sans `www.` (« axion-ia.com »), ou `null` si l'adresse est illisible. */
export function domaineDuLien(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Titre par défaut d'un lien : le domaine suivi du chemin raccourci (« axion-ia.com/…/console-exemple »). */
export function titreDepuisLien(url: string): string {
  const domaine = domaineDuLien(url) ?? "Lien";
  let segments: string[] = [];
  try {
    segments = new URL(url).pathname.split("/").filter((s) => s !== "");
  } catch {
    // domaine seul
  }
  const dernier = segments.at(-1);
  let titre = domaine;
  if (dernier !== undefined) {
    let lisible = dernier;
    try {
      lisible = decodeURIComponent(dernier);
    } catch {
      // segment mal encodé : tel quel
    }
    titre = segments.length === 1 ? `${domaine}/${lisible}` : `${domaine}/…/${lisible}`;
  }
  return titre.slice(0, 200);
}
