/**
 * KB V4 — Helper PII scan pour ingest factory.
 *
 * Pattern dérivé de `pii-redaction.ts` existant (redactEmail/Phone/Name) mais
 * en mode DETECT (pas REDACT). Bloque l'ingest si email/phone/IBAN/registry id
 * détecté hors whitelist (références publiques Axion-IA).
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Phone FR : 06/07/08/09 + 8 chiffres avec séparateurs optionnels (espaces, points, tirets)
const PHONE_FR_REGEX = /(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/g;
const IBAN_REGEX = /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g;
const REGISTRY_ID_REGEX = /\b\d{3}\s?\d{3}\s?\d{3}\b/g;

const WHITELIST_EMAILS = [
  "contact@axion-ia.com",
  "dpo@axion-ia.com",
  "support@axion-ia.com",
  "noreply@axion-ia.com",
  "newsletter@axion-ia.com",
];

const WHITELIST_PHONES: readonly string[] = [
  // V1 : aucun téléphone publique Axion-IA. Ajouter ici si publication officielle.
];

const WHITELIST_REGISTRY_IDS: readonly string[] = [
  // V1 : aucun registry id public. Activable V2 si registration FR confirmée.
];

export interface PiiMatch {
  readonly kind: "email" | "phone" | "iban" | "registry_id";
  readonly value: string;
  readonly index: number;
}

export interface PiiScanResult {
  readonly hasPii: boolean;
  readonly matches: readonly PiiMatch[];
}

/**
 * Scanne un texte pour PII non whitelistée.
 * Retourne `hasPii: true` si match hors whitelist.
 */
export function detectPii(text: string): PiiScanResult {
  const matches: PiiMatch[] = [];

  for (const m of text.matchAll(EMAIL_REGEX)) {
    const v = m[0];
    if (!WHITELIST_EMAILS.includes(v.toLowerCase())) {
      matches.push({ kind: "email", value: v, index: m.index ?? 0 });
    }
  }
  for (const m of text.matchAll(PHONE_FR_REGEX)) {
    const v = m[0];
    if (!WHITELIST_PHONES.includes(v.replace(/[\s.-]/g, ""))) {
      matches.push({ kind: "phone", value: v, index: m.index ?? 0 });
    }
  }
  for (const m of text.matchAll(IBAN_REGEX)) {
    matches.push({ kind: "iban", value: m[0], index: m.index ?? 0 });
  }
  for (const m of text.matchAll(REGISTRY_ID_REGEX)) {
    const normalized = m[0].replace(/\s/g, "");
    if (!WHITELIST_REGISTRY_IDS.includes(normalized)) {
      matches.push({ kind: "registry_id", value: m[0], index: m.index ?? 0 });
    }
  }

  return { hasPii: matches.length > 0, matches };
}
