// Tests des disponibilités rendues côté serveur (ADR 0038).
//
// Ce module décide de ce que /appel affiche — le funnel unique du site. Trois
// risques justifient une couverture serrée :
//
//   1. le REPLI. Toute défaillance doit produire un `{ ok: false }` propre, car
//      c'est lui qui ramène `CalendlyConsentGate`. Un throw casserait la page
//      entière, et un `ok: true` vide afficherait un calendrier sans créneaux.
//   2. la CLÉ DE CACHE. La fenêtre de temps est dans l'URL : si elle suivait
//      l'horloge, chaque rendu taperait l'API. La quantification est invisible
//      à l'œil et se re-casserait sans test.
//   3. les URL RELAYÉES. `scheduling_url` vient de la réponse d'API et finit en
//      `href` dans la page.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAvailableSlots, parisDayKey, SLOTS_REVALIDATE_SECONDS } from "../availability";

const fetchMock = vi.fn();

const PUBLIC_URL = "https://calendly.com/axion-ia/premier-contact";
const USER_URI = "https://api.calendly.com/users/USER";
const EVENT_TYPE_URI = "https://api.calendly.com/event_types/ET";

/** 2026-08-03T09:00:00Z, un lundi — hors de tout changement d'heure. */
const NOW = Date.UTC(2026, 7, 3, 9, 0, 0);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  process.env.CALENDLY_API_TOKEN = "pat_test_token";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CALENDLY_API_TOKEN;
});

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function slot(startIso: string, extra: Record<string, unknown> = {}) {
  return {
    status: "available",
    invitees_remaining: 1,
    start_time: startIso,
    scheduling_url: `${PUBLIC_URL}/${startIso}`,
    ...extra,
  };
}

/**
 * Route les réponses par URL plutôt que par ordre d'appel : les deux fenêtres
 * de disponibilité partent en parallèle, leur ordre d'arrivée n'est pas garanti.
 */
function routeFetch(opts: {
  me?: Response;
  eventTypes?: Response;
  times?: (url: string) => Response;
}) {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/users/me")) {
      return Promise.resolve(opts.me ?? jsonRes({ resource: { uri: USER_URI } }));
    }
    if (url.includes("/event_types?")) {
      return Promise.resolve(
        opts.eventTypes ??
          jsonRes({
            collection: [
              {
                uri: "https://api.calendly.com/event_types/AUTRE",
                scheduling_url: "https://calendly.com/axion-ia/autre",
              },
              { uri: EVENT_TYPE_URI, scheduling_url: PUBLIC_URL },
            ],
          }),
      );
    }
    if (url.includes("/event_type_available_times")) {
      return Promise.resolve(opts.times ? opts.times(url) : jsonRes({ collection: [] }));
    }
    return Promise.resolve(jsonRes({}, 404));
  });
}

describe("fetchAvailableSlots — le repli est le comportement par défaut", () => {
  it("sans jeton : ne touche pas au réseau", async () => {
    delete process.env.CALENDLY_API_TOKEN;
    const res = await fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: NOW });
    expect(res).toEqual({ ok: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["URL absente", undefined],
    ["hôte voisin", "https://calendly.com.attacker.test/axion-ia/premier-contact"],
    ["HTTP en clair", "http://calendly.com/axion-ia/premier-contact"],
    ["domaine tiers", "https://evil.test/calendly.com/premier-contact"],
  ])("URL publique refusée (%s) : aucun appel émis", async (_label, url) => {
    const res = await fetchAvailableSlots({ schedulingUrl: url, nowMs: NOW });
    expect(res).toEqual({ ok: false, reason: "bad_url" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("401/403 (jeton révoqué ou plan sans accès API) : `forbidden`, pas d'exception", async () => {
    routeFetch({ me: jsonRes({ message: "nope" }, 403) });
    await expect(fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: NOW })).resolves.toEqual({
      ok: false,
      reason: "forbidden",
    });
  });

  it("réseau injoignable : `api_error`, pas d'exception", async () => {
    fetchMock.mockRejectedValue(new Error("ETIMEDOUT"));
    await expect(fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: NOW })).resolves.toEqual({
      ok: false,
      reason: "api_error",
    });
  });

  it("aucun event-type ne correspond à l'URL publique : `no_event_type`", async () => {
    routeFetch({
      eventTypes: jsonRes({
        collection: [
          {
            uri: "https://api.calendly.com/event_types/X",
            scheduling_url: "https://calendly.com/axion-ia/autre",
          },
        ],
      }),
    });
    await expect(fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: NOW })).resolves.toEqual({
      ok: false,
      reason: "no_event_type",
    });
  });

  it("agenda plein : `no_slots` plutôt qu'un calendrier vide", async () => {
    routeFetch({ times: () => jsonRes({ collection: [] }) });
    await expect(fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: NOW })).resolves.toEqual({
      ok: false,
      reason: "no_slots",
    });
  });

  it("l'URL publique est comparée sans tenir compte du slash final ni de la casse", async () => {
    routeFetch({ times: () => jsonRes({ collection: [slot("2026-08-04T07:00:00Z")] }) });
    const res = await fetchAvailableSlots({
      schedulingUrl: `${PUBLIC_URL.toUpperCase()}/`,
      nowMs: NOW,
    });
    expect(res.ok).toBe(true);
  });
});

describe("fetchAvailableSlots — nominal", () => {
  it("groupe par jour civil de Paris, trie, et respecte les plafonds", async () => {
    routeFetch({
      times: (url) =>
        // Seule la première fenêtre porte des créneaux ; la seconde est vide.
        url.includes("2026-08-03")
          ? jsonRes({
              collection: [
                // Volontairement en désordre.
                slot("2026-08-04T12:00:00Z"),
                slot("2026-08-04T07:00:00Z"),
                slot("2026-08-05T08:00:00Z"),
              ],
            })
          : jsonRes({ collection: [] }),
    });

    const res = await fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: NOW });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.days.map((d) => d.dateKey)).toEqual(["2026-08-04", "2026-08-05"]);
    expect(res.days[0]?.slots.map((s) => s.startIso)).toEqual([
      "2026-08-04T07:00:00.000Z",
      "2026-08-04T12:00:00.000Z",
    ]);
  });

  it("plafonne le nombre de jours et de créneaux par jour", async () => {
    routeFetch({
      times: (url) =>
        url.includes("2026-08-03")
          ? jsonRes({
              collection: [
                slot("2026-08-04T07:00:00Z"),
                slot("2026-08-04T08:00:00Z"),
                slot("2026-08-04T09:00:00Z"),
                slot("2026-08-05T07:00:00Z"),
                slot("2026-08-06T07:00:00Z"),
              ],
            })
          : jsonRes({ collection: [] }),
    });

    const res = await fetchAvailableSlots({
      schedulingUrl: PUBLIC_URL,
      maxDays: 2,
      maxSlotsPerDay: 2,
      nowMs: NOW,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.days).toHaveLength(2);
    expect(res.days[0]?.slots).toHaveLength(2);
  });

  it("ignore les créneaux pris, sans horaire, ou dont l'URL de réservation n'est pas Calendly", async () => {
    routeFetch({
      times: (url) =>
        url.includes("2026-08-03")
          ? jsonRes({
              collection: [
                slot("2026-08-04T07:00:00Z"),
                slot("2026-08-04T08:00:00Z", { status: "unavailable" }),
                slot("2026-08-04T09:00:00Z", { invitees_remaining: 0 }),
                slot("2026-08-04T10:00:00Z", { start_time: "pas une date" }),
                slot("2026-08-04T11:00:00Z", { scheduling_url: "https://evil.test/booking" }),
              ],
            })
          : jsonRes({ collection: [] }),
    });

    const res = await fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: NOW });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.days.flatMap((d) => d.slots.map((s) => s.startIso))).toEqual([
      "2026-08-04T07:00:00.000Z",
    ]);
  });

  it("une fenêtre lointaine en échec n'emporte pas les créneaux proches", async () => {
    routeFetch({
      times: (url) =>
        url.includes("2026-08-03")
          ? jsonRes({ collection: [slot("2026-08-04T07:00:00Z")] })
          : jsonRes({ message: "boom" }, 500),
    });
    const res = await fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: NOW });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.days).toHaveLength(1);
  });

  it("dédoublonne un créneau renvoyé par les deux fenêtres contiguës", async () => {
    routeFetch({ times: () => jsonRes({ collection: [slot("2026-08-04T07:00:00Z")] }) });
    const res = await fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: NOW });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.days.flatMap((d) => d.slots)).toHaveLength(1);
  });
});

describe("fetchAvailableSlots — la fenêtre de temps est une clé de cache", () => {
  function timesUrls(): string[] {
    return fetchMock.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes("/event_type_available_times"));
  }

  it("deux rendus dans le même intervalle demandent EXACTEMENT la même URL", async () => {
    routeFetch({ times: () => jsonRes({ collection: [slot("2026-08-04T07:00:00Z")] }) });

    await fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: NOW });
    const first = timesUrls();
    fetchMock.mockClear();

    // 30 secondes plus tard, puis presque au bout de l'intervalle.
    await fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: NOW + 30_000 });
    await fetchAvailableSlots({
      schedulingUrl: PUBLIC_URL,
      nowMs: NOW + SLOTS_REVALIDATE_SECONDS * 1_000 - 1,
    });

    const later = timesUrls();
    expect(later.slice(0, first.length)).toEqual(first);
    expect(later.slice(first.length)).toEqual(first);
  });

  it("l'intervalle franchi, l'URL change — sinon le cache ne se renouvellerait jamais", async () => {
    routeFetch({ times: () => jsonRes({ collection: [slot("2026-08-04T07:00:00Z")] }) });

    await fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: NOW });
    const first = timesUrls();
    fetchMock.mockClear();

    await fetchAvailableSlots({
      schedulingUrl: PUBLIC_URL,
      nowMs: NOW + SLOTS_REVALIDATE_SECONDS * 1_000,
    });
    expect(timesUrls()).not.toEqual(first);
  });

  it("le début demandé est TOUJOURS dans le futur — l'API rejette un start_time passé", async () => {
    routeFetch({ times: () => jsonRes({ collection: [slot("2026-08-04T07:00:00Z")] }) });

    // Instant pile sur un multiple de l'intervalle : le cas où un arrondi
    // naïf produirait « maintenant », donc un départ non strictement futur.
    const aligned =
      Math.floor(NOW / (SLOTS_REVALIDATE_SECONDS * 1_000)) * SLOTS_REVALIDATE_SECONDS * 1_000;
    await fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: aligned });

    for (const url of timesUrls()) {
      const start = new Date(decodeURIComponent(/start_time=([^&]+)/.exec(url)?.[1] ?? ""));
      expect(start.getTime()).toBeGreaterThan(aligned);
    }
  });

  it("chaque fenêtre demandée reste sous la borne de 7 jours de l'API", async () => {
    routeFetch({ times: () => jsonRes({ collection: [slot("2026-08-04T07:00:00Z")] }) });
    await fetchAvailableSlots({ schedulingUrl: PUBLIC_URL, nowMs: NOW });

    const urls = timesUrls();
    expect(urls.length).toBeGreaterThan(1);
    for (const url of urls) {
      const start = new Date(decodeURIComponent(/start_time=([^&]+)/.exec(url)?.[1] ?? ""));
      const end = new Date(decodeURIComponent(/end_time=([^&]+)/.exec(url)?.[1] ?? ""));
      expect(end.getTime() - start.getTime()).toBeGreaterThan(0);
      expect(end.getTime() - start.getTime()).toBeLessThan(7 * 86_400_000);
    }
  });
});

describe("parisDayKey", () => {
  it("regroupe sur le jour de PARIS, pas sur celui du serveur en UTC", () => {
    // 22 h 30 UTC en été = 00 h 30 le lendemain à Paris.
    expect(parisDayKey(new Date("2026-08-04T22:30:00Z"))).toBe("2026-08-05");
    // En hiver, +1 h seulement : 23 h 30 UTC reste le 4 à Paris.
    expect(parisDayKey(new Date("2026-01-04T22:30:00Z"))).toBe("2026-01-04");
  });
});
