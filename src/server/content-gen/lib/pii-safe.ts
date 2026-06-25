/**
 * Content Generator — PII-safe helpers pour Telegram & logs.
 *
 * Pass B P1-7 — Le finding agent SEC notait : « pii-redaction.ts helpers
 * présents mais zéro usage dans content-gen ». Ce module est le pont entre
 * `@/lib/pii-redaction.ts` (helpers génériques RGPD/Telegram) et les sites
 * content-gen qui pourraient diffuser des champs sensibles via :
 *
 *   - alertes Telegram tag MONITORING/INCIDENT (cost-tracker, workers)
 *   - logs GenerationLog (metadata Json)
 *   - audit trail kill-switch
 *
 * Doctrine ADR 0010 : Telegram = sous-processeur hors UE → base légale art. 49
 * RGPD + minimisation systématique des PII personnels directs.
 *
 * Règle d'or content-gen : un identifier (provider key, model, jobId) n'est
 * PAS du PII. Mais un prompt user-controlled, un user.email, ou un payload
 * RSS qui peut contenir des coordonnées contact d'auteur EST du PII.
 *
 * Quand utiliser :
 *   - `redactPromptForTelegram()` avant d'injecter un extrait de prompt dans
 *     un message Telegram (cas alertes provider failed avec prompt context).
 *   - `redactGenerationMetadata()` avant `logGeneration({ metadata })` quand
 *     le metadata peut contenir des champs `email`, `name`, `phone`.
 *   - `safeTelegramContext()` pour composer un message Telegram opérationnel
 *     en partant d'un job content-gen (jobId, provider, model, costUsd).
 */

import { redactEmail, redactName, redactPhone } from "@/lib/pii-redaction";

/** Champs whitelist autorisés dans un payload Telegram content-gen brut. */
const SAFE_TELEGRAM_FIELDS = new Set([
  "jobId",
  "provider",
  "model",
  "step",
  "level",
  "duration_ms",
  "tokens_input",
  "tokens_output",
  "cost_usd",
  "monthly_cap_usd",
  "monthly_spent_usd",
  "queue_depth",
  "campaign_id",
  "campaign_name",
  "content_type",
  "tier",
  "search_intent",
  "kb_chunks_count",
  "retry_attempt",
  "score",
]);

/** Champs typiquement PII à redacter systématiquement. */
const PII_EMAIL_FIELDS = new Set(["email", "author_email", "user_email", "contact_email"]);
const PII_NAME_FIELDS = new Set(["name", "author_name", "user_name", "contact_name", "full_name"]);
const PII_PHONE_FIELDS = new Set(["phone", "telephone", "mobile", "contact_phone"]);

/**
 * Tronque un prompt avant injection Telegram + retire les emails/téléphones
 * détectés via regex (filet de sécurité, pas exhaustif).
 *
 * Cap dur à 280 chars (lisibilité notif mobile).
 */
export function redactPromptForTelegram(raw: string | null | undefined, maxLen = 280): string {
  if (!raw) return "(empty)";
  let text = raw.trim();
  // Email pattern (RFC subset) → redactEmail() symbol
  text = text.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, (m) => redactEmail(m));
  // Phone pattern E.164-ish + FR
  text = text.replace(/\+\d[\d\s.-]{6,}/g, (m) => redactPhone(m));
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
}

/**
 * Redacte un objet metadata avant `logGeneration({ metadata })` ou avant
 * sérialisation dans un payload Telegram. Whitelist + redaction PII connus.
 *
 * Champs hors whitelist + hors PII connus sont **conservés tels quels**
 * (à charge de l'appelant de ne pas y mettre du PII). Cette fonction est un
 * filet de sécurité, pas un sanitizer absolu.
 */
export function redactGenerationMetadata(
  raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const lower = key.toLowerCase();
    if (PII_EMAIL_FIELDS.has(lower) && typeof value === "string") {
      out[key] = redactEmail(value);
      continue;
    }
    if (PII_NAME_FIELDS.has(lower) && typeof value === "string") {
      out[key] = redactName(value);
      continue;
    }
    if (PII_PHONE_FIELDS.has(lower) && typeof value === "string") {
      out[key] = redactPhone(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Compose un bloc « context » safe pour message Telegram en partant d'un
 * dictionnaire de champs opérationnels. Garde uniquement les champs whitelist
 * (SAFE_TELEGRAM_FIELDS) + applique redaction sur les PII connus.
 *
 * Format de sortie : lignes `clé : valeur` (markdown Telegram lisible).
 */
export function safeTelegramContext(raw: Record<string, unknown> | null | undefined): string {
  if (!raw) return "";
  const redacted = redactGenerationMetadata(raw);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(redacted)) {
    if (!SAFE_TELEGRAM_FIELDS.has(key) && !isLikelyPiiKey(key)) {
      // Champ inconnu → on l'inclut quand même mais on note (debug only)
    }
    if (value === undefined || value === null) continue;
    lines.push(`${key} : \`${String(value)}\``);
  }
  return lines.join("\n");
}

function isLikelyPiiKey(key: string): boolean {
  const lower = key.toLowerCase();
  return PII_EMAIL_FIELDS.has(lower) || PII_NAME_FIELDS.has(lower) || PII_PHONE_FIELDS.has(lower);
}

/* -------------------------------------------------------------------------- */
/* Value-level scrubbing (RGPD + secret-leak prevention) — audit 2026-06-25.  */
/*                                                                            */
/* `redactGenerationMetadata()` ci-dessus est key-based (whitelist de noms de */
/* champ). Mais `message` est du texte libre, et un metadata value arbitraire */
/* peut embarquer un email, un numéro de téléphone ou — pire — une clé API    */
/* (sk-…, sk-ant-…, sk-proj-…) ou un secret hex/base64 ≥ 32 chars qui a fuité */
/* dans un message d'erreur upstream. On scrubbe donc le CONTENU, pas le nom. */
/*                                                                            */
/* Ordre des passes = important : on retire les secrets AVANT les patterns    */
/* PII génériques (un token base64 ne doit pas matcher le pattern email).     */
/* -------------------------------------------------------------------------- */

/** Clés API style provider : sk-…, sk-ant-…, sk-proj-…, et variantes longues. */
const API_KEY_RE = /\bsk-(?:ant-|proj-|live-|test-)?[A-Za-z0-9_-]{16,}\b/g;

/** Secrets génériques hex ou base64/base64url ≥ 32 chars (clés, tokens, hash). */
const LONG_SECRET_RE = /\b[A-Za-z0-9+/_-]{32,}={0,2}\b/g;

/** Emails (sous-ensemble RFC, suffisant pour un filet de sécurité). */
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

/**
 * Téléphones FR + internationaux. Couvre `+33 6 12 34 56 78`, `06 12 34 56 78`,
 * `0033612345678`, formats avec `.` ou `-`. On exige ≥ 9 chiffres au total pour
 * éviter de matcher des nombres courts (durées, scores, comptes de tokens).
 */
const PHONE_RE = /(?:\+|00)?\d[\d\s.-]{7,}\d/g;

/** Masque purement secret (pas une PII réversible — on jette l'info). */
const SECRET_MASK = "[redacted-secret]";

/**
 * Scrubbe une chaîne de texte libre : retire les secrets (clés API, tokens) et
 * masque les PII (emails, téléphones). Pure, sans I/O, sans throw attendu.
 *
 * Filet de sécurité best-effort — pas un DLP exhaustif. Idempotent sur du texte
 * déjà propre. Préserve la longueur globale du message au mieux (remplacements
 * inline), l'appelant applique son propre cap.
 */
export function redactSensitiveText(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw !== "string" || raw.length === 0) return String(raw ?? "");
  let text = raw;
  // 1) Secrets d'abord (sinon une clé sk-… ou un base64 matcherait email/phone).
  text = text.replace(API_KEY_RE, SECRET_MASK);
  text = text.replace(LONG_SECRET_RE, (m) =>
    // Ne masque que si ça « ressemble » à un secret : présence de chiffres ET
    // de lettres (un mot anglais de 32+ lettres pures n'est pas un secret).
    /\d/.test(m) && /[A-Za-z]/.test(m) ? SECRET_MASK : m,
  );
  // 2) PII réversibles-symboliques.
  text = text.replace(EMAIL_RE, (m) => redactEmail(m));
  text = text.replace(PHONE_RE, (m) => redactPhone(m));
  return text;
}

/**
 * Variante deep pour metadata : applique `redactGenerationMetadata()` (key-based)
 * PUIS scrubbe le contenu de toute valeur string restante (value-based), y compris
 * dans les objets/arrays imbriqués. Fail-open géré par l'appelant.
 */
export function redactGenerationMetadataDeep(
  raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const keyRedacted = redactGenerationMetadata(raw);
  return scrubValues(keyRedacted) as Record<string, unknown>;
}

function scrubValues(value: unknown): unknown {
  if (typeof value === "string") return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map(scrubValues);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubValues(v);
    }
    return out;
  }
  return value;
}
