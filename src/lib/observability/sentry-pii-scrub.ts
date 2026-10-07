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

import { viderRequeteDesDocuments } from "./sentry-documents-projet";

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
 * Nettoie `contexts.trace.data`, où Sentry range les attributs de span.
 *
 * 🔴 `@sentry/nextjs` y recopie `http.target` — le CHEMIN BRUT de la requête,
 * jeton compris. La docstring de ce module annonçait `contexts` comme nettoyé ;
 * il ne l'était ni dans les erreurs, ni dans les transactions. Le jeton partait
 * donc chez Sentry malgré le nettoyage de `request.url`.
 */
function nettoyerContexts(event: { contexts?: Record<string, unknown> | undefined }): void {
  const trace = event.contexts?.["trace"] as { data?: Record<string, unknown> } | undefined;
  if (trace?.data !== undefined) {
    trace.data = redactRecord(trace.data) ?? {};
  }
}

/**
 * Routes dont un SEGMENT de chemin est un secret.
 *
 * Une liste explicite plutôt qu'une heuristique : se tromper ici, c'est soit
 * exporter un jeton valide, soit rendre les URL illisibles au débogage.
 */
const SEGMENTS_SECRETS: ReadonlyArray<RegExp> = [
  // Documents du projet (ADR 0063) : `/document/<uuid>/<jeton>` — le jeton
  // (HMAC base64url, 43 caractères) ouvre la page envoyée au client ; il échappe
  // à `HEX_TOKEN_RE` et `JWT_RE`. L'identifiant reste lisible, le jeton est masqué.
  /(\/document\/[0-9a-fA-F-]{36}\/)[^/?#]+/gi,
  /(\/portail\/emarger\/)[^/?#]+/gi,
  /(\/booking\/)[^/?#]+/gi,
  /(\/verifier-attestation\/)[^/?#]+/gi,
  /(\/portail\/acces\/)[^/?#]+/gi,
  // Questionnaire de cadrage en ligne (2026-10-01) : `/questionnaire/<uuid>/<jeton>`.
  // Le jeton (HMAC base64url, 43 caractères) échappe à `HEX_TOKEN_RE` et à
  // `MAGIC_TOKEN_RE` ; il permet de répondre à la place du client. L'identifiant
  // reste lisible (débogage), le jeton seul est masqué.
  /(\/questionnaire\/[0-9a-fA-F-]{36}\/)[^/?#]+/gi,
  // Dossier en ligne d'un apporteur (2026-10-05) : `/apporteur/dossier/<uuid>/<jeton>`.
  /(\/apporteur\/dossier\/[0-9a-fA-F-]{36}\/)[^/?#]+/gi,
  // Lien privé d'envoi de fichiers à un candidat (Candidatures unifiées L5,
  // 2026-10-08) : `/api/partage/<uuid>/<jeton>[/<fichierId>]`. Le jeton (HMAC
  // base64url, 43 caractères) ouvre les fichiers ; l'identifiant du lien et celui
  // du fichier restent lisibles.
  /(\/api\/partage\/[0-9a-fA-F-]{36}\/)[^/?#]+/gi,
];

/** Remplace le segment secret de ces routes par `[TOKEN]`, en gardant la route lisible. */
function masquerSegmentsSensibles(url: string): string {
  let out = url;
  for (const re of SEGMENTS_SECRETS) out = out.replace(re, "$1[TOKEN]");
  return out;
}

function redactString(input: unknown): unknown {
  if (typeof input !== "string") return input;
  return masquerSegmentsSensibles(input)
    .replace(JWT_RE, "[JWT]")
    .replace(MAGIC_TOKEN_RE, "[TOKEN]")
    .replace(EMAIL_RE, "[EMAIL]")
    .replace(IPV4_RE, "[IP]")
    .replace(PHONE_RE, "[PHONE]")
    .replace(HEX_TOKEN_RE, "[TOKEN]");
}

/**
 * Routes PUBLIQUES dont la requête ENTIÈRE est un secret (2026-10-01, veto de
 * la relecture sécurité sur la PR 1258) : le questionnaire de cadrage en ligne
 * (`/questionnaire/<id>/<jeton>`) et, par prudence, le chantier voisin des
 * documents du projet (`/document/…`).
 * Et le dossier en ligne d'un apporteur (`/apporteur/dossier/…`, 2026-10-05) : son
 * corps de requête porte l'IBAN, le téléphone et les pièces déposées.
 *
 * Le SDK serveur capture par défaut le CORPS des requêtes entrantes
 * (`event.request.data`, ~10 Ko) malgré `sendDefaultPii: false`. Sur ces
 * routes, le corps du POST porte le jeton, les réponses du client et son nom ;
 * l'en-tête `Next-Router-State-Tree` porte encore le jeton, `Referer` aussi.
 * Le masquage par motif ne suffit pas (une réponse libre n'a pas de forme) :
 * on SUPPRIME, sans chercher à reconnaître.
 */
const ROUTE_A_REQUETE_SECRETE =
  /^(?:[A-Z]+\s+)?(?:https?:\/\/[^/]+)?(?:\/(?:fr|en))?\/(?:questionnaire|document|apporteur\/dossier)(?:\/|$)/i;

/** En-têtes retirés en entier sur ces routes (en minuscules). */
const ENTETES_RETIRES = new Set(["next-router-state-tree", "next-action", "referer", "cookie"]);

/** L'URL (ou le nom de transaction) vise-t-elle une route à requête secrète ? */
export function estRouteARequeteSecrete(url: unknown): boolean {
  return typeof url === "string" && ROUTE_A_REQUETE_SECRETE.test(url);
}

/**
 * Le prédicat de `httpIntegration({ ignoreIncomingRequestBody })` : le SDK ne
 * lit même pas le corps de ces requêtes (défense en profondeur ; le nettoyage
 * ci-dessous reste la garantie, il ne dépend pas de la version du SDK).
 */
export function corpsAIgnorer(url: string): boolean {
  try {
    return estRouteARequeteSecrete(new URL(url, "http://x").pathname);
  } catch {
    return estRouteARequeteSecrete(url);
  }
}

/** Purge la requête d'un événement visant une route à requête secrète. */
function purgerRequeteSecrete(event: {
  transaction?: string | undefined;
  request?: ErrorEvent["request"];
}): void {
  const req = event.request;
  if (!estRouteARequeteSecrete(req?.url) && !estRouteARequeteSecrete(event.transaction)) return;
  if (!req) return;
  delete req.data;
  delete req.cookies;
  delete req.query_string;
  if (typeof req.url === "string") req.url = req.url.split(/[?#]/)[0] ?? req.url;
  if (req.headers) {
    for (const k of Object.keys(req.headers)) {
      if (ENTETES_RETIRES.has(k.toLowerCase())) delete req.headers[k];
    }
  }
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

  // 2. request — d'abord la purge des routes à requête secrète (questionnaire en ligne).
  purgerRequeteSecrete(event);
  if (event.request) {
    // ADR 0063 : ni corps, ni état du routeur, ni Referer pour les documents du projet.
    viderRequeteDesDocuments(event.request);
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

  // 6. contexts — `contexts.trace.data` porte `http.target`, c'est-à-dire le
  // CHEMIN BRUT de la requête, jeton compris.
  nettoyerContexts(event);

  // 7. server_name (peut contenir hostname interne)
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
  // Purge AVANT le masquage du nom : la détection lit la route d'origine.
  purgerRequeteSecrete(event);
  if (typeof event.transaction === "string") {
    event.transaction = masquerSegmentsSensibles(event.transaction);
  }
  if (event.request) {
    viderRequeteDesDocuments(event.request); // ADR 0063
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
  nettoyerContexts(event);
  return event;
}
