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

function signer(cleHmac: Buffer, questionnaireId: string, domaine: string = DOMAINE): string {
  return createHmac("sha256", cleHmac).update(`${domaine}${questionnaireId}`).digest("base64url");
}

/**
 * Domaine PROPRE du questionnaire de pré-audit (2026-10-24) : le jeton d'un questionnaire de
 * cadrage n'ouvre jamais un pré-audit, et inversement (même clé, domaines HMAC distincts).
 */
const DOMAINE_PREAUDIT = "questionnaire-preaudit:v1:";

export function jetonPreaudit(id: string): string | null {
  const i = id.toLowerCase();
  if (!UUID.test(i)) return null;
  const k = cle();
  return k === null ? null : signer(k, i, DOMAINE_PREAUDIT);
}

export function jetonPreauditValide(id: string, jeton: string): boolean {
  const i = id.toLowerCase();
  if (!UUID.test(i) || !JETON.test(jeton)) return false;
  const k = cle();
  if (k === null) return false;
  const attendu = Buffer.from(signer(k, i, DOMAINE_PREAUDIT), "utf8");
  const recu = Buffer.from(jeton, "utf8");
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}

/**
 * Code du DIRIGEANT pour le brouillon du pré-audit (2026-10-24) : posé par le serveur dans le lien
 * envoyé au dirigeant (`?m=`), jamais dans les liens des salariés. Domaine HMAC propre : il ne se
 * déduit ni du jeton ni de l'identifiant, donc un salarié qui a le lien de base ne peut pas lire
 * le brouillon du dirigeant.
 */
const DOMAINE_PREAUDIT_DIRIGEANT = "questionnaire-preaudit-dirigeant:v1:";

export function codeDirigeantPreaudit(id: string): string | null {
  const i = id.toLowerCase();
  if (!UUID.test(i)) return null;
  const k = cle();
  return k === null ? null : signer(k, i, DOMAINE_PREAUDIT_DIRIGEANT).slice(0, 24);
}

export function codeDirigeantPreauditValide(id: string, code: string): boolean {
  const attendu = codeDirigeantPreaudit(id);
  if (attendu === null || code.length !== attendu.length) return false;
  return timingSafeEqual(Buffer.from(attendu, "utf8"), Buffer.from(code, "utf8"));
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
