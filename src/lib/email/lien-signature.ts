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

/** Gabarits dont le bouton de signature est masqué si le lien est refusé (garde au rendu, worker). */
export const GABARITS_LIEN_SIGNATURE_GARDE: readonly string[] = [
  "devis-envoi",
  "relance-devis-client",
];

/**
 * La garde est-elle active dans CE processus ? Non si `SITE_URL` est local (localhost, 127.0.0.1,
 * [::1]) : le lien y est en `http`, le gabarit n'y affiche jamais de bouton, bloquer serait bloquer
 * sans raison. Une adresse illisible vaut « active ».
 */
export function gardeLienSignatureActive(): boolean {
  try {
    const h = new URL(SITE_URL).hostname;
    return !(h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1");
  } catch {
    return true;
  }
}

/**
 * Vrai si le worker doit REFUSER d'envoyer : gabarit gardé, lien présent (chaîne non vide) mais
 * refusé par `lienSignatureValide` (même verdict que celui qui masquerait le bouton), garde active.
 * Lien absent ou vide : faux (permis). Ne journalise rien, ne lève jamais.
 */
export function lienSignatureRefuseAuRendu(template: string, payload: unknown): boolean {
  if (!GABARITS_LIEN_SIGNATURE_GARDE.includes(template)) return false;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return false;
  const url = (payload as Record<string, unknown>).signatureUrl;
  if (typeof url !== "string" || url.trim() === "") return false;
  if (!gardeLienSignatureActive()) return false;
  return lienSignatureValide(url) === null;
}
