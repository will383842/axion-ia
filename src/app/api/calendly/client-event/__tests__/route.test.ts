// Tests POST /api/calendly/client-event (Sprint Notif Infra 2026-05-26 / Chantier 3).
//
// On mocke Prisma + rate-limit + notify + hashIp pour tester sans dependances.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks ---------------------------------------------------------------------

const checkRateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));

vi.mock("@/lib/security/ip-hash", () => ({
  hashIp: (ip: string | null | undefined) => (ip ? `hash-${ip}` : null),
}));

const notifyMock = vi.fn();
vi.mock("@/server/notifications", () => ({
  notify: (...args: unknown[]) => notifyMock(...args),
}));

const calendlyFindFirst = vi.fn();
const calendlyCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findFirst: (...args: unknown[]) => calendlyFindFirst(...args),
      create: (...args: unknown[]) => calendlyCreate(...args),
    },
  },
}));

// ---------------------------------------------------------------------------

function makeRequest(body: unknown, opts: { ip?: string } = {}): Request {
  return new Request("https://test.local/api/calendly/client-event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.ip ? { "x-forwarded-for": opts.ip } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID_PAYLOAD = {
  eventName: "calendly.event_scheduled" as const,
  payload: { invitee: { name: "John Doe", email: "john@example.com" } },
  eventTypeSlug: "appel-decouverte",
  pageUrl: "https://axion-ia.com/fr/appel",
  utmSource: "linkedin",
};

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({
    allowed: true,
    count: 1,
    remaining: 4,
    resetAt: Date.now() + 60_000,
  });
  calendlyFindFirst.mockResolvedValue(null);
  calendlyCreate.mockResolvedValue({ id: "evt_abc" });
  notifyMock.mockResolvedValue({ ok: true, channels: {} });
});

describe("POST /api/calendly/client-event", () => {
  it("happy path — 200 + event créé + notify appelé", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_PAYLOAD, { ip: "1.2.3.4" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, eventId: "evt_abc" });
    expect(calendlyCreate).toHaveBeenCalledOnce();
    expect(notifyMock).toHaveBeenCalledOnce();
    const call = notifyMock.mock.calls[0]?.[0] as { category: string };
    expect(call.category).toBe("CALENDLY_INVITEE_CREATED");
  });

  it("rate limit dépassé → 429", async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      count: 6,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_PAYLOAD));
    expect(res.status).toBe(429);
    expect(calendlyCreate).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("JSON invalide → 400 invalid_json", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest("not-json{{{"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_json");
  });

  it("payload invalide (eventName != event_scheduled) → 400 invalid_payload", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({
        ...VALID_PAYLOAD,
        eventName: "calendly.profile_page_viewed",
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_payload");
  });

  it("dédup 60s → 200 deduped, pas de create ni notify", async () => {
    calendlyFindFirst.mockResolvedValueOnce({ id: "prev_evt" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_PAYLOAD, { ip: "5.6.7.8" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, deduped: true });
    expect(calendlyCreate).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("payload sans invitee.email → inviteeEmail/Name omis, event créé quand même", async () => {
    const { POST } = await import("../route");
    const payloadNoPii = {
      ...VALID_PAYLOAD,
      payload: { event: { uri: "..." } }, // pas d'invitee
    };
    const res = await POST(makeRequest(payloadNoPii));
    expect(res.status).toBe(200);
    expect(calendlyCreate).toHaveBeenCalledOnce();
    const createArgs = calendlyCreate.mock.calls[0]?.[0] as {
      data: { inviteeName?: string; inviteeEmail?: string };
    };
    expect(createArgs.data.inviteeName).toBeUndefined();
    expect(createArgs.data.inviteeEmail).toBeUndefined();
  });
});
