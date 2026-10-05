/**
 * Validation LÉGÈRE du formulaire VSL apporteurs, côté navigateur.
 *
 * ⛔ Aucun import de zod ici : ce module est embarqué dans le JavaScript de la
 * page (île `VslFormulaire`), et zod pèse. Le schéma complet fait foi côté
 * serveur (actions de capture) ; le navigateur ne fait que SAUVER UN ALLER-RETOUR
 * à la personne qui s'est trompée de frappe.
 */

import { VSL_ERREURS, VSL_REPONSES } from "@/content/recrutement/vsl-apporteur-client";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Un téléphone plausible : chiffre ou `+` au début, au moins six caractères utiles. */
export const TELEPHONE_RE = /^\+?[\d\s().-]{6,}$/;

export interface ChampsEtape1 {
  prenom: string;
  email: string;
  consent: boolean;
}

export interface ChampsEtape2 {
  telephone: string;
  reponse: string;
}

export type ErreursEtape1 = Partial<Record<keyof ChampsEtape1, string>>;
export type ErreursEtape2 = Partial<Record<keyof ChampsEtape2, string>>;

export function validerEtape1(c: ChampsEtape1): ErreursEtape1 {
  const e: ErreursEtape1 = {};
  if (!c.prenom.trim()) e.prenom = VSL_ERREURS.prenom;
  const email = c.email.trim();
  if (!email) e.email = VSL_ERREURS.emailVide;
  else if (!EMAIL_RE.test(email)) e.email = VSL_ERREURS.emailInvalide;
  if (!c.consent) e.consent = VSL_ERREURS.consent;
  return e;
}

export function validerEtape2(c: ChampsEtape2): ErreursEtape2 {
  const e: ErreursEtape2 = {};
  const tel = c.telephone.trim();
  if (!tel) e.telephone = VSL_ERREURS.telephoneVide;
  else if (!TELEPHONE_RE.test(tel) || tel.replace(/\D/g, "").length < 6)
    e.telephone = VSL_ERREURS.telephoneInvalide;
  if (!VSL_REPONSES.some((r) => r.id === c.reponse)) e.reponse = VSL_ERREURS.reponse;
  return e;
}

/**
 * Chemin à ouvrir après l'étape 2, sans préfixe de langue (le routeur d'
 * `@/i18n/navigation` le repose). Accepte un chemin relatif, un chemin déjà
 * préfixé (`/fr/…`) ou une URL absolue du MÊME site ; tout le reste retombe sur
 * le repli — jamais de navigation vers un autre domaine.
 */
export function cheminDeMerci(
  merciUrl: string,
  repli: string,
  origine: string | undefined,
): string {
  try {
    const u = new URL(merciUrl, origine ?? "http://localhost");
    if (origine && u.origin !== new URL(origine).origin) return repli;
    const chemin = `${u.pathname.replace(/^\/(?:fr|en)(?=\/|$)/, "") || "/"}${u.search}`;
    return chemin.startsWith("/") && !chemin.startsWith("//") ? chemin : repli;
  } catch {
    return repli;
  }
}

/** Canal réel pour l'événement Plausible (comparable à l'ancienne page). */
export function canalDepuisQuery(search: string): string {
  const m = /[?&]utm_source=([a-z0-9_-]{1,40})/i.exec(search);
  const v = m?.[1]?.toLowerCase();
  return v === "instagram" || v === "linkedin" || v === "facebook" ? v : "facebook";
}
