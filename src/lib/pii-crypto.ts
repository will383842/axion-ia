/**
 * PII at-rest encryption helper — AES-256-GCM application-level.
 *
 * Méta-cert 2026-05-15 AGENT 12 P0 OWASP A02 — chiffrement applicatif des
 * champs PII Submission (contactEmail / contactName / contactPhone).
 *
 * Format ciphertext : `enc:v1:<iv-hex>:<ciphertext-hex>:<tag-hex>`
 *   - `enc:v1:` préfixe versionné permet :
 *     a) de détecter cleartext legacy (rows pré-migration) → renvoyer en l'état
 *     b) future migration `enc:v2:` (rotation de clé) sans casser v1
 *   - `iv-hex` : IV 12 bytes (96 bits) random pour chaque encrypt — recommandation NIST
 *     SP 800-38D §8.2.1.1 pour AES-GCM.
 *   - `ciphertext-hex` : ciphertext brut
 *   - `tag-hex` : authentication tag 16 bytes (128 bits)
 *
 * Sécurité :
 *   - AES-256-GCM (Node `crypto` natif, fips-compatible)
 *   - IV random 12 bytes via `crypto.randomBytes` (CSPRNG)
 *   - Authentication tag vérifiée à chaque decrypt → throw si tampering
 *   - Pas d'AAD (Associated Authenticated Data) en V1 — pourrait être ajouté
 *     V2 si on veut binder le ciphertext à un Submission.id (anti row-swap).
 *
 * Stratégie clé :
 *   - `PII_ENCRYPTION_KEY` = 64 chars hex (32 bytes / 256 bits)
 *   - En dev sans clé → pass-through cleartext (fallback gracieux, warn log).
 *   - En prod sans clé → fail-fast au boot via `env.ts` superRefine.
 *
 * Rotation de clé : nécessite re-encrypt mass des rows existants (V2 sprint
 * dédié). Pour V1, la clé est figée — gardée 1Password + papier.
 *
 * Limites V1 :
 *   - Lookups exact-match par champ chiffré IMPOSSIBLES (ex. `WHERE contactEmail = 'x@y.com'`
 *     ne marche plus). `Submission.contactEmail` est `@db.Citext` historiquement
 *     pour matchs case-insensitive. Pour préserver les lookups admin, on
 *     introduit `contactEmailHash` (SHA-256 + IP_HASH_SALT) parallèle V1.5 — non
 *     livré V1. Le V1 chiffre uniquement pour `at-rest` (DB compromise scenario)
 *     mais le code applicatif lit en clair via `decryptPii()` après fetch.
 *
 * Référence : OWASP Top 10 2026 A02 Cryptographic Failures.
 */

import * as crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX_V1 = "enc:v1:";

// Lecture directe `process.env` (pas via `env` t3-validator) pour rester
// compatible Vitest (t3-env throw "client-side detected" en test sans
// NEXT_RUNTIME set). La validation production-strict est faite côté
// `env.ts` superRefine au boot — ce helper s'en fie pour les invariants.
function getKey(): Buffer | null {
  const hex = process.env["PII_ENCRYPTION_KEY"];
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

/**
 * Chiffre un plaintext PII. Si la clé est absente (dev fallback) → retourne
 * le plaintext inchangé (avec warn une seule fois).
 *
 * `null` et string vide retournent inchangés (pas de pollution `enc:v1:` sur
 * des valeurs vides).
 */
let warnedNoKey = false;
export function encryptPii<T extends string | null | undefined>(plaintext: T): T {
  if (plaintext == null) return plaintext;
  if (plaintext === "") return plaintext;
  // Déjà chiffré : éviter double-encrypt (idempotent).
  if (typeof plaintext === "string" && plaintext.startsWith(PREFIX_V1)) return plaintext;

  const key = getKey();
  if (!key) {
    if (!warnedNoKey) {
      console.warn(
        "[pii-crypto] PII_ENCRYPTION_KEY absent — PII stored cleartext (dev mode). " +
          "Set the env var to enable AES-256-GCM at-rest encryption.",
      );
      warnedNoKey = true;
    }
    return plaintext;
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX_V1}${iv.toString("hex")}:${ciphertext.toString("hex")}:${tag.toString("hex")}` as T;
}

/**
 * Placeholder renvoyé par `decryptPii()` quand un ciphertext `enc:v1:` est
 * présent mais que la clé `PII_ENCRYPTION_KEY` est absente. Exporté pour que
 * les appelants (envoi d'email, etc.) détectent un déchiffrement raté sans
 * dépendre d'une chaîne codée en dur.
 */
export const PII_DECRYPT_PLACEHOLDER = "[encrypted — key missing]";

/**
 * `true` si `value` est une adresse email exploitable : non vide, pas le
 * placeholder de déchiffrement raté, et de forme email plausible. Garde à
 * utiliser AVANT d'envoyer un email vers une adresse PII déchiffrée (sinon on
 * envoie vers le placeholder → rejet SMTP → « Échec envoi »).
 */
export function isDecryptedEmailUsable(value: string | null | undefined): boolean {
  if (!value) return false;
  if (value === PII_DECRYPT_PLACEHOLDER) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Déchiffre une valeur PII. Si la valeur n'a pas le préfixe `enc:v1:` ou si
 * la clé est absente → retourne inchangé (compat cleartext legacy).
 *
 * Throw `Error` si tampering détecté (authentication tag fail) — caller doit
 * catch et logger une alerte sécu critique (potentielle compromission DB).
 */
export function decryptPii<T extends string | null | undefined>(value: T): T {
  if (value == null) return value;
  if (value === "") return value;
  if (typeof value !== "string") return value;
  if (!value.startsWith(PREFIX_V1)) return value; // cleartext legacy

  const key = getKey();
  if (!key) {
    // Clé absente mais ciphertext présent : impossible de décrypter. Renvoyer
    // un placeholder explicite plutôt que throw (ne pas casser les pages admin
    // si un dev oublie de set la clé).
    return PII_DECRYPT_PLACEHOLDER as T;
  }

  const parts = value.slice(PREFIX_V1.length).split(":");
  if (parts.length !== 3) {
    throw new Error(
      `[pii-crypto] invalid ciphertext format (expected 3 parts, got ${parts.length})`,
    );
  }
  const [ivHex, ctHex, tagHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ctHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  if (iv.length !== IV_BYTES) throw new Error("[pii-crypto] IV length mismatch");
  if (tag.length !== TAG_BYTES) throw new Error("[pii-crypto] tag length mismatch");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8") as T;
}

/**
 * Helper batch — chiffre un objet PII (typiquement les 3 champs Submission).
 * Idempotent : valeurs déjà chiffrées passent inchangées.
 */
export function encryptPiiObject<
  T extends {
    contactEmail?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
  },
>(obj: T): T {
  return {
    ...obj,
    ...(obj.contactEmail !== undefined ? { contactEmail: encryptPii(obj.contactEmail) } : {}),
    ...(obj.contactName !== undefined ? { contactName: encryptPii(obj.contactName) } : {}),
    ...(obj.contactPhone !== undefined ? { contactPhone: encryptPii(obj.contactPhone) } : {}),
  };
}

/** Helper batch déchiffrement (admin read-side). */
export function decryptPiiObject<
  T extends {
    contactEmail?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
  },
>(obj: T): T {
  return {
    ...obj,
    ...(obj.contactEmail !== undefined ? { contactEmail: decryptPii(obj.contactEmail) } : {}),
    ...(obj.contactName !== undefined ? { contactName: decryptPii(obj.contactName) } : {}),
    ...(obj.contactPhone !== undefined ? { contactPhone: decryptPii(obj.contactPhone) } : {}),
  };
}

/**
 * Détection rapide d'une valeur chiffrée (pour log/debug + future migration
 * batch re-encrypt v2).
 */
export function isEncryptedPii(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(PREFIX_V1);
}
