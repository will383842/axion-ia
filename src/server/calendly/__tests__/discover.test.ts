// Tests de la découverte des réservations prises hors du site (ADR 0038).
//
// Ce module est le filet qui empêche ADR 0038 de faire disparaître des leads :
// depuis que cliquer un créneau ouvre calendly.com, plus aucun `postMessage`
// n'annonce la réservation. Deux propriétés doivent tenir, et aucune n'est
// visible à l'œil nu en production :
//
//   • ne JAMAIS créer de doublon d'une réservation déjà captée — la console de
//     Will deviendrait inexploitable, et Telegram sonnerait deux fois ;
//   • ne JAMAIS lever — l'appelant est un cron horaire qui rafraîchit aussi les
//     statuts ; une exception ici emporterait ce travail-là avec elle.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const enrichMock = vi.fn();
vi.mock("../enrich", () => ({
  enrichCalendlyEvent: (...args: unknown[]) => enrichMock(...args),
}));

const notifyMock = vi.fn();
vi.mock("@/server/notifications", () => ({
  notify: (...args: unknown[]) => notifyMock(...args),
}));

const findFirstMock = vi.fn();
const findUniqueMock = vi.fn();
const createMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { discoverNewCalendlyEvents } from "../discover";

const fetchMock = vi.fn();
const USER_URI = "https://api.calendly.com/users/USER";
const EVENT_URI = "https://api.calendly.com/scheduled_events/E1";
const INVITEE_URI = `${EVENT_URI}/invitees/I1`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  process.env.CALENDLY_API_TOKEN = "pat_test_token";
  enrichMock.mockResolvedValue({ ok: true, updatedFields: [] });
  findUniqueMock.mockResolvedValue({
    inviteeName: "Marie Durand",
    inviteeEmail: "marie@example.test",
    startTime: new Date("2026-08-04T07:00:00Z"),
  });
  createMock.mockResolvedValue({ id: "row_1" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CALENDLY_API_TOKEN;
});

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function routeFetch(events: unknown[], invitees: unknown[] = [{ uri: INVITEE_URI }]) {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/users/me")) {
      return Promise.resolve(jsonRes({ resource: { uri: USER_URI } }));
    }
    if (url.includes("/scheduled_events?")) {
      return Promise.resolve(jsonRes({ collection: events }));
    }
    if (url.includes("/invitees")) {
      return Promise.resolve(jsonRes({ collection: invitees }));
    }
    return Promise.resolve(jsonRes({}, 404));
  });
}

const EVENT = {
  uri: EVENT_URI,
  name: "Premier contact — 30 min",
  start_time: "2026-08-04T07:00:00Z",
  end_time: "2026-08-04T07:30:00Z",
};

describe("discoverNewCalendlyEvents", () => {
  it("sans jeton : aucun appel réseau, et ce n'est pas une erreur", async () => {
    delete process.env.CALENDLY_API_TOKEN;
    const res = await discoverNewCalendlyEvents();
    expect(res).toEqual({ ok: true, scanned: 0, created: 0, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("crée la ligne d'une réservation inconnue, puis l'enrichit et alerte", async () => {
    routeFetch([EVENT]);
    findFirstMock.mockResolvedValue(null);

    const res = await discoverNewCalendlyEvents();

    expect(res.ok).toBe(true);
    expect(res.created).toBe(1);

    const data = createMock.mock.calls[0]?.[0]?.data;
    expect(data).toMatchObject({
      source: "api_poll",
      eventUri: EVENT_URI,
      inviteeUri: INVITEE_URI,
      eventTypeSlug: "premier-contact-30-min",
      status: "scheduled",
    });
    expect(enrichMock).toHaveBeenCalledWith("row_1");

    // L'alerte doit porter le contact que l'enrichissement vient de résoudre,
    // pas « (non communiqué) » : c'est tout l'intérêt de l'enchaînement.
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "CALENDLY_INVITEE_CREATED",
        payload: expect.objectContaining({ inviteeEmail: "marie@example.test" }),
      }),
    );
  });

  it("ne recrée pas une réservation déjà captée par le postMessage", async () => {
    routeFetch([EVENT]);
    findFirstMock.mockResolvedValue({ id: "deja_la" });

    const res = await discoverNewCalendlyEvents();

    expect(res.created).toBe(0);
    expect(createMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("une course avec la capture postMessage (P2002) est un doublon, pas une erreur", async () => {
    routeFetch([EVENT]);
    findFirstMock.mockResolvedValue(null);
    createMock.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

    const res = await discoverNewCalendlyEvents();

    expect(res.ok).toBe(true);
    expect(res.created).toBe(0);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("un évènement sans invitee exploitable est ignoré, sans bloquer les suivants", async () => {
    routeFetch([EVENT], []);
    findFirstMock.mockResolvedValue(null);

    const res = await discoverNewCalendlyEvents();

    expect(res.ok).toBe(true);
    expect(res.created).toBe(0);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("API injoignable : réponse en échec, jamais d'exception", async () => {
    fetchMock.mockRejectedValue(new Error("ETIMEDOUT"));
    await expect(discoverNewCalendlyEvents()).resolves.toMatchObject({ ok: false });
  });

  it("plafonne les créations et signale la troncature au lieu de la taire", async () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      ...EVENT,
      uri: `https://api.calendly.com/scheduled_events/E${i}`,
    }));
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/users/me"))
        return Promise.resolve(jsonRes({ resource: { uri: USER_URI } }));
      if (url.includes("/scheduled_events?")) return Promise.resolve(jsonRes({ collection: many }));
      if (url.includes("/invitees")) {
        return Promise.resolve(jsonRes({ collection: [{ uri: `${url}/I` }] }));
      }
      return Promise.resolve(jsonRes({}, 404));
    });
    findFirstMock.mockResolvedValue(null);
    createMock.mockImplementation(() =>
      Promise.resolve({ id: `row_${createMock.mock.calls.length}` }),
    );

    const res = await discoverNewCalendlyEvents();

    expect(res.created).toBe(10);
    expect(res.remaining).toMatch(/plafond/i);
  });

  it("interroge une fenêtre qui commence AVANT maintenant — un RDV imminent annulé doit rester visible", async () => {
    routeFetch([]);
    findFirstMock.mockResolvedValue(null);
    const now = Date.UTC(2026, 7, 3, 9, 0, 0);

    await discoverNewCalendlyEvents(now);

    const listUrl = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .find((u) => u.includes("/scheduled_events?"));
    const min = new Date(
      decodeURIComponent(/min_start_time=([^&]+)/.exec(listUrl ?? "")?.[1] ?? ""),
    );
    expect(min.getTime()).toBeLessThan(now);
  });
});
