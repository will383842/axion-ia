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

const notifyMock = vi.fn();
vi.mock("@/server/notifications", () => ({
  notify: (...args: unknown[]) => notifyMock(...args),
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

const syncCrmMock = vi.fn();
vi.mock("@/server/crm-sync", () => ({
  syncCalendlyEventToCrm: (...args: unknown[]) => syncCrmMock(...args),
}));

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
      /** `no_show` de l'invitee Calendly : l'hôte a coché « Mark as no-show ». */
      noShow: false,
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
  notifyMock.mockResolvedValue({ ok: true, channels: {} });
  syncCrmMock.mockResolvedValue(undefined);
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

  // L'admin est propriétaire du QUI : ces champs ne sont jamais écrasés.
  it("n'écrase JAMAIS un contact déjà saisi à la main", async () => {
    findUniqueMock.mockResolvedValueOnce(
      emptyRow({
        inviteeName: "Nom corrigé à la main",
        inviteeEmail: "vrai@client.fr",
        inviteePhone: "+33611111111",
        location: "Bureau Grenoble",
        eventTypeName: "Rendez-vous renommé par Will",
      }),
    );
    fetchInviteeMock.mockResolvedValueOnce(apiData({ inviteePhone: "+33622222222" }));

    const res = await enrichCalendlyEvent("evt_1");
    expect(res.ok).toBe(true);
    const { data } = updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data).not.toHaveProperty("inviteeName");
    expect(data).not.toHaveProperty("inviteeEmail");
    expect(data).not.toHaveProperty("inviteePhone");
    expect(data).not.toHaveProperty("location");
    expect(data).not.toHaveProperty("eventTypeName");
    if (res.ok) expect(res.updatedFields).not.toContain("inviteeName");
  });

  // Calendly est propriétaire du QUAND : garder l'ancienne heure après un
  // déplacement produirait une fiche qui ment.
  it("écrase l'horaire quand l'invité a déplacé le créneau, et alerte", async () => {
    findUniqueMock.mockResolvedValueOnce(
      emptyRow({
        startTime: new Date("2026-08-01T08:00:00Z"),
        endTime: new Date("2026-08-01T08:30:00Z"),
        inviteeEmail: "jean@example.com",
      }),
    );
    fetchInviteeMock.mockResolvedValueOnce(apiData());

    const res = await enrichCalendlyEvent("evt_1");
    expect(res.ok).toBe(true);
    const { data } = updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data["startTime"]).toEqual(new Date("2026-08-03T09:00:00Z"));

    expect(notifyMock).toHaveBeenCalledOnce();
    const call = notifyMock.mock.calls[0]?.[0] as {
      category: string;
      payload: { oldStart: string; newStart: string; inviteeEmail: string };
    };
    expect(call.category).toBe("CALENDLY_INVITEE_RESCHEDULED");
    expect(call.payload.oldStart).toBe("2026-08-01T08:00:00.000Z");
    expect(call.payload.newStart).toBe("2026-08-03T09:00:00.000Z");
    expect(call.payload.inviteeEmail).toBe("jean@example.com");
  });

  it("un premier remplissage d'horaire n'est PAS un déplacement", async () => {
    findUniqueMock.mockResolvedValueOnce(emptyRow());
    fetchInviteeMock.mockResolvedValueOnce(apiData());
    await enrichCalendlyEvent("evt_1");
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("un horaire inchangé ne déclenche aucune alerte", async () => {
    findUniqueMock.mockResolvedValueOnce(
      emptyRow({
        startTime: new Date("2026-08-03T09:00:00Z"),
        endTime: new Date("2026-08-03T09:30:00Z"),
      }),
    );
    fetchInviteeMock.mockResolvedValueOnce(apiData());
    await enrichCalendlyEvent("evt_1");
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("remonte une annulation faite côté Calendly et alerte une seule fois", async () => {
    findUniqueMock.mockResolvedValueOnce(
      emptyRow({ status: "scheduled", inviteeEmail: "jean@example.com" }),
    );
    fetchInviteeMock.mockResolvedValueOnce(apiData({ calendlyStatus: "canceled" }));
    await enrichCalendlyEvent("evt_1");
    const { data } = updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data["status"]).toBe("canceled");

    const call = notifyMock.mock.calls[0]?.[0] as { category: string; dedupKey: string };
    expect(call.category).toBe("CALENDLY_INVITEE_CANCELED");
    // Relancer « Enrichir » à la main ne doit pas re-sonner l'alerte.
    expect(call.dedupKey).toBe("cal-cancel-evt_1");
  });

  it("ne ré-alerte pas une annulation déjà enregistrée", async () => {
    findUniqueMock.mockResolvedValueOnce(emptyRow({ status: "canceled" }));
    fetchInviteeMock.mockResolvedValueOnce(apiData({ calendlyStatus: "canceled" }));
    await enrichCalendlyEvent("evt_1");
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("un échec d'alerte ne fait pas échouer l'enrichissement", async () => {
    findUniqueMock.mockResolvedValueOnce(emptyRow({ status: "scheduled" }));
    fetchInviteeMock.mockResolvedValueOnce(apiData({ calendlyStatus: "canceled" }));
    notifyMock.mockRejectedValueOnce(new Error("telegram down"));
    const res = await enrichCalendlyEvent("evt_1");
    expect(res.ok).toBe(true);
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

  // Un appel déjà marqué « Terminé » n'a pas à repasser « Annulé » ni à sonner :
  // Calendly ignore ce qui s'est passé pendant l'entretien.
  it.each(["completed", "no_show"])(
    "une annulation Calendly n'écrase pas un statut « %s » et n'alerte pas",
    async (status) => {
      findUniqueMock.mockResolvedValueOnce(emptyRow({ status }));
      fetchInviteeMock.mockResolvedValueOnce(apiData({ calendlyStatus: "canceled" }));
      await enrichCalendlyEvent("evt_1");
      const { data } = updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
      expect(data).not.toHaveProperty("status");
      expect(notifyMock).not.toHaveBeenCalled();
    },
  );

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

// ─────────────────────────────────────────────────────────────────────────────
// L'ISSUE D'UN RDV DOIT ARRIVER AU CRM SANS GESTE (2026-08-18, préalables ligne 13)
// ─────────────────────────────────────────────────────────────────────────────
//
// L'ASYMÉTRIE que ces tests suppriment : l'annulation était déjà détectée
// automatiquement (sondage BullMQ → `enrich`), mais `enrich.ts` n'importait PAS
// `@/server/crm-sync`. Il sonnait Telegram et ne disait rien au CRM. Autrement
// dit l'automatisation existait pour l'AFFICHAGE et pas pour la SYNCHRO : le CRM
// n'apprenait l'annulation que si un humain repassait le statut à la main dans
// la console (`admin-calendly/actions.ts`). La prise de RDV, elle, part toute
// seule depuis `discover.ts` — d'où l'asymétrie.
//
// Le no-show, lui, n'était même pas détecté : `api.ts` ne lisait pas le champ
// `no_show` de l'invitee Calendly, alors que c'est exactement ce que l'hôte
// coche dans l'agenda (« Mark as no-show »).

describe("enrichCalendlyEvent — issue du RDV vers le CRM, sans geste humain", () => {
  it("un no-show déclaré dans Calendly devient `no_show` et part au CRM", async () => {
    findUniqueMock.mockResolvedValueOnce(
      emptyRow({
        status: "scheduled",
        inviteeEmail: "jean@example.com",
        inviteeName: "Jean Dupont",
        startTime: new Date("2026-08-03T09:00:00Z"),
        endTime: new Date("2026-08-03T09:30:00Z"),
      }),
    );
    fetchInviteeMock.mockResolvedValueOnce(apiData({ calendlyStatus: "active", noShow: true }));

    const res = await enrichCalendlyEvent("evt_1");
    expect(res.ok).toBe(true);

    const { data } = updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data["status"]).toBe("no_show");

    expect(syncCrmMock).toHaveBeenCalledOnce();
    const emis = syncCrmMock.mock.calls[0]?.[0] as {
      kind: string;
      subjectRef: string;
      person: { email: string };
      payload: Record<string, unknown>;
    };
    expect(emis.kind).toBe("no_show");
    // Même `subjectRef` que la prise de RDV (`discover.ts`) et que la saisie
    // manuelle : sans ça le CRM verrait deux affaires distinctes.
    expect(emis.subjectRef).toBe("site:calendly_event:evt_1");
    expect(emis.person.email).toBe("jean@example.com");
    expect(emis.payload["source"]).toBe("api_poll");
  });

  it("une annulation détectée automatiquement part au CRM (pas seulement Telegram)", async () => {
    findUniqueMock.mockResolvedValueOnce(
      emptyRow({ status: "scheduled", inviteeEmail: "jean@example.com" }),
    );
    fetchInviteeMock.mockResolvedValueOnce(apiData({ calendlyStatus: "canceled" }));

    await enrichCalendlyEvent("evt_1");

    expect(notifyMock).toHaveBeenCalledOnce();
    expect(syncCrmMock).toHaveBeenCalledOnce();
    const emis = syncCrmMock.mock.calls[0]?.[0] as { kind: string; person: { email: string } };
    expect(emis.kind).toBe("canceled");
    expect(emis.person.email).toBe("jean@example.com");
  });

  it("un statut inchangé n'émet RIEN — pas de doublon dans la timeline CRM", async () => {
    // Chaque émission porte un `event_id` neuf : re-sonder toutes les 10 min une
    // ligne déjà annulée dupliquerait l'interaction côté CRM.
    findUniqueMock.mockResolvedValueOnce(
      emptyRow({ status: "canceled", inviteeEmail: "jean@example.com" }),
    );
    fetchInviteeMock.mockResolvedValueOnce(apiData({ calendlyStatus: "canceled" }));
    await enrichCalendlyEvent("evt_1");
    expect(syncCrmMock).not.toHaveBeenCalled();
  });

  it("sans adresse d'invité, aucune émission (pas de clé de personne)", async () => {
    findUniqueMock.mockResolvedValueOnce(emptyRow({ status: "scheduled", inviteeEmail: null }));
    fetchInviteeMock.mockResolvedValueOnce(
      apiData({ calendlyStatus: "canceled", inviteeEmail: null }),
    );
    await enrichCalendlyEvent("evt_1");
    expect(syncCrmMock).not.toHaveBeenCalled();
  });

  it("un échec d'émission CRM ne fait pas échouer l'enrichissement", async () => {
    findUniqueMock.mockResolvedValueOnce(
      emptyRow({ status: "scheduled", inviteeEmail: "jean@example.com" }),
    );
    fetchInviteeMock.mockResolvedValueOnce(apiData({ calendlyStatus: "canceled" }));
    syncCrmMock.mockRejectedValueOnce(new Error("outbox down"));
    const res = await enrichCalendlyEvent("evt_1");
    expect(res.ok).toBe(true);
  });

  // L'humain a vu l'appel ; l'API ne l'a pas vu. Un `completed` posé en console
  // n'est donc jamais contredit par un `no_show` venu de Calendly.
  it("ne rétrograde pas un `completed` posé à la main, et n'émet rien", async () => {
    findUniqueMock.mockResolvedValueOnce(
      emptyRow({ status: "completed", inviteeEmail: "jean@example.com" }),
    );
    fetchInviteeMock.mockResolvedValueOnce(apiData({ noShow: true }));
    await enrichCalendlyEvent("evt_1");
    const { data } = updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data).not.toHaveProperty("status");
    expect(syncCrmMock).not.toHaveBeenCalled();
  });

  // Une absence l'emporte sur une annulation : si Calendly dit les deux, c'est
  // que l'hôte a annulé APRÈS avoir constaté l'absence.
  it("no_show et annulation simultanés → `no_show`", async () => {
    findUniqueMock.mockResolvedValueOnce(
      emptyRow({ status: "scheduled", inviteeEmail: "jean@example.com" }),
    );
    fetchInviteeMock.mockResolvedValueOnce(apiData({ calendlyStatus: "canceled", noShow: true }));
    await enrichCalendlyEvent("evt_1");
    const { data } = updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data["status"]).toBe("no_show");
    expect((syncCrmMock.mock.calls[0]?.[0] as { kind: string }).kind).toBe("no_show");
  });
});
