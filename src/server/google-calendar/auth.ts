/**
 * Accès à Google Agenda — authentification par COMPTE DE SERVICE (2026-08-26).
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * L'agenda Google de Will est le pivot de toute la disponibilité, et ce n'est
 * pas une opinion : c'est mesuré. Le 2026-08-26, un événement posé dans cet
 * agenda a fermé le créneau correspondant chez Calendly en **11 secondes**, et
 * Calendly y réécrit ses propres réservations. Autrement dit :
 *
 *   · LIRE cet agenda = voir TOUS les rendez-vous (Calendly, Gmail, iPhone —
 *     l'iPhone écrit dans ce compte Google, vérifié auprès de Will) ;
 *   · ÉCRIRE dans cet agenda = fermer Calendly, sans jamais parler à Calendly.
 *
 * Une seule intégration tient donc les deux bouts. La console n'a aucun besoin
 * d'un accès en écriture à Calendly, qui serait de toute façon refusé : le jeton
 * Calendly n'a pas le périmètre `event_types:write`.
 *
 * POURQUOI UN COMPTE DE SERVICE ET PAS OAUTH
 * -------------------------------------------
 * OAuth impose un écran de consentement, un jeton de rafraîchissement à stocker,
 * et une ré-autorisation le jour où Google le révoque — pour un serveur qui
 * n'agit jamais au nom d'un visiteur, c'est de la cérémonie sans contrepartie.
 * Un compte de service, lui, s'authentifie seul et indéfiniment. Il suffit de
 * PARTAGER l'agenda avec son adresse (« Apporter des modifications aux
 * événements ») — ce qui fonctionne avec un Gmail personnel, sans Workspace et
 * sans délégation à l'échelle du domaine.
 *
 * POURQUOI PAS LA BIBLIOTHÈQUE `googleapis`
 * ------------------------------------------
 * Elle pèse une vingtaine de mégaoctets et embarque la totalité des APIs Google
 * pour trois appels REST. Le flux JWT tient en quarante lignes avec
 * `node:crypto`, qui est déjà là. Une dépendance de moins à auditer, à mettre à
 * jour, et à voir apparaître dans un bulletin de sécurité.
 *
 * INERTE PAR DÉFAUT — même contrat que le reste du dépôt
 * ------------------------------------------------------
 * Sans les trois variables d'environnement, `getGoogleAccessToken()` renvoie
 * `{ ok: false, reason: "not_configured" }` et n'émet aucune requête. La page
 * Agenda affiche alors les seules réservations Calendly (déjà en base) et le dit
 * franchement, au lieu de prétendre que l'agenda est vide.
 */

import crypto from "node:crypto";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/**
 * Portée demandée. `calendar.events` et non `calendar` : on lit et on écrit des
 * ÉVÉNEMENTS, on ne crée ni ne supprime jamais d'agenda. Le moindre privilège
 * est ici gratuit — autant le prendre.
 */
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

/** Durée de vie demandée pour le jeton. Google plafonne à une heure. */
const TOKEN_TTL_SECONDS = 3600;

/**
 * Marge de renouvellement. On jette le jeton une minute avant son expiration
 * réelle : un jeton qui expire PENDANT le vol produit un 401 qui ressemble à un
 * problème de configuration, et envoie chercher au mauvais endroit.
 */
const RENEW_MARGIN_MS = 60_000;

/** Aucun appel d'authentification ne bloque un rendu plus longtemps que ça. */
const TIMEOUT_MS = 6_000;

export type GoogleAuthFailure =
  /** Variables absentes : module inerte, cas nominal tant que Will n'a rien posé. */
  | "not_configured"
  /** La clé privée n'est pas exploitable (copier-coller tronqué, `\n` non déséchappés). */
  | "bad_private_key"
  /** Google a refusé l'assertion : horloge décalée, compte supprimé, portée retirée. */
  | "rejected"
  /** Autre statut HTTP, réponse illisible, délai dépassé, DNS, TLS. */
  | "api_error";

export type GoogleAccessToken =
  | { readonly ok: true; readonly token: string }
  | { readonly ok: false; readonly reason: GoogleAuthFailure; readonly detail?: string };

export interface GoogleCalendarConfig {
  readonly clientEmail: string;
  readonly privateKey: string;
  /** Agenda visé — l'adresse Gmail de Will, partagée avec le compte de service. */
  readonly calendarId: string;
}

/**
 * Lit la configuration, ou `null` si elle est incomplète.
 *
 * ⚠️ LE PIÈGE DES SAUTS DE LIGNE. Une clé privée PEM contient de vrais retours
 * à la ligne ; une variable d'environnement, non. Coolify et GitHub Actions les
 * transportent donc en `\n` littéraux (deux caractères). Sans ce remplacement,
 * `crypto.sign` échoue sur une clé qui a pourtant l'air correcte à l'œil — et
 * le message d'erreur ne dit rien d'utile. On accepte les deux formes.
 */
export function readGoogleCalendarConfig(): GoogleCalendarConfig | null {
  const clientEmail = process.env["GOOGLE_CALENDAR_CLIENT_EMAIL"]?.trim();
  const rawKey = process.env["GOOGLE_CALENDAR_PRIVATE_KEY"]?.trim();
  const calendarId = process.env["GOOGLE_CALENDAR_ID"]?.trim();
  if (!clientEmail || !rawKey || !calendarId) return null;
  return { clientEmail, privateKey: rawKey.replace(/\\n/g, "\n"), calendarId };
}

/** `true` quand les trois variables sont posées. Ne valide pas la clé. */
export function isGoogleCalendarConfigured(): boolean {
  return readGoogleCalendarConfig() !== null;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Fabrique l'assertion JWT signée RS256 attendue par le flux « JWT bearer ».
 *
 * Renvoie `null` si la clé est inexploitable — jamais d'exception : l'appelant
 * traduit ça en `bad_private_key`, qui oriente vers la bonne cause (la variable
 * mal recopiée) plutôt que vers un problème réseau imaginaire.
 */
function buildAssertion(cfg: GoogleCalendarConfig, nowSec: number): string | null {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: cfg.clientEmail,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: nowSec,
      exp: nowSec + TOKEN_TTL_SECONDS,
    }),
  );
  const payload = `${header}.${claims}`;
  try {
    const signature = crypto.sign("RSA-SHA256", Buffer.from(payload), cfg.privateKey);
    return `${payload}.${base64Url(signature)}`;
  } catch {
    return null;
  }
}

/**
 * Cache mémoire du jeton.
 *
 * Un jeton vaut une heure et chaque obtention coûte un aller-retour réseau plus
 * une signature RSA. Sans ce cache, une page qui fait trois appels d'agenda en
 * paierait trois — et le quota d'authentification de Google est nettement moins
 * généreux que celui de l'API Calendar. Le cache est par processus : au pire, le
 * conteneur web et le worker en détiennent chacun un.
 */
let cached: { token: string; expiresAtMs: number } | null = null;

/** Vide le cache — réservé aux tests, jamais appelé en production. */
export function resetGoogleTokenCacheForTests(): void {
  cached = null;
}

/**
 * Renvoie un jeton d'accès valide, depuis le cache si possible.
 *
 * Ne lève jamais : toute défaillance devient un `{ ok: false, reason }` que
 * l'appelant traduit en repli visible. Un agenda qui ne répond pas doit se dire,
 * pas se confondre avec un agenda vide.
 */
export async function getGoogleAccessToken(nowMs: number = Date.now()): Promise<GoogleAccessToken> {
  const cfg = readGoogleCalendarConfig();
  if (!cfg) return { ok: false, reason: "not_configured" };

  if (cached && cached.expiresAtMs - RENEW_MARGIN_MS > nowMs) {
    return { ok: true, token: cached.token };
  }

  const assertion = buildAssertion(cfg, Math.floor(nowMs / 1000));
  if (!assertion) {
    return {
      ok: false,
      reason: "bad_private_key",
      detail: "signature RS256 impossible — vérifier GOOGLE_CALENDAR_PRIVATE_KEY (sauts de ligne)",
    };
  }

  let res: Response;
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      reason: "api_error",
      detail: `fetch:${e instanceof Error ? e.name : String(e)}`,
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: "api_error", detail: `http_${res.status}:corps illisible` };
  }

  if (!res.ok) {
    // 🔑 Google renseigne `error_description` et il est PARLANT : « Invalid JWT
    // Signature », « Invalid grant: account not found », « Invalid JWT: Token
    // must be a short-lived token... » (horloge décalée). Le jeter obligerait à
    // deviner ; on le remonte, tronqué.
    const rec = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const desc = typeof rec["error_description"] === "string" ? rec["error_description"] : "";
    const err = typeof rec["error"] === "string" ? rec["error"] : `http_${res.status}`;
    return {
      ok: false,
      reason: res.status === 400 || res.status === 401 ? "rejected" : "api_error",
      detail: `${err}${desc ? ` · ${desc}` : ""}`.slice(0, 300),
    };
  }

  const rec = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const token = typeof rec["access_token"] === "string" ? rec["access_token"] : null;
  const expiresIn = typeof rec["expires_in"] === "number" ? rec["expires_in"] : TOKEN_TTL_SECONDS;
  if (!token) {
    return { ok: false, reason: "api_error", detail: "réponse sans access_token" };
  }

  cached = { token, expiresAtMs: nowMs + expiresIn * 1000 };
  return { ok: true, token };
}
