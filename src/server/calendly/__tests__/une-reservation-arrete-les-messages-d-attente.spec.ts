/**
 * Une réservation d'échange apporteur arrête les messages d'attente (R1, R2 du
 * tunnel vidéo, `03-MESSAGES-ET-DECISIONS.md` §3).
 *
 * Une personne qui a RÉSERVÉ ne doit plus recevoir « votre inscription n'est pas
 * terminée » (A1), ni les rappels J+2 / J+7 (A2, A3). L'arrêt se décide avec
 * l'adresse que Calendly CONFIRME (jamais celle d'un corps de requête public), et
 * seulement pour un échange apporteur : une réservation d'appel client ne touche
 * à rien.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const majLigne = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findFirst: vi.fn(async () => null) },
    calendlyEvent: {
      updateMany: vi.fn(async () => ({ count: 0 })),
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => majLigne(...a),
    },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) => (e ? `h-${e.toLowerCase()}` : null),
}));
const fetchInvitee = vi.fn();
vi.mock("../api", () => ({
  isCalendlyApiConfigured: () => true,
  fetchCalendlyInvitee: (...a: unknown[]) => fetchInvitee(...a),
}));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/server/crm-sync", () => ({ syncCalendlyEventToCrm: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
const plausible = vi.fn(async (..._a: unknown[]) => true);
vi.mock("@/lib/analytics/plausible-serveur", () => ({
  emettreEvenementPlausible: (...a: unknown[]) => plausible(...a),
}));
const annuler = vi.fn(async (..._a: unknown[]) => 3);
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: (...a: unknown[]) => annuler(...a),
}));

import { enrichCalendlyEvent } from "../enrich";

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
    linkedSubmissionId: null,
    linkedJobApplicationId: null,
    ...o,
  };
}

function api(o: Record<string, unknown> = {}) {
  return {
    ok: true as const,
    data: {
      inviteeName: "Léa",
      inviteeEmail: "lea@example.com",
      inviteePhone: null,
      startTime: new Date("2026-10-07T08:00:00Z"),
      endTime: new Date("2026-10-07T08:15:00Z"),
      timezone: "Europe/Paris",
      location: null,
      calendlyStatus: "active",
      noShow: false,
      cancelUrl: null,
      rescheduleUrl: null,
      eventTypeName: "Échange apporteur d'affaires (15 min)",
      answersText: null,
      raw: { invitee: { uri: "https://api.calendly.com/invitees/I" }, event: {} },
      ...o,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  annuler.mockResolvedValue(3);
});

describe("une réservation d'échange apporteur", () => {
  it("retire les messages d'attente de l'adresse que Calendly confirme", async () => {
    findUnique.mockResolvedValueOnce(row());
    fetchInvitee.mockResolvedValueOnce(api());
    const res = await enrichCalendlyEvent("evt_1");
    expect(res.ok).toBe(true);
    expect(annuler).toHaveBeenCalledTimes(1);
    expect(annuler.mock.calls[0]?.[0]).toBe("lea@example.com");
    expect(String(annuler.mock.calls[0]?.[1])).toMatch(/réservé/);
  });

  it("l'arrêt vaut même sans dossier rattaché (la personne n'a peut-être aucune fiche)", async () => {
    findUnique.mockResolvedValueOnce(row({ linkedSubmissionId: "sub_manuel" }));
    fetchInvitee.mockResolvedValueOnce(api());
    await enrichCalendlyEvent("evt_1");
    expect(annuler).toHaveBeenCalledTimes(1);
  });

  it("un appel CLIENT n'arrête rien", async () => {
    findUnique.mockResolvedValueOnce(
      row({ eventTypeName: "Appel découverte", eventTypeSlug: "appel-decouverte" }),
    );
    fetchInvitee.mockResolvedValueOnce(api({ eventTypeName: "Appel découverte — 30 min" }));
    await enrichCalendlyEvent("evt_1");
    expect(annuler).not.toHaveBeenCalled();
  });

  it("sans adresse confirmée par l'API, rien n'est annulé (une adresse forgée ne coupe les messages de personne)", async () => {
    findUnique.mockResolvedValueOnce(row({ inviteeEmail: "victime@example.com" }));
    fetchInvitee.mockResolvedValueOnce(api({ inviteeEmail: null }));
    await enrichCalendlyEvent("evt_1");
    expect(annuler).not.toHaveBeenCalled();
  });

  it("une annulation qui échoue ne fait pas échouer l'enrichissement", async () => {
    findUnique.mockResolvedValueOnce(row());
    fetchInvitee.mockResolvedValueOnce(api());
    annuler.mockRejectedValueOnce(new Error("file indisponible"));
    const res = await enrichCalendlyEvent("evt_1");
    expect(res.ok).toBe(true);
  });
});

describe("`Call Booked` côté serveur (lot 4)", () => {
  const evenement = () =>
    plausible.mock.calls[0]?.[0] as {
      nom: string;
      chemin: string;
      props: Record<string, string>;
    };
  const marqueEcrite = () =>
    JSON.stringify(majLigne.mock.calls[0]?.[0] ?? {}).includes("_callBookedServeur");

  it("émet UNE fois, sans donnée personnelle, et pose son marqueur dans les clés privées", async () => {
    findUnique.mockResolvedValueOnce(row({ utmSource: "facebook" }));
    fetchInvitee.mockResolvedValueOnce(api());
    await enrichCalendlyEvent("evt_1");
    expect(plausible).toHaveBeenCalledTimes(1);
    expect(evenement().nom).toBe("Call Booked");
    expect(evenement().chemin).toBe("/apporteur-affaires/video/merci");
    expect(evenement().props).toEqual({ source: "facebook", origine: "serveur" });
    // Aucune adresse, aucun nom, aucun téléphone dans l'événement.
    expect(JSON.stringify(plausible.mock.calls[0])).not.toMatch(/lea@|Léa|\+33|06 /);
    expect(marqueEcrite()).toBe(true);
  });

  it("ne ré-émet PAS au sondage suivant : le marqueur est déjà posé", async () => {
    findUnique.mockResolvedValueOnce(
      row({ rawPayload: { _callBookedServeur: "2026-10-07T08:00:00Z" } }),
    );
    fetchInvitee.mockResolvedValueOnce(api());
    await enrichCalendlyEvent("evt_1");
    expect(plausible).not.toHaveBeenCalled();
  });

  it("ne compte PAS deux fois une réservation que le navigateur a déjà comptée (_ipHash)", async () => {
    findUnique.mockResolvedValueOnce(row({ rawPayload: { _ipHash: "abc" } }));
    fetchInvitee.mockResolvedValueOnce(api());
    await enrichCalendlyEvent("evt_1");
    expect(plausible).not.toHaveBeenCalled();
  });

  it("n'émet rien pour un appel CLIENT, ni pour un créneau annulé", async () => {
    findUnique.mockResolvedValueOnce(
      row({ eventTypeName: "Appel découverte", eventTypeSlug: "appel-decouverte" }),
    );
    fetchInvitee.mockResolvedValueOnce(api({ eventTypeName: "Appel découverte — 30 min" }));
    await enrichCalendlyEvent("evt_1");
    findUnique.mockResolvedValueOnce(row());
    fetchInvitee.mockResolvedValueOnce(api({ calendlyStatus: "canceled" }));
    await enrichCalendlyEvent("evt_1");
    expect(plausible).not.toHaveBeenCalled();
  });

  it("un échec d'écriture n'émet rien (rien n'est marqué, on réessaiera)", async () => {
    findUnique.mockResolvedValueOnce(row());
    fetchInvitee.mockResolvedValueOnce(api());
    majLigne.mockRejectedValueOnce(new Error("écriture impossible"));
    const res = await enrichCalendlyEvent("evt_1");
    expect(res.ok).toBe(false);
    expect(plausible).not.toHaveBeenCalled();
  });

  it("une panne de Plausible ne fait pas échouer l'enrichissement", async () => {
    findUnique.mockResolvedValueOnce(row());
    fetchInvitee.mockResolvedValueOnce(api());
    plausible.mockRejectedValueOnce(new Error("hors ligne"));
    expect((await enrichCalendlyEvent("evt_1")).ok).toBe(true);
  });
});
