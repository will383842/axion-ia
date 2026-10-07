/**
 * LE LIEN PRIVÉ d'un envoi de fichiers à une personne (Candidatures unifiées L5, ADR 0065 D6).
 *
 *     https://axion-ia.com/api/partage/<lienId>/<jeton>
 *
 *     jeton = base64url(HMAC-SHA256(PARTAGES_SECRET, "lien-partage:v1:" + lienId))   // 43 caractères
 *
 * Rien n'est stocké : le serveur recalcule le jeton et le compare à temps
 * constant. Clé DÉDIÉE `PARTAGES_SECRET` [C2] — jamais dérivée d'`AUTH_SECRET`,
 * dont une rotation couperait tous les liens envoyés. Domaine séparé
 * (`lien-partage:v1:`) : un jeton de document (ADR 0063) ou de questionnaire
 * (ADR 0062) ne vaut jamais ici, même pour un identifiant identique.
 *
 * ⛔ Sans `PARTAGES_SECRET` (ou trop court), AUCUN lien n'est fabriqué ni
 * valide, en développement comme en production : il n'y a pas de clé de repli
 * connue qui rendrait les liens forgeables.
 *
 * Module léger (`node:crypto` seulement), sans `server-only` : il est atteint
 * par `envoyer-reponse.ts`, que le worker charge aussi.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const DOMAINE = "lien-partage:v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Un HMAC-SHA256 en base64url sans remplissage : 43 caractères. */
const JETON = /^[A-Za-z0-9_-]{43}$/;

/** Le préfixe public des liens (hors `[locale]`, hors `matcher` du proxy). */
export const PREFIXE_LIEN = "/api/partage";

type Env = Readonly<Record<string, string | undefined>>;

function cle(env: Env): string | null {
  const s = env["PARTAGES_SECRET"]?.trim();
  return s && s.length >= 32 ? s : null;
}

function signer(k: string, lienId: string): string {
  return createHmac("sha256", k).update(`${DOMAINE}${lienId}`).digest("base64url");
}

/** Le jeton d'un lien, ou `null` (identifiant invalide, secret absent). */
export function jetonLien(lienId: string, env: Env = process.env): string | null {
  const id = lienId.toLowerCase();
  if (!UUID.test(id)) return null;
  const k = cle(env);
  return k === null ? null : signer(k, id);
}

/** Le jeton est-il celui de CE lien ? Faux pour toute forme inattendue. */
export function jetonLienValide(lienId: string, jeton: string, env: Env = process.env): boolean {
  const id = lienId.toLowerCase();
  if (!UUID.test(id) || !JETON.test(jeton)) return false;
  const k = cle(env);
  if (k === null) return false;
  const attendu = Buffer.from(signer(k, id), "utf8");
  const recu = Buffer.from(jeton, "utf8");
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}

/** Le chemin public, sans origine, ou `null` si aucun jeton ne peut être fabriqué. */
export function cheminLien(lienId: string, env: Env = process.env): string | null {
  const jeton = jetonLien(lienId, env);
  return jeton === null ? null : `${PREFIXE_LIEN}/${lienId.toLowerCase()}/${jeton}`;
}

/** L'adresse complète envoyée par e-mail, ou `null`. */
export function adresseLien(lienId: string, env: Env = process.env): string | null {
  const chemin = cheminLien(lienId, env);
  if (chemin === null) return null;
  const site = (env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com").replace(/\/+$/, "");
  return `${site}${chemin}`;
}
