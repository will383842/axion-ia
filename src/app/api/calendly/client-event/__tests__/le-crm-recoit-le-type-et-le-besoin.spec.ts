/**
 * Chemin iframe (/appel) — contrat CRM des rendez-vous (2026-10-04).
 *
 * Ce chemin n'envoyait que `eventTypeSlug`, sans `eventTypeName` : la garde
 * anti-apporteur, qui lisait le nom, ne jouait pas ici. Désormais le payload
 * porte TOUJOURS le nom, le type et le besoin, et un apporteur ne part pas.
 * `syncCalendlyEventToCrm` est le VRAI ; seule la mise en file est simulée.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({
    allowed: true,
    count: 1,
    remaining: 4,
    resetAt: Date.now() + 60_000,
  }),
}));
vi.mock("@/lib/security/ip-hash", () => ({
  hashIp: (ip: string | null) => (ip ? `h-${ip}` : null),
}));
vi.mock("@/server/notifications", () => ({
  notify: vi.fn(async () => ({ ok: true, channels: {} })),
}));
vi.mock("@/server/google-calendar/events", () => ({ colorerReservationCalendly: vi.fn() }));

const enfilerCrm = vi.fn(async (..._a: unknown[]) => "evt");
vi.mock("@/server/crm-sync/enqueue", () => ({
  enqueueCrmSyncEvent: (...a: unknown[]) => enfilerCrm(...a),
  newCrmEventId: () => "id-1",
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => (e ? `h-${e}` : null),
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
}));

const enrichMock = vi.fn();
vi.mock("@/server/calendly/enrich", () => ({
  enrichCalendlyEvent: (...a: unknown[]) => enrichMock(...a),
}));
vi.mock("@/server/calendly/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isCalendlyApiConfigured: () => true,
}));

const calendlyFindUnique = vi.fn();
const calendlyCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findFirst: vi.fn(async () => null),
      findUnique: (...a: unknown[]) => calendlyFindUnique(...a),
      create: (...a: unknown[]) => calendlyCreate(...a),
    },
  },
}));

function requete(slug: string): NextRequest {
  return new NextRequest("https://test.local/api/calendly/client-event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "test.local",
      "x-forwarded-proto": "https",
      origin: "https://test.local",
    },
    body: JSON.stringify({
      eventName: "calendly.event_scheduled",
      payload: { invitee: { name: "Camille", email: "camille@exemple.test" } },
      eventTypeSlug: slug,
      pageUrl: "https://axion-ia.com/fr/appel",
      utmContent: "projet",
    }),
  });
}

function payloadEmis(): Record<string, unknown> {
  return (enfilerCrm.mock.calls[0]?.[0] as { payload: Record<string, unknown> }).payload;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRM_SYNC_ENABLED = "true";
  calendlyCreate.mockResolvedValue({ id: "evt_1" });
  enrichMock.mockResolvedValue({ ok: false, reason: "network_error" });
  calendlyFindUnique.mockResolvedValue(null);
});

describe("chemin iframe : le CRM reçoit le type et le besoin", () => {
  it("🔴 un échange apporteur ne part pas au CRM", async () => {
    const { POST } = await import("../route");
    const res = await POST(requete("echange-apporteur-affaires"));
    expect(res.status).toBe(200);
    expect(calendlyCreate.mock.calls[0]?.[0]?.data).toMatchObject({ typeRendezVous: "apporteur" });
    expect(enfilerCrm).not.toHaveBeenCalled();
  });

  it("🔴 après enrichissement : nom lisible, type de la ligne, besoin de la réponse", async () => {
    enrichMock.mockResolvedValue({ ok: true, updatedFields: [], answersText: null });
    calendlyFindUnique.mockResolvedValue({
      inviteeName: "Camille",
      inviteeEmail: "camille@exemple.test",
      inviteePhone: null,
      startTime: new Date("2026-10-10T07:00:00Z"),
      location: null,
      eventTypeName: "Diagnostic IA",
      typeRendezVous: "diagnostic",
      rawPayload: {
        invitee: { questions_and_answers: [{ question: "Votre besoin", answer: "Audit" }] },
        event: {},
      },
    });
    const { POST } = await import("../route");
    await POST(requete("diagnostic-ia"));
    expect(payloadEmis()).toMatchObject({
      eventTypeSlug: "diagnostic-ia",
      eventTypeName: "Diagnostic IA",
      typeRendezVous: "diagnostic",
      besoin: "Audit",
      utmContent: "projet",
    });
  });

  it("sans enrichissement : le slug sert de nom, type provisoire, besoin null", async () => {
    const { POST } = await import("../route");
    await POST(requete("premier-contact"));
    expect(calendlyCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      typeRendezVous: "echange_projet",
      utmContent: "projet",
    });
    expect(payloadEmis()).toMatchObject({
      eventTypeName: "premier-contact",
      typeRendezVous: "echange_projet",
      besoin: null,
    });
  });
});
