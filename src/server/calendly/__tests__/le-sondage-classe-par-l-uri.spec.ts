/**
 * Le sondage (`discover.ts`) écrit le TYPE et l'URI du type, recopie les UTM du
 * `tracking` de l'invité, et envoie au CRM le contrat complet (2026-10-04).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const enrichMock = vi.fn();
vi.mock("../enrich", () => ({ enrichCalendlyEvent: (...a: unknown[]) => enrichMock(...a) }));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/server/google-calendar/events", () => ({ colorerReservationCalendly: vi.fn() }));
const syncMock = vi.fn();
vi.mock("@/server/crm-sync", () => ({
  syncCalendlyEventToCrm: (...a: unknown[]) => syncMock(...a),
}));

const findFirstMock = vi.fn();
const findUniqueMock = vi.fn();
const createMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findFirst: (...a: unknown[]) => findFirstMock(...a),
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      create: (...a: unknown[]) => createMock(...a),
    },
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { discoverNewCalendlyEvents } from "../discover";
import { reinitialiserCacheTypesRendezVous } from "../type-rendez-vous";

const fetchMock = vi.fn();
const EVENT_URI = "https://api.calendly.com/scheduled_events/E1";
const URI_PROJET = "https://api.calendly.com/event_types/PROJET";

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Le compte : un type « premier-contact », RENOMMÉ « Parlons de vous ». */
function routeFetch() {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/users/me")) {
      return Promise.resolve(jsonRes({ resource: { uri: "https://api.calendly.com/users/U" } }));
    }
    if (url.includes("/event_types?")) {
      return Promise.resolve(
        jsonRes({
          collection: [
            { uri: URI_PROJET, scheduling_url: "https://calendly.com/axion-ia/premier-contact" },
          ],
        }),
      );
    }
    if (url.includes("/scheduled_events?")) {
      return Promise.resolve(
        jsonRes({
          collection: [
            {
              uri: EVENT_URI,
              name: "Parlons de vous",
              event_type: URI_PROJET,
              start_time: "2026-10-10T07:00:00Z",
              end_time: "2026-10-10T07:45:00Z",
            },
          ],
        }),
      );
    }
    if (url.includes("/invitees")) {
      return Promise.resolve(
        jsonRes({
          collection: [
            {
              uri: `${EVENT_URI}/invitees/I1`,
              tracking: { utm_source: "linkedin", utm_campaign: "oct", utm_content: "projet" },
              questions_and_answers: [{ question: "Quel service ?", answer: "Formation" }],
            },
          ],
        }),
      );
    }
    return Promise.resolve(jsonRes({}, 404));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  reinitialiserCacheTypesRendezVous();
  vi.stubGlobal("fetch", fetchMock);
  process.env.CALENDLY_API_TOKEN = "pat_test";
  findFirstMock.mockResolvedValue(null);
  createMock.mockResolvedValue({ id: "row_1" });
  enrichMock.mockResolvedValue({ ok: true, updatedFields: [], answersText: null });
  findUniqueMock.mockResolvedValue({
    inviteeName: "Camille",
    inviteeEmail: "camille@exemple.test",
    inviteePhone: null,
    cancelUrl: null,
    startTime: new Date("2026-10-10T07:00:00Z"),
    location: null,
  });
  routeFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CALENDLY_API_TOKEN;
});

describe("le sondage classe par l'URI", () => {
  it("🔴 écrit type + URI (type renommé), et les UTM du tracking", async () => {
    const res = await discoverNewCalendlyEvents();
    expect(res.created).toBe(1);
    const data = createMock.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data).toMatchObject({
      typeRendezVous: "echange_projet",
      eventTypeUri: URI_PROJET,
      utmSource: "linkedin",
      utmCampaign: "oct",
      utmContent: "projet",
    });
    expect(data).not.toHaveProperty("utmMedium");
  });

  it("🔴 le payload CRM porte nom, type et besoin", async () => {
    await discoverNewCalendlyEvents();
    const payload = (syncMock.mock.calls[0]?.[0] as { payload: Record<string, unknown> }).payload;
    expect(payload).toMatchObject({
      eventTypeName: "Parlons de vous",
      typeRendezVous: "echange_projet",
      besoin: "Formation",
      source: "api_poll",
    });
  });

  it("fenêtre app/worker : colonne absente → la réservation est écrite sans elle", async () => {
    createMock
      .mockRejectedValueOnce({
        code: "P2022",
        message: "The column `calendly_events.type_rendez_vous` does not exist",
      })
      .mockResolvedValueOnce({ id: "row_1" });
    const res = await discoverNewCalendlyEvents();
    expect(res.created).toBe(1);
    const second = createMock.mock.calls[1]?.[0]?.data as Record<string, unknown>;
    expect(second).not.toHaveProperty("typeRendezVous");
    expect(second).not.toHaveProperty("eventTypeUri");
    expect(second).not.toHaveProperty("utmContent");
    expect(second).toMatchObject({ eventUri: EVENT_URI, utmSource: "linkedin" });
  });
});
