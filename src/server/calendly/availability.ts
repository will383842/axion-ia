// Disponibilités Calendly résolues CÔTÉ SERVEUR (ADR 0038).
//
// POURQUOI CE MODULE EXISTE
// -------------------------
// ADR 0034 a fait passer l'embed Calendly en click-to-load, pour une raison qui
// reste entièrement valable : l'iframe dépose les cookies de calendly.com sur le
// terminal du visiteur, donc l'article 82 de la loi Informatique et Libertés
// impose un consentement préalable. Le prix payé était un placeholder bavard là
// où le visiteur venait chercher un calendrier — et un clic de plus dans le seul
// funnel du site.
//
// Ce module supprime le dilemme au lieu de l'arbitrer. Les créneaux sont
// demandés à l'API Calendly v2 PAR NOTRE SERVEUR, avec notre Personal Access
// Token. Le navigateur du visiteur ne parle jamais à Calendly : pas de requête,
// pas d'IP transmise, pas de cookie tiers, donc aucun accès en écriture à son
// terminal — l'article 82 ne s'applique tout simplement pas. Le calendrier peut
// donc s'afficher immédiatement, sans clic et sans pavé d'information.
//
// Le visiteur ne rejoint Calendly qu'en cliquant un créneau, pour confirmer son
// nom et son email : une navigation à SON initiative, hors du champ de l'art. 82
// (c'est déjà le raisonnement qui justifiait le lien « nouvel onglet » du
// placeholder, cf. ADR 0034 PIÈGE 4).
//
// CONTRAT D'ACTIVATION — le repli n'est pas un cas d'erreur, c'est le défaut
// -------------------------------------------------------------------------
// Toute défaillance renvoie `{ ok: false }` et l'appelant retombe sur
// `CalendlyConsentGate`, inchangé. Sans jeton, avec un jeton refusé, avec
// l'API injoignable ou sans aucun créneau libre, le produit se comporte
// EXACTEMENT comme avant ce module. C'est délibéré : au build GitHub Actions le
// jeton est absent (secret de runtime Coolify), donc la page est prérendue avec
// le repli, et l'ISR la repeuple en production. Même contrat que les stubs
// Prisma/Redis décrits dans AGENTS.md.
//
// ⚠️ NON VÉRIFIÉ À L'ÉCRITURE — `/event_type_available_times` est documenté par
// Calendly sans mention de palier, mais l'accès API au plan gratuit est
// précisément le point qui restait incertain dans ADR 0036 (« poser le jeton est
// le test décisif »). Je n'ai pas pu l'éprouver contre le compte réel. Si
// l'endpoint répond 403 sur ce plan, rien ne casse : la page rend le placeholder
// d'avant. Commande de vérification dans ADR 0038.
//
// PIÈGE — la fenêtre de temps fait partie de la CLÉ DE CACHE.
// L'URL demandée contient `start_time`. Calculée sur l'horloge à chaque rendu,
// elle serait unique à chaque fois : le cache de données ne servirait jamais et
// chaque régénération taperait l'API. `windowStart()` quantifie donc l'instant
// de départ sur le même pas que le TTL (`SLOTS_REVALIDATE_SECONDS`) : une seule
// URL par intervalle, donc un seul appel réseau par intervalle.

import { CALENDLY_API_BASE } from "./api";

/**
 * TTL du cache des créneaux, en secondes.
 *
 * ⚠️ À GARDER ALIGNÉ avec `export const revalidate` de
 * `src/app/[locale]/appel/page.tsx`. Le segment ne peut pas importer cette
 * constante (Next exige une valeur littéralement analysable), et il ne peut pas
 * non plus se contenter d'hériter du `fetch` : au build le jeton est absent,
 * aucun `fetch` n'a lieu, donc la route garderait son intervalle d'origine et
 * servirait le repli prérendu pendant tout ce temps.
 */
export const SLOTS_REVALIDATE_SECONDS = 900;

/** Étiquette de cache des créneaux — permet une invalidation à la réservation. */
export const CALENDLY_SLOTS_TAG = "calendly-slots";

/** L'event-type et l'identité du compte ne bougent pas : cache long. */
const EVENT_TYPE_REVALIDATE_SECONDS = 86_400;
const EVENT_TYPE_TAG = "calendly-event-type";

/**
 * Fenêtre maximale acceptée par l'API pour une requête de disponibilités
 * (Calendly refuse un intervalle supérieur à 7 jours). On retire une seconde
 * pour rester STRICTEMENT en dessous de la borne, et on enchaîne les fenêtres
 * bout à bout pour ne pas créer de trou.
 */
const MAX_WINDOW_MS = 7 * 86_400_000 - 1_000;

/**
 * Horizon interrogé : 28 jours, soit quatre fenêtres.
 *
 * Passé de 14 à 28 le 2026-07-30, avec le rendu en grille mensuelle : une
 * quinzaine laissait la moitié du mois vide, ce qui donnait l'impression d'un
 * agenda saturé alors qu'il ne l'est pas. Coût réel : quatre appels réseau par
 * intervalle de cache au lieu de deux, soit seize par heure — négligeable
 * devant les quotas Calendly.
 */
const HORIZON_MS = 28 * 86_400_000;

/** Aucun appel ne bloque un rendu plus longtemps que ça. */
const TIMEOUT_MS = 6_000;

export interface CalendlySlot {
  /** Début du créneau, ISO 8601 UTC. */
  readonly startIso: string;
  /** Page Calendly de confirmation, déjà positionnée sur ce créneau. */
  readonly schedulingUrl: string;
}

export interface CalendlyAvailabilityDay {
  /** Clé `AAAA-MM-JJ` du jour civil à Paris. */
  readonly dateKey: string;
  readonly slots: readonly CalendlySlot[];
}

export type CalendlyAvailability =
  | { readonly ok: true; readonly days: readonly CalendlyAvailabilityDay[] }
  | { readonly ok: false; readonly reason: CalendlyAvailabilityFailure };

export type CalendlyAvailabilityFailure =
  /** Pas de Personal Access Token : module inerte, cas nominal (build). */
  | "not_configured"
  /** `NEXT_PUBLIC_CALENDLY_APPEL_URL` absente ou hors calendly.com. */
  | "bad_url"
  /** Le compte n'expose pas d'event-type correspondant à cette URL publique. */
  | "no_event_type"
  /** 401/403 — jeton invalide, révoqué, ou plan sans accès à cet endpoint. */
  | "forbidden"
  /** Autre statut HTTP, réponse illisible, timeout, DNS, TLS. */
  | "api_error"
  /** L'API a répondu, mais aucun créneau libre sur l'horizon interrogé. */
  | "no_slots";

interface GetOk {
  readonly ok: true;
  readonly body: unknown;
}
interface GetErr {
  readonly ok: false;
  readonly reason: Extract<CalendlyAvailabilityFailure, "forbidden" | "api_error">;
}

/**
 * Refuse toute URL qui ne pointe pas exactement sur `calendly.com`.
 *
 * Même esprit que le garde-fou SSRF de `api.ts` : ces URL finissent en `href`
 * dans la page, et l'une d'elles vient de la réponse de l'API. On ne relaie
 * jamais une destination qu'on n'a pas vérifiée.
 */
function isPublicCalendlyUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    (parsed.hostname === "calendly.com" || parsed.hostname.endsWith(".calendly.com"))
  );
}

/** Forme comparable d'une URL de prise de rendez-vous : origine + chemin, sans slash final. */
function canonicalPath(value: string): string | null {
  try {
    const u = new URL(value);
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}

async function calendlyGet(url: string, revalidate: number, tag: string): Promise<GetOk | GetErr> {
  const token = process.env.CALENDLY_API_TOKEN?.trim();
  // L'appelant a déjà filtré ce cas ; garde de dernier recours pour ne jamais
  // émettre une requête sans en-tête d'autorisation.
  if (!token) return { ok: false, reason: "api_error" };

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Pas de `cache:` ici — le combiner avec `next.revalidate` est une
      // configuration contradictoire que Next ignore purement et simplement.
      next: { revalidate, tags: [tag] },
    });
  } catch {
    return { ok: false, reason: "api_error" };
  }

  if (res.status === 401 || res.status === 403) return { ok: false, reason: "forbidden" };
  if (!res.ok) return { ok: false, reason: "api_error" };

  try {
    return { ok: true, body: (await res.json()) as unknown };
  } catch {
    return { ok: false, reason: "api_error" };
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * Retrouve l'URI d'API de l'event-type à partir de son URL publique.
 *
 * L'URL publique (`NEXT_PUBLIC_CALENDLY_APPEL_URL`) est la seule chose que le
 * site connaisse ; l'API, elle, ne travaille qu'avec des URI. Deux appels, tous
 * deux mis en cache 24 h : ni le compte ni l'event-type ne changent d'un jour à
 * l'autre.
 */
async function resolveEventTypeUri(
  schedulingUrl: string,
): Promise<string | GetErr["reason"] | null> {
  const me = await calendlyGet(
    `${CALENDLY_API_BASE}/users/me`,
    EVENT_TYPE_REVALIDATE_SECONDS,
    EVENT_TYPE_TAG,
  );
  if (!me.ok) return me.reason;

  const userUri = record(record(me.body)?.["resource"])?.["uri"];
  if (typeof userUri !== "string" || !userUri) return null;

  const list = await calendlyGet(
    `${CALENDLY_API_BASE}/event_types?user=${encodeURIComponent(userUri)}&count=100&active=true`,
    EVENT_TYPE_REVALIDATE_SECONDS,
    EVENT_TYPE_TAG,
  );
  if (!list.ok) return list.reason;

  const collection = record(list.body)?.["collection"];
  if (!Array.isArray(collection)) return null;

  const wanted = canonicalPath(schedulingUrl);
  for (const raw of collection) {
    const et = record(raw);
    if (!et) continue;
    const uri = et["uri"];
    const sched = et["scheduling_url"];
    if (typeof uri !== "string" || typeof sched !== "string") continue;
    if (canonicalPath(sched) === wanted) return uri;
  }
  return null;
}

/**
 * Instant de départ des fenêtres, quantifié sur le pas du TTL.
 *
 * Toujours STRICTEMENT dans le futur : l'API rejette un `start_time` passé, et
 * un multiple exact de l'intervalle vaut « maintenant ». Conséquence assumée :
 * les créneaux commençant dans les prochaines minutes ne sont pas proposés — ce
 * que fait déjà Calendly lui-même avec son préavis minimum de réservation.
 */
function windowStart(nowMs: number, stepMs: number): Date {
  return new Date(Math.floor(nowMs / stepMs) * stepMs + stepMs);
}

/** Découpe l'horizon en fenêtres contiguës toutes inférieures à la borne API. */
function buildWindows(start: Date): ReadonlyArray<{ start: Date; end: Date }> {
  const windows: Array<{ start: Date; end: Date }> = [];
  const horizonEnd = start.getTime() + HORIZON_MS;
  let cursor = start.getTime();
  while (cursor < horizonEnd) {
    const end = Math.min(cursor + MAX_WINDOW_MS, horizonEnd);
    windows.push({ start: new Date(cursor), end: new Date(end) });
    cursor = end;
  }
  return windows;
}

/**
 * Clé du jour civil À PARIS.
 *
 * `en-CA` rend `AAAA-MM-JJ`, ce qui donne une clé triable sans manipulation. Le
 * fuseau est explicite : le serveur tourne en UTC, et regrouper sur son jour à
 * lui casserait les créneaux de début de matinée à l'heure d'été.
 */
const PARIS_DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function parisDayKey(date: Date): string {
  return PARIS_DAY_KEY.format(date);
}

function parseSlots(body: unknown): CalendlySlot[] {
  const collection = record(body)?.["collection"];
  if (!Array.isArray(collection)) return [];

  const slots: CalendlySlot[] = [];
  for (const raw of collection) {
    const s = record(raw);
    if (!s) continue;
    if (s["status"] !== "available") continue;

    // `invitees_remaining` vaut 0 sur un créneau plein d'un event-type
    // collectif. Absent sur un event-type individuel : on ne l'exige donc pas.
    const remaining = s["invitees_remaining"];
    if (typeof remaining === "number" && remaining <= 0) continue;

    const startRaw = s["start_time"];
    if (typeof startRaw !== "string") continue;
    const start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) continue;

    const schedulingUrl = s["scheduling_url"];
    if (!isPublicCalendlyUrl(schedulingUrl)) continue;

    slots.push({ startIso: start.toISOString(), schedulingUrl });
  }
  return slots;
}

export interface FetchAvailableSlotsOptions {
  /** URL publique de l'event-type (`NEXT_PUBLIC_CALENDLY_APPEL_URL`). */
  readonly schedulingUrl: string | undefined;
  /**
   * Nombre maximum de jours porteurs de créneaux rendus.
   *
   * Défaut large depuis le passage en grille mensuelle : chaque case cliquable
   * du calendrier pointe une ancre vers la liste des horaires de ce jour, donc
   * tronquer les jours produirait des cases qui ne mènent nulle part.
   */
  readonly maxDays?: number;
  /**
   * Nombre maximum de créneaux rendus par jour.
   *
   * C'est le vrai garde-fou de poids : 28 jours × 8 liens plafonnent le HTML.
   * Le lien « toutes les disponibilités » couvre le reste.
   */
  readonly maxSlotsPerDay?: number;
  /** Injectable pour les tests — l'horloge est quantifiée, jamais lue telle quelle. */
  readonly nowMs?: number;
}

/**
 * Renvoie les prochains créneaux libres, groupés par jour civil à Paris.
 *
 * Ne lève jamais : toute défaillance devient un `{ ok: false, reason }` que
 * l'appelant traduit en repli.
 */
export async function fetchAvailableSlots({
  schedulingUrl,
  maxDays = 31,
  maxSlotsPerDay = 8,
  nowMs = Date.now(),
}: FetchAvailableSlotsOptions): Promise<CalendlyAvailability> {
  if (!process.env.CALENDLY_API_TOKEN?.trim()) return { ok: false, reason: "not_configured" };
  if (!isPublicCalendlyUrl(schedulingUrl)) return { ok: false, reason: "bad_url" };

  const eventTypeUri = await resolveEventTypeUri(schedulingUrl);
  if (eventTypeUri === "forbidden" || eventTypeUri === "api_error") {
    return { ok: false, reason: eventTypeUri };
  }
  if (!eventTypeUri) return { ok: false, reason: "no_event_type" };

  const windows = buildWindows(windowStart(nowMs, SLOTS_REVALIDATE_SECONDS * 1_000));
  const responses = await Promise.all(
    windows.map((w) =>
      calendlyGet(
        `${CALENDLY_API_BASE}/event_type_available_times` +
          `?event_type=${encodeURIComponent(eventTypeUri)}` +
          `&start_time=${encodeURIComponent(w.start.toISOString())}` +
          `&end_time=${encodeURIComponent(w.end.toISOString())}`,
        SLOTS_REVALIDATE_SECONDS,
        CALENDLY_SLOTS_TAG,
      ),
    ),
  );

  // Une fenêtre lointaine qui échoue ne doit pas emporter les créneaux proches,
  // qui sont les plus utiles. On n'abandonne que si TOUT a échoué.
  const succeeded = responses.filter((r): r is GetOk => r.ok);
  if (succeeded.length === 0) {
    const firstFailure = responses.find((r): r is GetErr => !r.ok);
    return { ok: false, reason: firstFailure?.reason ?? "api_error" };
  }

  // Les fenêtres se touchent bout à bout : un créneau pile sur la jointure peut
  // être renvoyé deux fois.
  const deduped = new Map<string, CalendlySlot>();
  for (const res of succeeded) {
    for (const slot of parseSlots(res.body)) {
      if (!deduped.has(slot.startIso)) deduped.set(slot.startIso, slot);
    }
  }

  const sorted = [...deduped.values()].sort((a, b) => a.startIso.localeCompare(b.startIso));
  if (sorted.length === 0) return { ok: false, reason: "no_slots" };

  const byDay = new Map<string, CalendlySlot[]>();
  for (const slot of sorted) {
    const key = parisDayKey(new Date(slot.startIso));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(slot);
    else byDay.set(key, [slot]);
  }

  const days = [...byDay.entries()]
    .slice(0, maxDays)
    .map(([dateKey, slots]) => ({ dateKey, slots: slots.slice(0, maxSlotsPerDay) }));

  return { ok: true, days };
}
