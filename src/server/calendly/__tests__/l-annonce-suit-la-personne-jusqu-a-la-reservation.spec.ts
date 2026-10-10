/**
 * L'ANNONCE suit la personne jusqu'à la réservation (2026-10-10).
 *
 * La publicité arrive avec `utm_content=<annonce>`. Sur le parcours de
 * réservation, `utm_content` désigne le BOUTON (`apporteur:vsl-apporteur`), et
 * une réservation prise depuis l'e-mail B1 ne porte aucune UTM. La fiche de
 * l'étape 1 fait donc foi : à la réservation rattachée à une fiche de la page
 * vidéo, l'attribution d'origine est recopiée sur le rendez-vous, sans jamais
 * remplacer ce qu'il porte déjà.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const majLigne = vi.fn(async (..._a: unknown[]) => ({}));
const ficheLue = vi.fn(async (..._a: unknown[]): Promise<unknown> => null);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findUnique: (...a: unknown[]) => ficheLue(...a) },
    calendlyEvent: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => majLigne(...a),
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
vi.mock("@/lib/analytics/plausible-serveur", () => ({ emettreEvenementPlausible: vi.fn() }));
vi.mock("@/server/meta/schedule-apporteur", () => ({ envoyerScheduleApporteur: vi.fn() }));
const rattacher = vi.fn();
vi.mock("../rattachement-apporteur", () => ({
  rattacherEchangeApporteur: (...a: unknown[]) => rattacher(...a),
}));
vi.mock("@/features/commercial-application/lead-vsl-details", () => ({
  majMessageVsl: vi.fn(async () => undefined),
}));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: vi.fn(async () => 0),
}));

import { enrichCalendlyEvent } from "../enrich";
import { attributionDeLaFiche, estFicheVideo, recopieAttribution } from "../attribution-origine";

const FICHE_VIDEO = {
  deletedAt: null,
  details: {
    vsl: { version: "vsl-v1", etapeAtteinte: 2 },
    funnel: {
      utm: {
        utm_source: "facebook",
        utm_medium: "paid",
        utm_campaign: "apporteurs-vsl-2026-10",
        utm_content: "annonce-42",
      },
    },
  },
};

function row(o: Record<string, unknown> = {}) {
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
    eventTypeName: "echange-apporteur",
    eventTypeSlug: "echange-apporteur",
    cancelUrl: null,
    rescheduleUrl: null,
    rawPayload: {},
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    linkedSubmissionId: null,
    linkedJobApplicationId: null,
    ...o,
  };
}

const api = () => ({
  ok: true as const,
  data: {
    inviteeName: "Léa",
    inviteeEmail: "lea@example.com",
    inviteePhone: null,
    startTime: new Date("2026-10-12T08:00:00Z"),
    endTime: new Date("2026-10-12T08:15:00Z"),
    timezone: "Europe/Paris",
    location: null,
    calendlyStatus: "active",
    noShow: false,
    cancelUrl: null,
    rescheduleUrl: null,
    eventTypeName: "Échange apporteur d'affaires (15 min)",
    answersText: null,
    raw: { invitee: { uri: "https://api.calendly.com/invitees/I" }, event: {} },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  rattacher.mockResolvedValue({ rattache: true, submissionId: "fiche-video" });
});

const ecritureAttribution = () =>
  majLigne.mock.calls
    .map((c) => (c[0] as { data: Record<string, unknown> }).data)
    .find((d) => JSON.stringify(d).includes("_attributionOrigine"));

describe("à la réservation rattachée à une fiche de la page vidéo", () => {
  it("🔴 une réservation SANS UTM (lien de l'e-mail B1) reçoit l'attribution complète, annonce comprise", async () => {
    ficheLue.mockResolvedValue(FICHE_VIDEO);
    findUnique.mockResolvedValueOnce(row());
    fetchInvitee.mockResolvedValueOnce(api());
    expect((await enrichCalendlyEvent("evt_1")).ok).toBe(true);
    const d = ecritureAttribution();
    expect(d).toMatchObject({
      utmSource: "facebook",
      utmMedium: "paid",
      utmCampaign: "apporteurs-vsl-2026-10",
    });
    expect((d?.["rawPayload"] as Record<string, unknown>)["_attributionOrigine"]).toMatchObject({
      utm_content: "annonce-42",
      fiche: "fiche-video",
    });
    // Le bouton (utm_content du rendez-vous) n'est jamais remplacé par l'annonce.
    expect(d).not.toHaveProperty("utmContent");
  });

  it("la réservation de la page merci garde ses UTM et son bouton ; l'annonce s'ajoute à part", async () => {
    ficheLue.mockResolvedValue(FICHE_VIDEO);
    findUnique.mockResolvedValueOnce(
      row({
        utmSource: "facebook",
        utmMedium: "paid",
        utmCampaign: "apporteurs-vsl-2026-10",
        utmContent: "apporteur:vsl-apporteur",
        rawPayload: { _ipHash: "abc" },
      }),
    );
    fetchInvitee.mockResolvedValueOnce(api());
    await enrichCalendlyEvent("evt_1");
    const d = ecritureAttribution();
    expect(Object.keys(d ?? {})).toEqual(["rawPayload"]);
    const brut = d?.["rawPayload"] as Record<string, unknown>;
    expect(brut["_ipHash"]).toBe("abc"); // les clés privées survivent
    expect(brut["_attributionOrigine"]).toMatchObject({ utm_content: "annonce-42" });
  });

  it("déjà recopiée : rien n'est réécrit au sondage suivant", async () => {
    ficheLue.mockResolvedValue(FICHE_VIDEO);
    findUnique.mockResolvedValueOnce(
      row({
        utmSource: "facebook",
        utmMedium: "paid",
        utmCampaign: "x",
        rawPayload: { _attributionOrigine: { utm_content: "annonce-42" } },
      }),
    );
    fetchInvitee.mockResolvedValueOnce(api());
    await enrichCalendlyEvent("evt_1");
    expect(majLigne).toHaveBeenCalledTimes(1); // l'enrichissement ordinaire, seul
  });

  it("une fiche qui n'est PAS de la page vidéo (Indeed, ancien formulaire) ne recopie rien", async () => {
    ficheLue.mockResolvedValue({
      deletedAt: null,
      details: { funnel: { utm: { utm_content: "x" } } },
    });
    findUnique.mockResolvedValueOnce(row());
    fetchInvitee.mockResolvedValueOnce(api());
    await enrichCalendlyEvent("evt_1");
    expect(ecritureAttribution()).toBeUndefined();
  });

  it("une fiche à la corbeille ne recopie rien", async () => {
    ficheLue.mockResolvedValue({ ...FICHE_VIDEO, deletedAt: new Date() });
    findUnique.mockResolvedValueOnce(row());
    fetchInvitee.mockResolvedValueOnce(api());
    await enrichCalendlyEvent("evt_1");
    expect(ecritureAttribution()).toBeUndefined();
  });

  it("une fiche illisible ne fait pas échouer l'enrichissement", async () => {
    ficheLue.mockRejectedValue(new Error("base muette"));
    findUnique.mockResolvedValueOnce(row());
    fetchInvitee.mockResolvedValueOnce(api());
    expect((await enrichCalendlyEvent("evt_1")).ok).toBe(true);
  });
});

describe("attribution-origine (pur)", () => {
  it("lit défensivement la fiche", () => {
    expect(estFicheVideo(null)).toBe(false);
    expect(estFicheVideo({ vsl: [] })).toBe(false);
    expect(estFicheVideo(FICHE_VIDEO.details)).toBe(true);
    expect(attributionDeLaFiche({ funnel: { utm: { utm_content: " a ", x: "y" } } })).toEqual({
      utm_content: "a",
    });
    expect(attributionDeLaFiche("x")).toEqual({});
  });

  it("une fiche sans UTM n'écrit rien", () => {
    expect(
      recopieAttribution(
        { utmSource: null, utmMedium: null, utmCampaign: null, rawPayload: {} },
        {},
        "f",
        new Date(),
      ),
    ).toBeNull();
  });
});
