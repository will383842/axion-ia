/**
 * Lot F-CAL-2 — l'enrichissement (réponse de l'API Calendly) rattache un échange
 * formateur SEULEMENT interrupteur allumé, avec le `utm_content` de l'API — jamais
 * celui de la colonne, qu'un POST forgé sur la route publique peut avoir rempli.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
const updateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    calendlyEvent: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  },
}));
const fetchInvitee = vi.fn();
vi.mock("../api", () => ({
  isCalendlyApiConfigured: () => true,
  fetchCalendlyInvitee: (...a: unknown[]) => fetchInvitee(...a),
}));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/server/crm-sync", () => ({ syncCalendlyEventToCrm: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
const etatsEntree = vi.fn();
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: () => etatsEntree(),
}));
const rattacher = vi.fn();
vi.mock("../rattachement-formateur", () => ({
  rattacherEchangeFormateur: (...a: unknown[]) => rattacher(...a),
}));

import { enrichCalendlyEvent } from "../enrich";

const ID = "0b7c3a52-4a0e-4d4c-9f43-2f6a7d1c9e10";

function row() {
  return {
    id: "evt_f1",
    eventUri: "https://api.calendly.com/scheduled_events/E",
    inviteeUri: "https://api.calendly.com/scheduled_events/E/invitees/I",
    inviteeName: null,
    inviteeEmail: "victime@example.com",
    inviteePhone: null,
    startTime: null,
    endTime: null,
    location: null,
    status: "scheduled",
    eventTypeName: "Échange formateur indépendant (20 min)",
    eventTypeSlug: "echange-formateur-independant",
    cancelUrl: null,
    rescheduleUrl: null,
    rawPayload: {},
    // Écrit par la route publique : jamais lu pour rattacher.
    utmContent: "formateur:fa-11111111-1111-4111-8111-111111111111",
    typeRendezVous: "autre",
    eventTypeUri: null,
    linkedSubmissionId: null,
    linkedJobApplicationId: null,
  };
}
function api() {
  return {
    ok: true as const,
    data: {
      inviteeName: "Camille Martin",
      inviteeEmail: "camille@example.com",
      inviteePhone: null,
      startTime: new Date("2026-10-22T08:00:00Z"),
      endTime: new Date("2026-10-22T08:20:00Z"),
      timezone: "Europe/Paris",
      location: null,
      calendlyStatus: "active",
      noShow: false,
      cancelUrl: null,
      rescheduleUrl: null,
      eventTypeName: "Échange formateur indépendant (20 min)",
      answersText: null,
      raw: { invitee: { tracking: { utm_content: `formateur:fa-${ID}` } }, event: {} },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({ id: "evt_f1" });
  rattacher.mockResolvedValue({ rattache: false, motif: "aucune_candidature" });
});

describe("enrichissement d'un échange formateur", () => {
  it("interrupteur coupé : aucun rattachement (comportement d'avant)", async () => {
    etatsEntree.mockResolvedValue({ suivi_echange: false });
    findUnique.mockResolvedValue(row());
    fetchInvitee.mockResolvedValue(api());
    const r = await enrichCalendlyEvent("evt_f1");
    expect(r.ok).toBe(true);
    expect(rattacher).not.toHaveBeenCalled();
  });

  it("interrupteur allumé : l'adresse et le marqueur viennent de l'API, jamais de la colonne", async () => {
    etatsEntree.mockResolvedValue({ suivi_echange: true });
    findUnique.mockResolvedValue(row());
    fetchInvitee.mockResolvedValue(api());
    await enrichCalendlyEvent("evt_f1");
    expect(rattacher).toHaveBeenCalledTimes(1);
    const [ligne, utm] = rattacher.mock.calls[0]!;
    expect(ligne.inviteeEmail).toBe("camille@example.com");
    expect(utm).toBe(`formateur:fa-${ID}`);
  });
});
