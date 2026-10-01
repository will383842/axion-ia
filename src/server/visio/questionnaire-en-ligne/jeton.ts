/**
 * Le LIEN SECRET d'un questionnaire de cadrage en ligne (2026-10-01).
 *
 * Un lien par questionnaire, donc par projet et par version :
 *
 *     https://axion-ia.com/questionnaire/<questionnaireId>/<jeton>
 *
 * `jeton = base64url(HMAC-SHA256(clé, "questionnaire-cadrage:v1:" + id))`.
 * Rien n'est stocké : le serveur recalcule le jeton et le compare à temps
 * constant. Le lien ne s'éteint pas avec le temps ; il s'éteint avec le
 * questionnaire (`clos`) ou après l'envoi des réponses (`reponse_recue`) —
 * c'est la page qui le décide, pas le jeton.
 *
 * Clé dérivée d'`AUTH_SECRET` avec SÉPARATION DE DOMAINE (même doctrine que
 * `server/email/opposition-jeton.ts` et `dossier-client/message-de-retour.ts`) :
 * `AUTH_SECRET` est déjà exigé en production par `env.ts`, présent sur l'app
 * web (qui sert la page et la console). Compromettre ce jeton ne donne que ce
 * questionnaire-là.
 *
 * ⛔ Sans `AUTH_SECRET` EN PRODUCTION, aucun lien n'est valide (et aucun n'est
 * fabriqué) : une clé de développement connue y rendrait tous les liens
 * forgeables. Hors production, une clé de développement fixe.
 *
 * Module serveur léger : `node:crypto` et `SITE_URL` — ni Prisma, ni `next/headers`.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { SITE_URL } from "@/lib/site-url";

const DOMAINE = "questionnaire-cadrage:v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Un HMAC-SHA256 en base64url sans remplissage : 43 caractères. */
const JETON = /^[A-Za-z0-9_-]{43}$/;

/** La clé HMAC, ou `null` si la production n'a pas de secret (aucun lien valide). */
function cle(): Buffer | null {
  const secret = process.env["AUTH_SECRET"];
  if (secret && secret.length > 0) {
    return createHash("sha256").update(`axion-questionnaire-cadrage|${secret}`).digest();
  }
  if (process.env.NODE_ENV === "production") return null;
  return createHash("sha256").update("axion-questionnaire-cadrage|dev").digest();
}

function signer(cleHmac: Buffer, questionnaireId: string): string {
  return createHmac("sha256", cleHmac).update(`${DOMAINE}${questionnaireId}`).digest("base64url");
}

/** Le jeton d'un questionnaire, ou `null` (production sans secret, identifiant invalide). */
export function jetonQuestionnaire(questionnaireId: string): string | null {
  const id = questionnaireId.toLowerCase();
  if (!UUID.test(id)) return null;
  const k = cle();
  return k === null ? null : signer(k, id);
}

/**
 * Le jeton est-il celui de ce questionnaire ? Comparaison à temps constant.
 * Faux pour toute forme inattendue (longueur, alphabet, identifiant).
 */
export function jetonValide(questionnaireId: string, jeton: string): boolean {
  const id = questionnaireId.toLowerCase();
  if (!UUID.test(id) || !JETON.test(jeton)) return false;
  const k = cle();
  if (k === null) return false;
  const attendu = Buffer.from(signer(k, id), "utf8");
  const recu = Buffer.from(jeton, "utf8");
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}

/** Le chemin public (sans origine), ou `null` si aucun jeton ne peut être fabriqué. */
export function cheminQuestionnaire(questionnaireId: string): string | null {
  const jeton = jetonQuestionnaire(questionnaireId);
  return jeton === null ? null : `/questionnaire/${questionnaireId.toLowerCase()}/${jeton}`;
}

/** L'URL complète que Will met sous le bouton de son e-mail. */
export function urlQuestionnaire(questionnaireId: string): string | null {
  const chemin = cheminQuestionnaire(questionnaireId);
  if (chemin === null) return null;
  // `SITE_URL` (module tier-0) : le domaine réel en production, l'origine locale en développement.
  return `${SITE_URL.replace(/\/+$/, "")}${chemin}`;
}
