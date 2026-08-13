// Client API Calendly v2 — résolution des URI captées côté client (ADR 0036).
//
// POURQUOI CE MODULE EXISTE
// -------------------------
// L'Embed JS Calendly (mode gratuit, cf. ADR 0030) émet un postMessage
// `calendly.event_scheduled` dont le payload ne contient QUE deux champs :
//
//   { event: { uri: "https://api.calendly.com/scheduled_events/<uuid>" },
//     invitee: { uri: ".../scheduled_events/<uuid>/invitees/<uuid>" } }
//
// Ni nom, ni email, ni horaire — Calendly retient volontairement les PII côté
// navigateur. Le code d'origine lisait `payload.invitee.name` / `.email`, des
// champs qui n'existent tout simplement pas dans ce payload : la table
// `calendly_events` s'est donc remplie de lignes sans contact ni heure, et
// l'admin devait tout ressaisir depuis Gmail.
//
// Le seul moyen de récupérer ces données est de RÉSOUDRE les URI côté serveur
// via l'API Calendly v2, authentifiée par un Personal Access Token.
//
// CONTRAT D'ACTIVATION
// --------------------
// Tout ce module est INERTE tant que `CALENDLY_API_TOKEN` est absent :
// `isCalendlyApiConfigured()` renvoie false et `fetchCalendlyInvitee()` renvoie
// `{ ok: false, reason: "not_configured" }` sans émettre la moindre requête.
// Le comportement du produit est alors STRICTEMENT celui d'aujourd'hui
// (capture de l'URI, complétion manuelle). Poser le token active
// l'enrichissement, sans autre changement de code ni redeploy applicatif.
//
// ⚠️ Non vérifié à l'écriture : Calendly documente l'API v2 comme accessible
// via Personal Access Token, mais les sources publiques divergent sur sa
// disponibilité exacte au palier gratuit (certaines la disent ouverte à tous
// les plans, d'autres réservée à partir de Standard). C'est précisément
// pourquoi l'échec est traité comme un cas nominal : un 401/403 est journalisé
// en `reason: "forbidden"`, n'interrompt jamais la capture, et laisse le flux
// manuel intact. Poser le token est le test décisif.

// Lecture directe de `process.env` — même convention que
// `src/server/notifications/channels/whatsapp.ts`. Le proxy `@/env` refuse
// d'être touché hors contexte serveur strict, ce qui casserait les tests de la
// route de capture ; la variable reste déclarée et validée dans `src/env.ts`.
const CALENDLY_API_BASE = "https://api.calendly.com";
/** L'appel est déclenché dans le chemin d'une balise POST navigateur : on ne
 *  bloque jamais plus de 5 s, quitte à laisser la ligne non enrichie. */
const TIMEOUT_MS = 5_000;

export interface CalendlyInviteeData {
  inviteeName: string | null;
  inviteeEmail: string | null;
  inviteePhone: string | null;
  startTime: Date | null;
  endTime: Date | null;
  timezone: string | null;
  location: string | null;
  /** `active` | `canceled` côté Calendly → mappé par l'appelant. */
  calendlyStatus: string | null;
  cancelUrl: string | null;
  rescheduleUrl: string | null;
  /** Nom humain de l'event-type (ex « Premier contact — 30 min »). */
  eventTypeName: string | null;
  /**
   * Réponses libres du formulaire de réservation (hors question téléphone,
   * déjà portée par `inviteePhone`), concaténées « Question : Réponse ».
   * C'est le CONTENU que l'invité a écrit — demande Will 2026-08-12 : le
   * recevoir dans la notification, pas seulement les métadonnées du RDV.
   */
  answersText: string | null;
}

export type CalendlyFetchResult =
  | { ok: true; data: CalendlyInviteeData }
  | {
      ok: false;
      /**
       * `not_configured` : pas de token → module inerte, cas nominal.
       * `forbidden`      : 401/403 → token invalide ou plan sans accès API.
       * `not_found`      : 404 → event supprimé côté Calendly.
       * `http_error`     : autre statut.
       * `network_error`  : timeout / DNS / TLS.
       * `bad_uri`        : URI absente ou hors du domaine api.calendly.com.
       */
      reason:
        "not_configured" | "forbidden" | "not_found" | "http_error" | "network_error" | "bad_uri";
      status?: number;
    };

/** Vrai si un Personal Access Token est configuré. Aucun appel réseau. */
export function isCalendlyApiConfigured(): boolean {
  return Boolean(process.env.CALENDLY_API_TOKEN?.trim());
}

/**
 * Refuse toute URI qui ne pointe pas exactement sur `api.calendly.com`.
 *
 * L'URI provient d'un postMessage : même avec le contrôle d'origine côté
 * client, elle reste une donnée non fiable côté serveur. Sans ce garde-fou,
 * une URI forgée transformerait l'enrichissement en SSRF *avec* le token
 * Calendly dans l'en-tête `Authorization`.
 */
function isValidCalendlyUri(uri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && parsed.hostname === "api.calendly.com";
}

/** Types de « lieu » Calendly qui désignent en fait un appel téléphonique. */
const PHONE_LOCATION_TYPES = new Set([
  "outbound_call",
  "inbound_call",
  "physical", // rare, mais Calendly y range parfois un numéro saisi librement
]);

/**
 * Extrait le numéro de l'invité, dans l'ordre de fiabilité décroissante :
 * rappel SMS → question dédiée du formulaire → « lieu » quand le type d'event
 * est un appel téléphonique.
 *
 * Ce dernier cas n'est pas un raffinement : sur le type d'event réellement
 * utilisé par Axion-IA, Calendly range le numéro de l'invité dans
 * `event.location` (`type: "outbound_call"`). Sans lui, la fiche affichait le
 * numéro dans « Lieu / URL Meet » et laissait « Téléphone » vide — constaté en
 * production le 2026-07-29 sur la première réservation enrichie.
 */
function extractPhone(
  questionsAndAnswers: unknown,
  textReminderNumber: unknown,
  locationRaw?: unknown,
): string | null {
  if (typeof textReminderNumber === "string" && textReminderNumber.trim()) {
    return textReminderNumber.trim().slice(0, 40);
  }
  if (Array.isArray(questionsAndAnswers)) {
    for (const qa of questionsAndAnswers) {
      if (typeof qa !== "object" || qa === null) continue;
      const q = (qa as { question?: unknown }).question;
      const a = (qa as { answer?: unknown }).answer;
      if (typeof q !== "string" || typeof a !== "string" || !a.trim()) continue;
      if (/t[ée]l[ée]phone|phone|mobile|portable/i.test(q)) return a.trim().slice(0, 40);
    }
  }
  if (typeof locationRaw === "object" && locationRaw !== null) {
    const loc = locationRaw as Record<string, unknown>;
    const type = typeof loc["type"] === "string" ? (loc["type"] as string) : "";
    const value = typeof loc["location"] === "string" ? (loc["location"] as string).trim() : "";
    // Garde-fou : ne jamais recopier une URL de visio dans un champ téléphone.
    const looksLikePhone = /^[+\d][\d\s.()-]{5,}$/.test(value);
    if (PHONE_LOCATION_TYPES.has(type) && looksLikePhone) return value.slice(0, 40);
  }
  return null;
}

/**
 * Concatène les réponses libres du formulaire en « Q : R » lisibles, en
 * excluant la question téléphone (même regex que `extractPhone` — sinon le
 * numéro apparaîtrait deux fois dans la notification).
 */
function extractAnswersText(questionsAndAnswers: unknown): string | null {
  if (!Array.isArray(questionsAndAnswers)) return null;
  const parts: string[] = [];
  for (const qa of questionsAndAnswers) {
    if (typeof qa !== "object" || qa === null) continue;
    const q = (qa as { question?: unknown }).question;
    const a = (qa as { answer?: unknown }).answer;
    if (typeof q !== "string" || typeof a !== "string" || !a.trim()) continue;
    if (/t[ée]l[ée]phone|phone|mobile|portable/i.test(q)) continue;
    parts.push(`${q.trim()} : ${a.trim()}`);
  }
  return parts.length > 0 ? parts.join(" · ").slice(0, 600) : null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function stringOrNull(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

async function calendlyGet(uri: string, token: string): Promise<CalendlyFetchResult | unknown> {
  let res: Response;
  try {
    res = await fetch(uri, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "network_error" } satisfies CalendlyFetchResult;
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, reason: "forbidden", status: res.status } satisfies CalendlyFetchResult;
  }
  if (res.status === 404) {
    return { ok: false, reason: "not_found", status: res.status } satisfies CalendlyFetchResult;
  }
  if (!res.ok) {
    return { ok: false, reason: "http_error", status: res.status } satisfies CalendlyFetchResult;
  }
  try {
    return (await res.json()) as unknown;
  } catch {
    return { ok: false, reason: "http_error", status: res.status } satisfies CalendlyFetchResult;
  }
}

function isFailure(v: unknown): v is Extract<CalendlyFetchResult, { ok: false }> {
  return typeof v === "object" && v !== null && (v as { ok?: unknown }).ok === false;
}

/**
 * Résout `inviteeUri` (et, si fournie, `eventUri`) contre l'API Calendly.
 *
 * L'invitee porte le contact ; l'event porte l'horaire, le lieu et le nom de
 * l'event-type. `eventUri` est optionnelle : sans elle on renvoie ce que
 * l'invitee sait, plutôt que rien.
 */
export async function fetchCalendlyInvitee(
  inviteeUri: string | null | undefined,
  eventUri?: string | null,
): Promise<CalendlyFetchResult> {
  const token = process.env.CALENDLY_API_TOKEN?.trim();
  if (!token) return { ok: false, reason: "not_configured" };
  if (!inviteeUri || !isValidCalendlyUri(inviteeUri)) return { ok: false, reason: "bad_uri" };

  const inviteeRes = await calendlyGet(inviteeUri, token);
  if (isFailure(inviteeRes)) return inviteeRes;

  const invitee = ((inviteeRes as { resource?: unknown }).resource ?? {}) as Record<
    string,
    unknown
  >;

  // L'event est optionnel : son échec ne doit pas annuler les données invitee.
  let event: Record<string, unknown> = {};
  if (eventUri && isValidCalendlyUri(eventUri)) {
    const eventRes = await calendlyGet(eventUri, token);
    if (!isFailure(eventRes)) {
      event = ((eventRes as { resource?: unknown }).resource ?? {}) as Record<string, unknown>;
    }
  }

  // `location` est tantôt une string, tantôt un objet { type, location, join_url }.
  const locationRaw = event["location"];
  const location =
    typeof locationRaw === "string"
      ? locationRaw.slice(0, 500)
      : typeof locationRaw === "object" && locationRaw !== null
        ? (stringOrNull((locationRaw as Record<string, unknown>)["join_url"], 500) ??
          stringOrNull((locationRaw as Record<string, unknown>)["location"], 500) ??
          JSON.stringify(locationRaw).slice(0, 500))
        : null;

  return {
    ok: true,
    data: {
      inviteeName: stringOrNull(invitee["name"], 255),
      inviteeEmail: stringOrNull(invitee["email"], 255),
      inviteePhone: extractPhone(
        invitee["questions_and_answers"],
        invitee["text_reminder_number"],
        event["location"],
      ),
      startTime: parseDate(event["start_time"]),
      endTime: parseDate(event["end_time"]),
      timezone: stringOrNull(invitee["timezone"], 80),
      location,
      calendlyStatus: stringOrNull(invitee["status"] ?? event["status"], 40),
      cancelUrl: stringOrNull(invitee["cancel_url"], 500),
      rescheduleUrl: stringOrNull(invitee["reschedule_url"], 500),
      eventTypeName: stringOrNull(event["name"], 255),
      answersText: extractAnswersText(invitee["questions_and_answers"]),
    },
  };
}

export { CALENDLY_API_BASE };
