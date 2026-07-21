// Sentry PII scrubber — RGPD Art. 32.
//
// Audit E2E 2026-05-11 (P0-CONF-06) : les 3 configs Sentry n'avaient ni
// `sendDefaultPii: false` ni `beforeSend`. Conséquence : IP, cookies, headers
// Authorization, query strings avec tokens, et breadcrumbs `console.log`
// remontaient vers Sentry SaaS par défaut.
//
// Partagé entre `sentry.server.config.ts`, `sentry.edge.config.ts`,
// `instrumentation-client.ts`. Pas d'import Node-only — Edge-compatible.

import type { ErrorEvent, EventHint, NodeOptions } from "@sentry/nextjs";

/**
 * Type de l'événement de transaction, DÉRIVÉ de l'option Sentry elle-même.
 *
 * `@sentry/nextjs` ne réexporte pas `TransactionEvent`, et l'importer depuis
 * `@sentry/core` reviendrait à dépendre d'un paquet transitif. Le dériver garde
 * la signature exacte, quelle que soit la version.
 */
type TransactionEvent = Parameters<NonNullable<NodeOptions["beforeSendTransaction"]>>[0];

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const PHONE_RE = /\+?\d[\d\s().-]{8,}\d/g;
const HEX_TOKEN_RE = /\b[a-f0-9]{32,}\b/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
/**
 * Jeton maison `<payload>.<signature>` en base64url (`magic-token.ts`).
 *
 * 🔴 Il échappait aux DEUX filtres précédents : il n'est pas hexadécimal
 * (`HEX_TOKEN_RE`) et n'a que deux segments, pas trois (`JWT_RE`). Un jeton
 * d'émargement reste valable jusqu'à la fin de session + 48 h : le laisser
 * partir chez Sentry, c'est offrir à un sous-traitant hors UE la capacité de
 * signer une feuille de présence à la place d'un stagiaire.
 *
 * Les bornes exigent au moins 20 caractères par segment pour ne pas mordre sur
 * du texte ordinaire contenant un point.
 */
const MAGIC_TOKEN_RE = /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g;

const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-csrf-token",
  "x-auth-token",
  "x-api-key",
  "proxy-authorization",
]);

const SENSITIVE_QUERY_KEYS = new Set(["token", "auth", "key", "secret", "code", "pwd", "password"]);

/**
 * Routes dont un SEGMENT de chemin est un secret.
 *
 * Une liste explicite plutôt qu'une heuristique : se tromper ici, c'est soit
 * exporter un jeton valide, soit rendre les URL illisibles au débogage.
 */
const SEGMENTS_SECRETS: ReadonlyArray<RegExp> = [
  /(\/portail\/emarger\/)[^/?#]+/gi,
  /(\/booking\/)[^/?#]+/gi,
  /(\/verifier-attestation\/)[^/?#]+/gi,
  /(\/portail\/acces\/)[^/?#]+/gi,
];

/** Remplace le segment secret de ces routes par `[TOKEN]`, en gardant la route lisible. */
function masquerSegmentsSensibles(url: string): string {
  let out = url;
  for (const re of SEGMENTS_SECRETS) out = out.replace(re, "$1[TOKEN]");
  return out;
}

function redactString(input: unknown): unknown {
  if (typeof input !== "string") return input;
  return input
    .replace(JWT_RE, "[JWT]")
    .replace(MAGIC_TOKEN_RE, "[TOKEN]")
    .replace(EMAIL_RE, "[EMAIL]")
    .replace(IPV4_RE, "[IP]")
    .replace(PHONE_RE, "[PHONE]")
    .replace(HEX_TOKEN_RE, "[TOKEN]");
}

function redactRecord(
  rec: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!rec) return rec;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    const kl = k.toLowerCase();
    if (SENSITIVE_HEADER_KEYS.has(kl) || SENSITIVE_QUERY_KEYS.has(kl)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactString(v);
    }
  }
  return out;
}

/**
 * `beforeSend` hook qui scrub email / IP / phone / JWT / hex tokens dans :
 *  - exception messages + stack frames (vars locales)
 *  - request headers / query / cookies
 *  - breadcrumbs (data + message)
 *  - user.email / user.ip_address / user.username
 *  - extra / tags / contexts
 *
 * Renvoie `null` pour drop l'event si on détecte un secret connu non-scrubable.
 */
export function piiScrubBeforeSend(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  // 1. user
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  // 2. request
  if (event.request) {
    // 🔴 L'URL n'était pas nettoyée, alors que nos jetons vivent dans le
    // CHEMIN, pas dans la query : `/portail/emarger/<payload>.<signature>`,
    // `/booking/<token>/cancel`. `redactString` seul ne suffit pas — un segment
    // de chemin n'a pas de clé à reconnaître — d'où le masquage structurel des
    // routes concernées, appliqué AVANT la passe générique.
    if (typeof event.request.url === "string") {
      event.request.url = redactString(masquerSegmentsSensibles(event.request.url)) as string;
    }
    event.request.headers = redactRecord(
      event.request.headers as Record<string, unknown>,
    ) as Record<string, string>;
    if (typeof event.request.query_string === "string") {
      event.request.query_string = redactString(event.request.query_string) as string;
    }
    event.request.cookies = redactRecord(
      event.request.cookies as Record<string, unknown>,
    ) as Record<string, string>;
    event.request.data =
      typeof event.request.data === "string"
        ? redactString(event.request.data)
        : redactRecord(event.request.data as Record<string, unknown>);
  }

  // 3. exception messages + values
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = redactString(ex.value) as string;
      if (ex.stacktrace?.frames) {
        for (const frame of ex.stacktrace.frames) {
          if (frame.vars) frame.vars = redactRecord(frame.vars) ?? {};
        }
      }
    }
  }

  // 4. breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => {
      const next = { ...b };
      if (typeof b.message === "string") {
        next.message = redactString(b.message) as string;
      }
      const redactedData = redactRecord(b.data);
      if (redactedData !== undefined) {
        next.data = redactedData;
      }
      return next;
    });
  }

  // 5. extra + tags + contexts
  if (event.extra) event.extra = redactRecord(event.extra) ?? {};
  if (event.tags)
    event.tags = redactRecord(event.tags as Record<string, unknown>) as Record<string, string>;

  // 6. server_name (peut contenir hostname interne)
  if (event.server_name) event.server_name = "[server]";

  return event;
}

/**
 * Même nettoyage, pour les TRANSACTIONS.
 *
 * 🔴 `beforeSend` ne couvre QUE les erreurs. Les transactions de performance
 * portent elles aussi `request.url` et un nom de transaction dérivé du chemin :
 * avec un échantillonnage actif, un jeton d'émargement partirait chez Sentry
 * sans qu'aucune erreur ne se soit produite.
 *
 * On ne nettoie ici que ce qui peut contenir un secret — l'URL, le nom de la
 * transaction et les données jointes. Toucher aux mesures de performance
 * n'aurait aucun intérêt et rendrait le traçage inutilisable.
 */
export function piiScrubBeforeSendTransaction(
  event: TransactionEvent,
  _hint?: EventHint,
): TransactionEvent | null {
  if (typeof event.transaction === "string") {
    event.transaction = masquerSegmentsSensibles(event.transaction);
  }
  if (event.request) {
    if (typeof event.request.url === "string") {
      event.request.url = redactString(masquerSegmentsSensibles(event.request.url)) as string;
    }
    if (typeof event.request.query_string === "string") {
      event.request.query_string = redactString(event.request.query_string) as string;
    }
    // `exactOptionalPropertyTypes` : on n'affecte que si le nettoyage a produit
    // quelque chose, sinon on écraserait une clé absente par `undefined`.
    const entetes = redactRecord(event.request.headers as Record<string, unknown>);
    if (entetes !== undefined) event.request.headers = entetes as Record<string, string>;
    const cookies = redactRecord(event.request.cookies as Record<string, unknown>);
    if (cookies !== undefined) event.request.cookies = cookies as Record<string, string>;
  }
  if (event.extra) event.extra = redactRecord(event.extra) ?? {};
  return event;
}
