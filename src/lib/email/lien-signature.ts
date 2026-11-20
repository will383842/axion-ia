// Lien de signature admis dans un e-mail de devis (premier envoi et relance).

import { SITE_URL } from "@/lib/site-url";

/**
 * Lien de signature admis : exactement ce que le code vérifie, rien de plus.
 *  - `https:` ; même hôte (avec port) que `SITE_URL` (`@/lib/site-url`), la source qui FABRIQUE le
 *    lien (`publicUrl()`), et non `BASE_URL` du gabarit commun, qui peut différer ;
 *  - ni identifiant ni mot de passe, ni `?…`, ni `#…` ;
 *  - chemin `[/fr|/en]/portail/signer/<jeton>` où le jeton est de la forme réelle
 *    `<base64url>.<base64url>` (lettres, chiffres, `_`, `-`, `.`).
 * Toute analyse impossible (`new URL()` lève) vaut refus.
 * Renvoie l'URL NORMALISÉE (`href`, espaces de bord retirés) ou `null` : c'est elle, et non la
 * valeur brute, qui sert de `href` au bouton.
 */
const CHEMIN_SIGNATURE = /^(\/(fr|en))?\/portail\/signer\/[A-Za-z0-9_.-]+$/;

export function lienSignatureValide(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  try {
    const u = new URL(valeur);
    const ok =
      u.protocol === "https:" &&
      u.host === new URL(SITE_URL).host &&
      u.username === "" &&
      u.password === "" &&
      u.search === "" &&
      u.hash === "" &&
      CHEMIN_SIGNATURE.test(u.pathname);
    return ok ? u.href : null;
  } catch {
    return null;
  }
}
