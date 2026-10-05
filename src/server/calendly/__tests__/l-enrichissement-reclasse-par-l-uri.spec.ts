/**
 * L'enrichissement RECLASSE le rendez-vous par l'URI de son type (2026-10-04).
 *
 * C'est le chemin qui rattrape l'iframe : sa capture ne porte que le slug, et
 * l'URI du type n'arrive qu'avec l'API. Il recopie aussi les UTM du `tracking`
 * dans les colonnes vides, sans écraser celles de l'iframe, et tolère la
 * fenêtre app/worker (colonnes du lot pas encore migrées).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchInviteeMock = vi.fn();
vi.mock("../api", () => ({
  isCalendlyApiConfigured: () => true,
  fetchCalendlyInvitee: (...a: unknown[]) => fetchInviteeMock(...a),
}));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
const syncCrmMock = vi.fn();
vi.mock("@/server/crm-sync", () => ({
  syncCalendlyEventToCrm: (...a: unknown[]) => syncCrmMock(...a),
}));
vi.mock("../rattachement-apporteur", () => ({ rattacherEchangeApporteur: vi.fn() }));

const URI_DIAG = "https://api.calendly.com/event_types/DIAG";
vi.mock("@/server/calendly/availability", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listerTypesEvenementCalendly: async () => ({
    types: [{ uri: URI_DIAG, scheduling_url: "https://calendly.com/axion-ia/diagnostic-ia" }],
  }),
}));

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
  },
}));

import { enrichCalendlyEvent } from "../enrich";
import { reinitialiserCacheTypesRendezVous } from "../type-rendez-vous";

/** Ligne captée par l'iframe : nom = slug, classée provisoirement. */
const LIGNE_IFRAME = {
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
  eventTypeName: "diag",
  eventTypeSlug: "diag",
  cancelUrl: null,
  rescheduleUrl: null,
  rawPayload: { event: { uri: "https://api.calendly.com/scheduled_events/E" } },
  utmSource: "site",
  utmMedium: null,
  utmCampaign: null,
  linkedSubmissionId: null,
  linkedJobApplicationId: null,
  typeRendezVous: "autre",
  eventTypeUri: null,
  utmContent: null,
};

const DONNEES_API = {
  ok: true as const,
  data: {
    inviteeName: "Camille",
    inviteeEmail: "camille@exemple.test",
    inviteePhone: null,
    startTime: null,
    endTime: null,
    timezone: null,
    location: null,
    calendlyStatus: "active",
    noShow: false,
    cancelUrl: null,
    rescheduleUrl: null,
    // Nom RENOMMÉ, sans aucun mot-clé : seule l'URI peut classer.
    eventTypeName: "Bilan express",
    answersText: null,
    raw: {
      invitee: {
        tracking: { utm_source: "linkedin", utm_medium: "social", utm_content: "diagnostic" },
      },
      event: { event_type: URI_DIAG },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  reinitialiserCacheTypesRendezVous();
  process.env.CALENDLY_API_TOKEN = "pat_test";
  findUniqueMock.mockResolvedValue({ ...LIGNE_IFRAME });
  fetchInviteeMock.mockResolvedValue(DONNEES_API);
  updateMock.mockResolvedValue({ id: "evt_1" });
});

describe("enrichCalendlyEvent reclasse par l'URI", () => {
  it("🔴 écrit l'URI et le type tirés de l'API, malgré un nom sans mot-clé", async () => {
    const res = await enrichCalendlyEvent("evt_1");
    expect(res.ok).toBe(true);
    const { data, select } = updateMock.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
      select: unknown;
    };
    expect(data).toMatchObject({ eventTypeUri: URI_DIAG, typeRendezVous: "diagnostic" });
    // UTM : on complète le vide, on n'écrase pas la source posée par l'iframe.
    expect(data).toMatchObject({ utmMedium: "social", utmContent: "diagnostic" });
    expect(data).not.toHaveProperty("utmSource");
    // `select` étroit : aucune relecture de colonne non migrée.
    expect(select).toEqual({ id: true });
    // Le type n'est pas annoncé comme un changement de la fiche.
    if (res.ok) expect(res.updatedFields).not.toContain("typeRendezVous");
  });

  it("fenêtre app/worker : colonnes absentes → lecture et écriture sans elles", async () => {
    const absente = {
      code: "P2022",
      message: "column `calendly_events.type_rendez_vous` does not exist",
    };
    const { typeRendezVous: _t, eventTypeUri: _e, utmContent: _u, ...sansType } = LIGNE_IFRAME;
    findUniqueMock.mockRejectedValueOnce(absente).mockResolvedValueOnce(sansType);
    const res = await enrichCalendlyEvent("evt_1");
    expect(res.ok).toBe(true);
    const { data } = updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data).not.toHaveProperty("typeRendezVous");
    expect(data).not.toHaveProperty("eventTypeUri");
    expect(data).not.toHaveProperty("utmContent");
    expect(data).toMatchObject({ inviteeEmail: "camille@exemple.test", utmMedium: "social" });
  });
});
