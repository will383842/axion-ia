/**
 * Route PUBLIQUE `client-event` — un échange formateur n'en ressort ni au CRM
 * ni en alerte (chantier « formateurs freelance », lot F-CAL-1, 2026-10-09).
 *
 * La route écrit sans authentification (cf. son bandeau : le contrôle d'origine
 * ne ferme pas l'appel scripté). Un POST forgé portant un slug « formateur »
 * aboutissait, comme tout type ni apporteur ni salon, à une fiche au CRM des
 * ventes et à une alerte sur le téléphone du gérant.
 *
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
const notifier = vi.fn(async (..._a: unknown[]) => ({ ok: true, channels: {} }));
vi.mock("@/server/notifications", () => ({
  notify: (...a: unknown[]) => notifier(...a),
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
    }),
  });
}

function ligneEnrichie(eventTypeName: string, typeRendezVous: string | null) {
  return {
    inviteeName: "Camille",
    inviteeEmail: "camille@exemple.test",
    inviteePhone: null,
    startTime: new Date("2026-10-20T07:00:00Z"),
    location: null,
    eventTypeName,
    typeRendezVous,
    rawPayload: { invitee: {}, event: {} },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRM_SYNC_ENABLED = "true";
  calendlyCreate.mockResolvedValue({ id: "evt_1" });
  enrichMock.mockResolvedValue({ ok: false, reason: "network_error" });
  calendlyFindUnique.mockResolvedValue(null);
});

describe("POST forgé avec un slug « formateur »", () => {
  it.each(["echange-formateur-independant", "FORMATEUR", "diagnostic-ia-formateur"])(
    "🔴 « %s » sans enrichissement : 0 synchro CRM, 0 alerte",
    async (slug) => {
      const { POST } = await import("../route");
      const res = await POST(requete(slug));
      expect(res.status).toBe(200);
      expect(enfilerCrm).not.toHaveBeenCalled();
      expect(notifier).not.toHaveBeenCalled();
    },
  );

  it("🔴 enrichi en « Échange formateur indépendant (20 min) » classé autre : 0 CRM, 0 alerte", async () => {
    enrichMock.mockResolvedValue({ ok: true, updatedFields: [], answersText: null });
    calendlyFindUnique.mockResolvedValue(
      ligneEnrichie("Échange formateur indépendant (20 min)", "autre"),
    );
    const { POST } = await import("../route");
    await POST(requete("echange-formateur-independant"));
    expect(enfilerCrm).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
  });

  it("🔴 slug neutre, mais le nom relu après enrichissement dit « formateur » : 0 CRM, 0 alerte", async () => {
    enrichMock.mockResolvedValue({ ok: true, updatedFields: [], answersText: null });
    calendlyFindUnique.mockResolvedValue(ligneEnrichie("Échange formateur indépendant", null));
    const { POST } = await import("../route");
    await POST(requete("rendez-vous-20-min"));
    expect(enfilerCrm).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
  });
});

describe("TÉMOINS — comportement client et apporteur inchangé", () => {
  it("échange projet : part au CRM, l'alerte part", async () => {
    const { POST } = await import("../route");
    await POST(requete("premier-contact"));
    expect(enfilerCrm).toHaveBeenCalledTimes(1);
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  it("« formation-ia-diagnostic » : part au CRM, l'alerte part", async () => {
    const { POST } = await import("../route");
    await POST(requete("formation-ia-diagnostic"));
    expect(enfilerCrm).toHaveBeenCalledTimes(1);
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  it("échange apporteur : pas de CRM, mais l'alerte part toujours", async () => {
    const { POST } = await import("../route");
    await POST(requete("echange-apporteur"));
    expect(enfilerCrm).not.toHaveBeenCalled();
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  it("les deux mots : reste apporteur — pas de CRM, l'alerte part", async () => {
    const { POST } = await import("../route");
    await POST(requete("echange-apporteur-formateur"));
    expect(enfilerCrm).not.toHaveBeenCalled();
    expect(notifier).toHaveBeenCalledTimes(1);
  });
});
