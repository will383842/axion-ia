// Tests de l'enrichissement d'un CalendlyEvent (ADR 0036).
//
// La règle centrale ici est une règle de CONFIANCE : l'humain qui a recopié un
// nom depuis Gmail a raison contre l'API. Un enrichissement tardif qui
// écraserait cette saisie détruirait un travail manuel sans trace — c'est le
// scénario que ces tests interdisent.

import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchInviteeMock = vi.fn();
vi.mock("../api", () => ({
  isCalendlyApiConfigured: () => Boolean(process.env.CALENDLY_API_TOKEN?.trim()),
  fetchCalendlyInvitee: (...args: unknown[]) => fetchInviteeMock(...args),
}));

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { enrichCalendlyEvent } from "../enrich";

/** Ligne vierge type : ce que produit une capture Embed JS sans jeton. */
function emptyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    eventUri: "https://api.calendly.com/scheduled_events/E",
    inviteeUri: "https://api.calendly.com/scheduled_events/E/invitees/I",
    inviteeName: null,
    inviteeEmail: null,
    inviteePhone: null,
    startTime: null,
    endTime: null,
    location: null,
    status: "scheduled",
    eventTypeName: "premier-contact",
    eventTypeSlug: "premier-contact",
    cancelUrl: null,
    rescheduleUrl: null,
    ...overrides,
  };
}

function apiData(overrides: Record<string, unknown> = {}) {
  return {
    ok: true as const,
    data: {
      inviteeName: "Jean Dupont",
      inviteeEmail: "jean@example.com",
      inviteePhone: null,
      startTime: new Date("2026-08-03T09:00:00Z"),
      endTime: new Date("2026-08-03T09:30:00Z"),
      timezone: "Europe/Paris",
      location: null,
      calendlyStatus: "active",
      cancelUrl: "https://calendly.com/cancellations/abc",
      rescheduleUrl: null,
      eventTypeName: "Premier contact — 30 min",
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CALENDLY_API_TOKEN = "pat_test";
  updateMock.mockResolvedValue({});
});

describe("enrichCalendlyEvent", () => {
  it("sans jeton : ne lit même pas la base", async () => {
    delete process.env.CALENDLY_API_TOKEN;
    const res = await enrichCalendlyEvent("evt_1");
    expect(res).toEqual({ ok: false, reason: "not_configured" });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("remplit une fiche vierge et horodate l'enrichissement", async () => {
    findUniqueMock.mockResolvedValueOnce(emptyRow());
    fetchInviteeMock.mockResolvedValueOnce(apiData());

    const res = await enrichCalendlyEvent("evt_1");
    expect(res.ok).toBe(true);

    const { data } = updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data["inviteeName"]).toBe("Jean Dupont");
    expect(data["inviteeEmail"]).toBe("jean@example.com");
    expect(data["startTime"]).toEqual(new Date("2026-08-03T09:00:00Z"));
    expect(data["cancelUrl"]).toBe("https://calendly.com/cancellations/abc");
    expect(data["enrichedAt"]).toBeInstanceOf(Date);
    // Le slug technique cède la place au nom lisible tant que personne ne l'a
    // renommé (ici eventTypeName === eventTypeSlug).
    expect(data["eventTypeName"]).toBe("Premier contact — 30 min");
  });

  it("n'écrase JAMAIS une valeur déjà saisie", async () => {
    findUniqueMock.mockResolvedValueOnce(
      emptyRow({
        inviteeName: "Nom corrigé à la main",
        inviteeEmail: "vrai@client.fr",
        startTime: new Date("2026-08-01T08:00:00Z"),
        eventTypeName: "Rendez-vous renommé par Will",
      }),
    );
    fetchInviteeMock.mockResolvedValueOnce(apiData());

    const res = await enrichCalendlyEvent("evt_1");
    expect(res.ok).toBe(true);
    const { data } = updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data).not.toHaveProperty("inviteeName");
    expect(data).not.toHaveProperty("inviteeEmail");
    expect(data).not.toHaveProperty("startTime");
    expect(data).not.toHaveProperty("eventTypeName");
    if (res.ok) {
      expect(res.updatedFields).not.toContain("inviteeName");
      expect(res.updatedFields).toContain("endTime");
    }
  });

  it("remonte une annulation faite côté Calendly", async () => {
    findUniqueMock.mockResolvedValueOnce(emptyRow({ status: "scheduled" }));
    fetchInviteeMock.mockResolvedValueOnce(apiData({ calendlyStatus: "canceled" }));
    await enrichCalendlyEvent("evt_1");
    const { data } = updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data["status"]).toBe("canceled");
  });

  // « Terminé » / « Absent » décrivent ce qui s'est passé pendant l'appel :
  // l'API Calendly ne connaît pas ces états et les repasserait à « programmé ».
  it.each(["completed", "no_show"])("ne rétrograde pas un statut « %s »", async (status) => {
    findUniqueMock.mockResolvedValueOnce(emptyRow({ status }));
    fetchInviteeMock.mockResolvedValueOnce(apiData({ calendlyStatus: "active" }));
    await enrichCalendlyEvent("evt_1");
    const { data } = updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data).not.toHaveProperty("status");
  });

  it("une ligne sans URI (saisie manuelle) n'appelle pas Calendly", async () => {
    findUniqueMock.mockResolvedValueOnce(emptyRow({ inviteeUri: null }));
    const res = await enrichCalendlyEvent("evt_1");
    expect(res).toEqual({ ok: false, reason: "no_invitee_uri" });
    expect(fetchInviteeMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("ligne inconnue → not_found_local, distinct du 404 Calendly", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    expect(await enrichCalendlyEvent("nope")).toEqual({ ok: false, reason: "not_found_local" });
  });

  it("un échec API n'écrit rien et ne throw pas", async () => {
    findUniqueMock.mockResolvedValueOnce(emptyRow());
    fetchInviteeMock.mockResolvedValueOnce({ ok: false, reason: "forbidden", status: 403 });
    const res = await enrichCalendlyEvent("evt_1");
    expect(res).toEqual({ ok: false, reason: "forbidden" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("une fiche déjà complète est un succès à zéro champ", async () => {
    findUniqueMock.mockResolvedValueOnce(
      emptyRow({
        inviteeName: "Jean",
        inviteeEmail: "j@x.fr",
        inviteePhone: "+33600000000",
        startTime: new Date("2026-08-03T09:00:00Z"),
        endTime: new Date("2026-08-03T09:30:00Z"),
        location: "https://meet.google.com/x",
        cancelUrl: "https://calendly.com/cancellations/abc",
        rescheduleUrl: "https://calendly.com/reschedulings/abc",
        eventTypeName: "Nom déjà posé",
      }),
    );
    fetchInviteeMock.mockResolvedValueOnce(apiData({ timezone: null, calendlyStatus: "active" }));
    const res = await enrichCalendlyEvent("evt_1");
    expect(res).toEqual({ ok: true, updatedFields: [] });
    // L'horodatage seul est écrit : la tentative a bien eu lieu.
    const { data } = updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(Object.keys(data)).toEqual(["enrichedAt"]);
  });
});
