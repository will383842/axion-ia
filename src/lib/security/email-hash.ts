/**
 * Index de recherche pour les e-mails chiffrés au repos.
 *
 * ── Le problème que ça résout ─────────────────────────────────────────────
 * `Submission.contactEmail` est chiffré en AES-256-GCM avec un vecteur
 * d'initialisation ALÉATOIRE (`src/lib/pii-crypto.ts`). Deux chiffrements du
 * même e-mail produisent donc deux valeurs différentes, et
 * `where: { contactEmail: "jean@exemple.fr" }` ne peut JAMAIS correspondre à
 * une ligne chiffrée.
 *
 * Conséquence observée en production le 2026-08-12 : l'export RGPD (art. 15)
 * renvoyait une liste VIDE et l'effacement (art. 17) anonymisait ZÉRO ligne —
 * tous deux en répondant « succès ». Une panne silencieuse sur une obligation
 * légale. La colonne d'index était prévue dès l'introduction du chiffrement
 * (« contactEmailHash, non livré V1 ») mais n'avait jamais été créée.
 *
 * ── Pourquoi un HMAC et pas un simple SHA-256 ─────────────────────────────
 * Un SHA-256 nu d'adresse e-mail se casse en quelques secondes : l'espace des
 * adresses plausibles est petit et des tables précalculées existent. Un HMAC
 * clé rend l'index inutilisable pour qui obtiendrait un dump de la base sans
 * le secret — ce qui est précisément le scénario contre lequel le chiffrement
 * au repos protège. Il serait absurde de chiffrer la colonne puis d'exposer
 * un index qui la trahit.
 *
 * ── Pourquoi PAS de nouveau secret ────────────────────────────────────────
 * Le secret est DÉRIVÉ de `PII_ENCRYPTION_KEY`, déjà obligatoire en
 * production, par séparation de domaine (préfixe fixe dans le message). Un
 * secret supplémentaire aurait dû être posé à la main en production : oublié,
 * il aurait re-cassé la recherche EN SILENCE, exactement le défaut qu'on
 * corrige ici.
 *
 * ── Pourquoi pas de troncature ────────────────────────────────────────────
 * `hashIp` tronque à 64 bits car une collision y est sans conséquence. Ici une
 * collision livrerait les données d'une personne à une autre lors d'un export
 * RGPD. On garde donc les 256 bits entiers.
 */

import { createHmac } from "node:crypto";

/** Sépare l'usage « index e-mail » de tout autre usage de la clé racine. */
const DOMAIN = "submission-email-index-v1";

const DEFAULT_DEV_KEY = "axion-ia-dev-only-do-not-use-in-prod";

/**
 * Normalise une adresse avant hachage.
 *
 * 🔴 Cette normalisation est un CONTRAT : elle doit être identique à
 * l'écriture et à la lecture, sinon la recherche échoue de nouveau en
 * silence. Elle reproduit ce que fait déjà Zod à la saisie (`.trim()` +
 * `.toLowerCase()`) et ce que garantit la colonne `citext` de Postgres.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Empreinte déterministe d'une adresse e-mail, utilisable comme clé de
 * recherche SQL.
 *
 * @returns 64 caractères hexadécimaux, ou `null` si l'adresse est vide.
 */
export function hashEmailForLookup(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = normalizeEmail(email);
  if (normalized.length === 0) return null;

  // ⚠️ Test de VÉRACITÉ, pas `??` : une variable d'environnement définie mais
  // VIDE — cas courant quand une clé est déclarée sans valeur dans Coolify —
  // n'est pas nullish. Avec `??`, elle aurait servi de clé HMAC telle quelle,
  // produisant des empreintes incompatibles avec toutes les lignes existantes,
  // et le garde-fou de production ci-dessous ne se serait jamais déclenché.
  const configuree = process.env.PII_ENCRYPTION_KEY?.trim();
  const key = configuree && configuree.length > 0 ? configuree : DEFAULT_DEV_KEY;
  if (key === DEFAULT_DEV_KEY && process.env.NODE_ENV === "production") {
    // Fail-loud : un index calculé avec la clé de développement serait
    // silencieusement incompatible avec les lignes existantes.
    throw new Error("PII_ENCRYPTION_KEY manquant en production (index e-mail RGPD).");
  }

  return createHmac("sha256", key).update(`${DOMAIN}:${normalized}`).digest("hex");
}
