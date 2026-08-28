// Découverte des réservations prises HORS de notre page (ADR 0038).
//
// POURQUOI CE MODULE EXISTE
// -------------------------
// Jusqu'ici, une réservation n'entrait dans `calendly_events` que par un seul
// chemin : le `postMessage` émis par l'iframe Calendly incrustée dans /appel,
// relayé par `POST /api/calendly/client-event`. Autrement dit, le site ne
// connaissait que les réservations faites DANS le site.
//
// Ce trou existait déjà avant ADR 0038 : le placeholder de consentement mettait
// « Ouvrir Calendly dans un nouvel onglet » en CTA PRIMAIRE, et tout ce qui
// était réservé depuis cet onglet-là n'était capté par personne — ni ligne dans
// la console, ni alerte Telegram. ADR 0038 rend ce chemin majoritaire (cliquer
// un créneau ouvre calendly.com), donc il n'est plus tolérable de le laisser
// ouvert : sans ce module, le sélecteur de créneaux ferait disparaître les
// leads de la console.
//
// Calendly Free n'émet AUCUN webhook. La seule voie est donc l'interrogation
// périodique, greffée sur le passage horaire qui rafraîchit déjà les statuts
// (`app/api/internal/calendly-refresh/route.ts`).
//
// CE QUE CE MODULE NE FAIT PAS
// ----------------------------
// Il ne remplace pas la capture `postMessage`, qui reste le chemin le plus
// riche (UTM, page d'origine, immédiateté). Il la complète pour tout ce qui
// arrive par ailleurs. Une réservation captée par les deux voies n'est pas
// dupliquée : `invitee_uri` porte une contrainte UNIQUE en base.
//
// Comme le reste de `src/server/calendly/`, tout est INERTE sans
// `CALENDLY_API_TOKEN` : aucune requête n'est émise.

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { syncCalendlyEventToCrm } from "@/server/crm-sync";
import { notify } from "@/server/notifications";
import { CALENDLY_API_BASE, isCalendlyApiConfigured } from "./api";
import { enrichCalendlyEvent } from "./enrich";

/**
 * Nombre maximum de réservations créées par passage.
 *
 * Chaque création coûte plusieurs appels API (invitees + enrichissement). Avec
 * un passage horaire, 10 couvre très largement le flux réel — et le compteur
 * `remaining` de la réponse signale une troncature au lieu de la taire.
 */
const MAX_NEW_PER_RUN = 10;

/**
 * Rattrapage minimal en arrière, quand tout va bien.
 *
 * 🔴 CE CHIFFRE ÉTAIT UN PLAFOND, ET IL PERDAIT DES RÉSERVATIONS.
 *
 * La fenêtre porte sur `start_time`, pas sur l'instant de réservation. Une
 * réservation prise pour un rendez-vous LOINTAIN reste donc découvrable
 * longtemps. Mais celle prise pour un rendez-vous PROCHE — quelqu'un qui réserve
 * à 9 h pour 10 h, le meilleur signal commercial qui soit — sort de la fenêtre
 * dès que son horaire a plus de deux heures.
 *
 * Conséquence mesurée le 2026-08-28 : si le worker s'arrête de 9 h à 13 h, ce
 * rendez-vous de 10 h n'est JAMAIS découvert. Ni ligne, ni alerte, ni fiche en
 * console. La personne se présente à un appel dont personne ne sait rien.
 *
 * Le remède n'est pas d'écrire un chiffre plus grand — n'importe quel chiffre
 * fixe a le même défaut, une panne plus longue lui échappe. Il est de DÉRIVER la
 * profondeur de l'état réel : voir `profondeurRattrapage()`.
 */
const LOOKBACK_MIN_MS = 2 * 3_600_000;

/**
 * Plafond de rattrapage.
 *
 * Une semaine couvre un arrêt de vacances ou une panne d'hébergeur. Au-delà, la
 * fenêtre demandée deviendrait si large que la liste dépasserait la pagination,
 * et un rendez-vous vieux d'une semaine n'a de toute façon plus d'intérêt
 * commercial — il a eu lieu, ou pas.
 */
const LOOKBACK_MAX_MS = 7 * 86_400_000;

const LOOKAHEAD_MS = 60 * 86_400_000;

/**
 * Nombre maximal de pages suivies sur la liste des rendez-vous.
 *
 * 🔴 IL N'Y AVAIT AUCUNE PAGINATION. La liste était demandée avec `count=50` et
 * `sort=start_time:asc`, et `pagination.next_page` n'était lu nulle part.
 * Au-delà de 50 rendez-vous actifs dans la fenêtre, ce sont les PLUS LOINTAINS
 * qui sortaient du champ — en silence, et sans que `remaining` le signale, parce
 * que ce compteur ne parlait que du plafond de créations.
 *
 * Cinq pages = 250 rendez-vous. Le plafond existe pour qu'une fenêtre élargie
 * par un rattrapage ne fasse pas exploser le nombre de requêtes ; s'il mord, il
 * le DIT (`pagesTronquees`).
 */
const MAX_PAGES = 5;

const TIMEOUT_MS = 8_000;

export interface DiscoverOutcome {
  readonly ok: boolean;
  /** Réservations vues côté Calendly. */
  readonly scanned: number;
  /** Lignes réellement créées (donc inconnues jusqu'ici). */
  readonly created: number;
  /** Présent si le plafond a été atteint — jamais de troncature muette. */
  readonly remaining?: string;
  /**
   * Profondeur de rattrapage réellement utilisée, en minutes.
   *
   * 🔑 C'est ce chiffre qui rend une panne VISIBLE. En régime normal il vaut le
   * minimum ; s'il grimpe, c'est que la passe n'avait rien vu depuis longtemps —
   * soit aucune réservation, soit un worker arrêté. Sans lui, les deux cas se
   * ressemblent, et le second est celui qui perd des rendez-vous.
   *
   * ⚠️ ABSENT quand la passe a échoué AVANT de calculer sa fenêtre — jeton
   * absent, utilisateur non résolu, liste illisible. Ne pas le confondre avec
   * « rattrapage nul » : dans ces cas-là, la passe n'a rien regardé du tout, et
   * c'est `reason` qui porte l'information.
   */
  readonly rattrapageMinutes?: number;
  /**
   * Vrai si la pagination a mordu son plafond : des rendez-vous LOINTAINS n'ont
   * pas été examinés. Silencieux jusqu'au 2026-08-28 — il n'y avait aucune
   * pagination du tout.
   */
  readonly pagesTronquees?: true;
  readonly reason?: string;
}

async function get(url: string, token: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Sondage : on veut l'état courant, jamais une réponse mise en cache.
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function str(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Slug technique de l'event-type.
 *
 * Un `scheduled_event` ne porte pas le slug — seulement le nom humain et l'URI
 * de l'event-type. On dérive donc le slug du nom, ce qui suffit à son usage
 * (référence stable d'affichage et de regroupement admin), et l'enrichissement
 * remplacera ensuite `eventTypeName` par le libellé officiel.
 */
function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return slug || "calendly";
}

/**
 * Crée les lignes manquantes pour les réservations actives connues de Calendly.
 *
 * Ne throw jamais : le cron appelant ne doit pas rougir parce que Calendly a
 * hoqueté.
 */
/**
 * Jusqu'où regarder en arrière, DÉRIVÉ de la dernière découverte réussie.
 *
 * Un chiffre fixe ne peut pas convenir : il couvre les pannes plus courtes que
 * lui et perd tout ce qui dépasse, sans que rien ne le dise. Celui-ci s'élargit
 * exactement autant que le silence a duré.
 *
 * `capturedAt` est posé à la création de chaque ligne : c'est la trace de la
 * dernière fois où cette passe a effectivement vu quelque chose. Si elle date de
 * cinq heures, on rattrape cinq heures ; si elle date de trois jours parce
 * qu'aucune réservation n'est arrivée, on rattrape trois jours — plus large que
 * nécessaire, mais jamais faux, et le coût est une requête un peu plus longue.
 *
 * ⚠️ Ne throw jamais : sans base lisible, on retombe sur le minimum. Un
 * rattrapage étroit vaut mieux qu'une passe qui n'a pas lieu.
 */
async function profondeurRattrapage(nowMs: number): Promise<number> {
  try {
    const derniere = await prisma.calendlyEvent.findFirst({
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true },
    });
    if (!derniere?.capturedAt) return LOOKBACK_MIN_MS;
    // Marge d'une heure : la découverte suit la réservation, elle ne la précède
    // pas — l'horodatage de capture est toujours un peu postérieur au fait.
    const ecart = nowMs - derniere.capturedAt.getTime() + 3_600_000;
    return Math.min(LOOKBACK_MAX_MS, Math.max(LOOKBACK_MIN_MS, ecart));
  } catch {
    return LOOKBACK_MIN_MS;
  }
}

export async function discoverNewCalendlyEvents(
  nowMs: number = Date.now(),
): Promise<DiscoverOutcome> {
  if (!isCalendlyApiConfigured()) {
    return { ok: true, scanned: 0, created: 0, reason: "not_configured" };
  }
  const token = process.env.CALENDLY_API_TOKEN?.trim();
  if (!token) return { ok: true, scanned: 0, created: 0, reason: "not_configured" };

  const me = record(record(await get(`${CALENDLY_API_BASE}/users/me`, token))?.["resource"]);
  const userUri = str(me?.["uri"], 255);
  if (!userUri) return { ok: false, scanned: 0, created: 0, reason: "user_unresolved" };

  const lookbackMs = await profondeurRattrapage(nowMs);

  const baseUrl =
    `${CALENDLY_API_BASE}/scheduled_events` +
    `?user=${encodeURIComponent(userUri)}` +
    `&status=active` +
    `&min_start_time=${encodeURIComponent(new Date(nowMs - lookbackMs).toISOString())}` +
    `&max_start_time=${encodeURIComponent(new Date(nowMs + LOOKAHEAD_MS).toISOString())}` +
    `&count=50&sort=start_time:asc`;

  // 🔴 PAGINATION — elle n'existait pas. `pagination.next_page` n'était lu nulle
  // part : au-delà de 50 rendez-vous actifs dans la fenêtre, les plus lointains
  // sortaient du champ, en silence. Le rattrapage élargi ci-dessus rend ce cas
  // BEAUCOUP plus probable, donc les deux corrections vont ensemble.
  const collection: unknown[] = [];
  let pagesTronquees = false;
  let url: string | null = baseUrl;
  for (let page = 0; page < MAX_PAGES && url; page++) {
    const corps = record(await get(url, token));
    const lot = corps?.["collection"];
    if (!Array.isArray(lot)) {
      // Une première page illisible est un échec ; une page SUIVANTE illisible
      // laisse ce qu'on a déjà, plutôt que de tout jeter.
      if (page === 0) return { ok: false, scanned: 0, created: 0, reason: "list_failed" };
      break;
    }
    collection.push(...lot);
    const suivante = record(corps?.["pagination"])?.["next_page"];
    url = typeof suivante === "string" && suivante.startsWith(CALENDLY_API_BASE) ? suivante : null;
    if (url && page === MAX_PAGES - 1) pagesTronquees = true;
  }

  let created = 0;
  let truncated = false;

  for (const raw of collection) {
    const ev = record(raw);
    if (!ev) continue;
    const eventUri = str(ev["uri"], 255);
    if (!eventUri) continue;

    if (created >= MAX_NEW_PER_RUN) {
      truncated = true;
      break;
    }

    // Déjà connue par la capture postMessage ou par un passage précédent.
    let known: { id: string } | null;
    try {
      known = await prisma.calendlyEvent.findFirst({ where: { eventUri }, select: { id: true } });
    } catch (e) {
      Sentry.captureException(e);
      return { ok: false, scanned: collection.length, created, reason: "db_read_failed" };
    }
    if (known) continue;

    // L'invitee porte l'identité stable de la réservation ; c'est elle qui
    // permettra ensuite l'enrichissement (nom, email, lien d'annulation).
    const invitees = record(await get(`${eventUri}/invitees?count=10`, token))?.["collection"];
    if (!Array.isArray(invitees)) continue;

    const firstInvitee = record(invitees[0]);
    const inviteeUri = str(firstInvitee?.["uri"], 255);
    if (!inviteeUri) continue;

    const name = str(ev["name"], 255) ?? "Calendly";
    const startTime = parseDate(ev["start_time"]);
    const endTime = parseDate(ev["end_time"]);

    let row: { id: string };
    try {
      row = await prisma.calendlyEvent.create({
        data: {
          eventTypeName: name,
          eventTypeSlug: slugify(name),
          status: "scheduled",
          source: "api_poll",
          eventUri,
          inviteeUri,
          ...(startTime ? { startTime } : {}),
          ...(endTime ? { endTime } : {}),
          rawPayload: ev as never,
        },
        select: { id: true },
      });
    } catch (e) {
      // P2002 : la capture postMessage a créé la même ligne entre notre lecture
      // et notre écriture. C'est exactement le doublon que la contrainte UNIQUE
      // est là pour empêcher — pas une erreur.
      if ((e as { code?: unknown })?.code === "P2002") continue;
      Sentry.captureException(e);
      return { ok: false, scanned: collection.length, created, reason: "db_write_failed" };
    }

    created += 1;

    // Remplit nom / email / téléphone / lien d'annulation. Best-effort : une
    // ligne non enrichie reste une ligne visible, ce qui est déjà l'essentiel.
    const enriched = await enrichCalendlyEvent(row.id);

    let inviteeName: string | null = null;
    let inviteeEmail: string | null = null;
    let inviteePhone: string | null = null;
    let cancelUrl: string | null = null;
    let start: Date | null = startTime;
    if (enriched.ok) {
      const fresh = await prisma.calendlyEvent
        .findUnique({
          where: { id: row.id },
          select: {
            inviteeName: true,
            inviteeEmail: true,
            inviteePhone: true,
            cancelUrl: true,
            startTime: true,
          },
        })
        .catch(() => null);
      if (fresh) {
        inviteeName = fresh.inviteeName;
        inviteeEmail = fresh.inviteeEmail;
        inviteePhone = fresh.inviteePhone;
        cancelUrl = fresh.cancelUrl;
        start = fresh.startTime ?? start;
      }
    }

    // Synchro CRM (lot L2) — après enrichissement : c'est lui qui apporte
    // l'adresse de l'invité, sans laquelle aucune clé de personne n'est
    // calculable (le postMessage de l'embed ne transmet aucune PII).
    if (inviteeEmail) {
      await syncCalendlyEventToCrm({
        kind: "booked",
        subjectRef: `site:calendly_event:${row.id}`,
        sourceSlug: "calendly",
        ...(start ? { occurredAt: start } : {}),
        person: {
          email: inviteeEmail,
          fullName: inviteeName,
          phone: inviteePhone,
        },
        payload: { eventTypeName: name, source: "api_poll" },
      });
    }

    // Même alerte que pour une capture depuis /appel : c'est le même
    // évènement commercial, quel que soit le chemin emprunté par le client.
    try {
      await notify({
        category: "CALENDLY_INVITEE_CREATED",
        payload: {
          eventUri: row.id,
          inviteeEmail: inviteeEmail ?? "(non communiqué)",
          inviteeName: inviteeName ?? "(non communiqué)",
          eventStartTime: start?.toISOString() ?? "(voir mail Calendly)",
          eventName: name,
          ...(inviteePhone ? { inviteePhone } : {}),
          ...(cancelUrl ? { cancelUrl } : {}),
          ...(enriched.ok && enriched.answersText ? { answersText: enriched.answersText } : {}),
        },
        dedupKey: row.id,
      });
    } catch (e) {
      Sentry.captureException(e);
    }
  }

  return {
    ok: true,
    scanned: collection.length,
    created,
    rattrapageMinutes: Math.round(lookbackMs / 60_000),
    ...(truncated
      ? { remaining: "plafond atteint — augmenter MAX_NEW_PER_RUN ou la fréquence" }
      : {}),
    ...(pagesTronquees ? { pagesTronquees: true as const } : {}),
  };
}
