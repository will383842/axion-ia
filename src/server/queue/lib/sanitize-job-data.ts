/**
 * Content Generator — Sanitizer pour payloads de jobs BullMQ avant envoi Sentry.
 *
 * Sprint S+4 action C (audit content-gen deep 2026-05-18 — gap P1-7).
 *
 * Contexte : avant ce helper, aucune capture Sentry n'existait dans les
 * workers content-gen critiques (publish/gen/orchestrator/indexnow). Les seules
 * traces sur fail étaient `console.error` (perdus en prod sans agrégation) et
 * Telegram alertIncident (uniquement business — pas stack traces).
 *
 * Ce module est le pendant de `src/server/content-gen/lib/pii-safe.ts:redactGenerationMetadata`
 * pour le contexte Sentry/BullMQ : redacte emails/tokens/secrets/PII connus
 * AVANT injection dans `Sentry.captureException({ extra: ... })`.
 *
 * Doctrine ADR 0010 + RGPD art. 32 (sécurité du traitement) :
 *   - Sentry SaaS US → minimisation systématique du PII personnel direct
 *   - Tokens API providers (OpenAI/Anthropic/Mistral) → redact total
 *   - Emails utilisateurs / authors RSS → redact partiel (premier char + domaine)
 *   - URLs avec query params (api_key/secret/token) → strip query
 *
 * NB : ce helper est conservatif — quand on hésite, on redacte. Mieux vaut
 * perdre 5 % de contexte debug que leak 1 secret en SaaS US.
 */

const REDACTED = "[REDACTED]";

/** Patterns regex pour détecter et masquer des secrets dans un string libre. */
const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  // API keys génériques (sk-..., pk-..., gh*_, etc.)
  /\b(sk|pk|rk|gh[pousr])[_-][A-Za-z0-9]{20,}\b/g,
  // OpenAI api keys
  /\bsk-[A-Za-z0-9]{32,}\b/g,
  // Anthropic api keys
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  // Bearer tokens
  /\bBearer\s+[A-Za-z0-9._-]{20,}\b/gi,
  // JWT tokens (3-segment base64)
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  // INDEXNOW key (hex 32 chars typique)
  /\b[a-f0-9]{32}\b/gi,
  // Postgres URL passwords (postgres://user:PASSWORD@host)
  /(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/gi,
  // Redis URL passwords
  /(redis:\/\/[^:]+:)[^@]+(@)/gi,
];

/** Noms de clés (case-insensitive) à redacter systématiquement. */
const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "apikey",
  "api_key",
  "api-key",
  "authorization",
  "auth",
  "bearer",
  "cookie",
  "session",
  "sessionid",
  "session_id",
  "sentry_dsn",
  "sentrydsn",
  "openai_api_key",
  "anthropic_api_key",
  "mistral_api_key",
  "perplexity_api_key",
  "indexnow_key",
  "telegram_bot_token",
  "stripe_secret_key",
  "database_url",
  "redis_url",
  "smtp_password",
  "ip_hash_salt",
  "internal_hmac_secret",
  "docuseal_strict_hmac",
]);

/** Noms de clés à redacter via redactEmail (premier char + masque + @domaine). */
const EMAIL_KEYS: ReadonlySet<string> = new Set([
  "email",
  "author_email",
  "authoremail",
  "user_email",
  "useremail",
  "contact_email",
  "contactemail",
  "from",
  "to",
  "recipient",
]);

/** Noms de clés à redacter via redactPhone (préserve indicatif + 4 derniers). */
const PHONE_KEYS: ReadonlySet<string> = new Set([
  "phone",
  "telephone",
  "mobile",
  "contact_phone",
  "contactphone",
]);

/** Cap profondeur récursion (évite explosion sur structures cycliques). */
const MAX_DEPTH = 6;
/** Cap nombre de clés par objet (anti-spam Sentry quota). */
const MAX_KEYS_PER_OBJECT = 50;
/** Cap longueur string (Sentry tronque à ~5 KB par champ extra). */
const MAX_STRING_LEN = 2000;

function redactSecretsInString(raw: string): string {
  let out = raw;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (m, ...args) => {
      // Pour les patterns à 2 groupes (URLs DB/Redis), conserver l'enveloppe.
      if (args.length >= 3 && typeof args[0] === "string" && typeof args[1] === "string") {
        return `${args[0]}${REDACTED}${args[1]}`;
      }
      return REDACTED;
    });
  }
  // Email pattern (filet de sécurité — pour emails dans strings libres)
  out = out.replace(/\b([\w.+-])[\w.+-]*@([\w-]+\.[\w.-]+)\b/g, "$1****@$2");
  return out;
}

/**
 * Masque une adresse : `marie.dupont@exemple.fr` → `m****@exemple.fr`.
 *
 * 🔑 **Exportée** depuis le 2026-08-25, et pas recopiée ailleurs. Le worker
 * e-mail imprimait `job.data.to` **en clair** sur stdout à chaque envoi et à
 * chaque échec — alors que `"to"` figure dans `EMAIL_KEYS` juste au-dessus,
 * c'est-à-dire que ce fichier le classe déjà comme donnée personnelle et le
 * masque avant Sentry. La protection ne couvrait que le canal SaaS, jamais les
 * journaux du conteneur.
 *
 * Le domaine est **conservé** à dessein : c'est lui qui sert au diagnostic (un
 * relais qui refuse tout un domaine), et il n'identifie personne à lui seul.
 */
export function redactEmailValue(raw: string): string {
  const idx = raw.indexOf("@");
  if (idx <= 0 || idx === raw.length - 1) return REDACTED;
  const local = raw.slice(0, idx);
  const domain = raw.slice(idx + 1);
  if (local.length <= 1) return `*@${domain}`;
  return `${local[0]}****@${domain}`;
}

function redactPhoneValue(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  let prefix = "";
  let rest = digits;
  if (digits.startsWith("+")) {
    const m = digits.match(/^(\+\d{1,3})(.*)$/);
    if (m) {
      prefix = m[1] ?? "";
      rest = m[2] ?? "";
    }
  }
  if (rest.length <= 4) return `${prefix}**`;
  return `${prefix}****${rest.slice(-4)}`;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

function isEmailKey(key: string): boolean {
  return EMAIL_KEYS.has(key.toLowerCase());
}

function isPhoneKey(key: string): boolean {
  return PHONE_KEYS.has(key.toLowerCase());
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[MAX_DEPTH]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    const truncated =
      value.length > MAX_STRING_LEN ? `${value.slice(0, MAX_STRING_LEN)}…[truncated]` : value;
    return redactSecretsInString(truncated);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_KEYS_PER_OBJECT).map((v) => sanitizeValue(v, depth + 1));
  }
  if (typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>, depth + 1);
  }
  // function, symbol → drop
  return "[UNSUPPORTED]";
}

function sanitizeObject(obj: Record<string, unknown>, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let keyCount = 0;
  for (const [key, value] of Object.entries(obj)) {
    if (keyCount >= MAX_KEYS_PER_OBJECT) {
      out["[truncated]"] = `…${Object.keys(obj).length - keyCount} more keys`;
      break;
    }
    keyCount++;
    if (isSensitiveKey(key)) {
      out[key] = REDACTED;
      continue;
    }
    if (isEmailKey(key) && typeof value === "string") {
      out[key] = redactEmailValue(value);
      continue;
    }
    if (isPhoneKey(key) && typeof value === "string") {
      out[key] = redactPhoneValue(value);
      continue;
    }
    out[key] = sanitizeValue(value, depth);
  }
  return out;
}

/**
 * Sanitize un payload de job BullMQ avant injection dans Sentry.captureException.
 *
 * Garantit :
 *   - Aucun secret/token connu n'atteint Sentry (URLs DB, API keys, JWT, Bearer)
 *   - Emails/téléphones redactés (premier char + domaine)
 *   - Profondeur cappée à 6 (anti structures cycliques)
 *   - Strings tronqués à 2000 chars (Sentry quota field)
 *   - Max 50 clés/objet (anti spam quota)
 *
 * Retourne `null` si l'entrée n'est pas un objet plain (cohérent avec usage
 * dans `Sentry.captureException({ extra: { jobData: sanitizeJobData(...) } })`
 * où null équivaut à "non disponible").
 */
export function sanitizeJobData(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  if (Array.isArray(raw)) return null;
  return sanitizeObject(raw as Record<string, unknown>, 1);
}
