/**
 * Le LIEN PUBLIC d'une page envoyée au client (ADR 0063, D12).
 *
 *     https://axion-ia.com/document/<documentId>/<jeton>
 *
 *     K     = SHA-256("axion-document-projet|" + AUTH_SECRET)
 *     jeton = base64url(HMAC-SHA256(K, "document-projet:v1:" + documentId))   // 43 caractères
 *
 * Rien n'est stocké : le serveur recalcule le jeton et le compare à temps
 * constant. SÉPARATION DE DOMAINE avec le questionnaire en ligne (ADR 0062,
 * `axion-questionnaire-cadrage|…`) : un jeton de questionnaire ne vaut jamais
 * pour un document de même identifiant, et réciproquement. Révocation :
 * l'archivage (la page répond 404). Rotation d'`AUTH_SECRET` : tous les liens
 * s'éteignent.
 *
 * ⛔ Sans `AUTH_SECRET` EN PRODUCTION, aucun lien n'est fabriqué ni valide :
 * une clé de développement connue y rendrait tous les liens forgeables.
 *
 * Module léger : `node:crypto` et `SITE_URL` seulement (modèle :
 * `src/server/email/opposition-jeton.ts`).
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const DOMAINE = "document-projet:v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Un HMAC-SHA256 en base64url sans remplissage : 43 caractères. */
const JETON = /^[A-Za-z0-9_-]{43}$/;

function cle(): Buffer | null {
  const secret = process.env["AUTH_SECRET"];
  if (secret && secret.length > 0) {
    return createHash("sha256").update(`axion-document-projet|${secret}`).digest();
  }
  if (process.env.NODE_ENV === "production") return null;
  return createHash("sha256").update("axion-document-projet|dev").digest();
}

function signer(k: Buffer, documentId: string): string {
  return createHmac("sha256", k).update(`${DOMAINE}${documentId}`).digest("base64url");
}

/** Le jeton d'un document, ou `null` (identifiant invalide, production sans secret). */
export function jetonDocument(documentId: string): string | null {
  const id = documentId.toLowerCase();
  if (!UUID.test(id)) return null;
  const k = cle();
  return k === null ? null : signer(k, id);
}

/** Le jeton est-il celui de CE document ? Faux pour toute forme inattendue. */
export function jetonDocumentValide(documentId: string, jeton: string): boolean {
  const id = documentId.toLowerCase();
  if (!UUID.test(id) || !JETON.test(jeton)) return false;
  const k = cle();
  if (k === null) return false;
  const attendu = Buffer.from(signer(k, id), "utf8");
  const recu = Buffer.from(jeton, "utf8");
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}

/** Le chemin public, sans origine, ou `null` si aucun jeton ne peut être fabriqué. */
export function cheminDocument(documentId: string): string | null {
  const jeton = jetonDocument(documentId);
  return jeton === null ? null : `/document/${documentId.toLowerCase()}/${jeton}`;
}
