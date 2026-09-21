/**
 * Un échange apporteur rejoint son dossier tout seul — sans jamais déplacer un
 * rattachement existant (2026-09-19).
 *
 * Mesure R5 du 19/09 : 37 rendez-vous en base, 37 rattachés à rien. Le lien
 * n'était posé qu'à la main, par recopie d'un UUID.
 *
 * Ce que ces cas verrouillent :
 *   1. un rendez-vous déjà rattaché (demande OU candidature emploi) n'est
 *      JAMAIS réécrit — ni par la lecture, ni par l'écriture (course) ;
 *   2. le dossier choisi est le plus récent NON SUPPRIMÉ de la même empreinte,
 *      et c'est un dossier apporteur ;
 *   3. un appel client n'est jamais rattaché par cette voie ;
 *   4. l'enrichissement déclenche le rattachement avec l'adresse FRAÎCHE, et
 *      un échec de rattachement ne fait pas échouer l'enrichissement.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstSubmission = vi.fn();
const updateMany = vi.fn();
const findUnique = vi.fn();
const update = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findFirst: (...a: unknown[]) => findFirstSubmission(...a) },
    calendlyEvent: {
      updateMany: (...a: unknown[]) => updateMany(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
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
const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => captureException(...a),
}));

import { rattacherEchangeApporteur } from "../rattachement-apporteur";
import { enrichCalendlyEvent } from "../enrich";

const DETAILS_APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };

function ligne(o: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    eventTypeName: "Échange apporteur d'affaires (15 min)",
    inviteeEmail: "Lea@Example.com",
    linkedSubmissionId: null,
    linkedJobApplicationId: null,
    ...o,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 1 });
  update.mockResolvedValue({});
});

describe("rattacherEchangeApporteur", () => {
  it("rattache au dossier apporteur le plus récent non supprimé de la même empreinte", async () => {
    findFirstSubmission.mockResolvedValueOnce({ id: "sub_recent", details: DETAILS_APPORTEUR });

    const issue = await rattacherEchangeApporteur(ligne());

    expect(issue).toEqual({ rattache: true, submissionId: "sub_recent" });
    const arg = findFirstSubmission.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      orderBy: unknown;
    };
    // La même empreinte, jamais une adresse en clair.
    expect(arg.where["contactEmailHash"]).toBe("h-lea@example.com");
    // Non supprimée.
    expect(arg.where["deletedAt"]).toBeNull();
    // Un dossier APPORTEUR — les deux clés, pas seulement `unifiedType`.
    expect(JSON.stringify(arg.where["AND"])).toContain("candidature-commerciale");
    expect(JSON.stringify(arg.where["AND"])).toContain("recrutement");
    // La plus récente.
    expect(arg.orderBy).toEqual({ submittedAt: "desc" });
  });

  it("n'écrit QUE sur une ligne rattachée à rien — la condition est dans l'écriture", async () => {
    findFirstSubmission.mockResolvedValueOnce({ id: "sub_1", details: DETAILS_APPORTEUR });
    await rattacherEchangeApporteur(ligne());
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "evt_1", linkedSubmissionId: null, linkedJobApplicationId: null },
      data: { linkedSubmissionId: "sub_1" },
    });
  });

  it("jamais un rendez-vous déjà rattaché à une demande", async () => {
    const issue = await rattacherEchangeApporteur(ligne({ linkedSubmissionId: "sub_manuel" }));
    expect(issue).toEqual({ rattache: false, motif: "deja_rattache" });
    expect(findFirstSubmission).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("jamais un rendez-vous déjà rattaché à une candidature emploi", async () => {
    const issue = await rattacherEchangeApporteur(ligne({ linkedJobApplicationId: "app_emploi" }));
    expect(issue).toEqual({ rattache: false, motif: "deja_rattache" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rattaché entre la lecture et l'écriture : la saisie humaine gagne", async () => {
    findFirstSubmission.mockResolvedValueOnce({ id: "sub_1", details: DETAILS_APPORTEUR });
    updateMany.mockResolvedValueOnce({ count: 0 });
    const issue = await rattacherEchangeApporteur(ligne());
    expect(issue).toEqual({ rattache: false, motif: "rattache_entre_temps" });
  });

  it("un appel CLIENT n'est jamais rattaché par cette voie", async () => {
    const issue = await rattacherEchangeApporteur(
      ligne({ eventTypeName: "Appel découverte — 30 min" }),
    );
    expect(issue).toEqual({ rattache: false, motif: "pas_un_echange_apporteur" });
    expect(findFirstSubmission).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("sans adresse, rien à chercher", async () => {
    const issue = await rattacherEchangeApporteur(ligne({ inviteeEmail: null }));
    expect(issue).toEqual({ rattache: false, motif: "sans_adresse" });
    expect(findFirstSubmission).not.toHaveBeenCalled();
  });

  it("aucun dossier apporteur de cette personne : rien n'est écrit", async () => {
    findFirstSubmission.mockResolvedValueOnce(null);
    const issue = await rattacherEchangeApporteur(ligne());
    expect(issue).toEqual({ rattache: false, motif: "aucun_dossier_apporteur" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("le prédicat pur fait foi : une demande client renvoyée par la base n'est pas rattachée", async () => {
    // « recrutement » SANS le sous-type : c'est une rubrique du formulaire
    // public, pas un dossier apporteur.
    findFirstSubmission.mockResolvedValueOnce({
      id: "sub_client",
      details: { unifiedType: "recrutement" },
    });
    const issue = await rattacherEchangeApporteur(ligne());
    expect(issue).toEqual({ rattache: false, motif: "aucun_dossier_apporteur" });
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("enrichCalendlyEvent → rattachement", () => {
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
  function api() {
    return {
      ok: true as const,
      data: {
        inviteeName: "Léa",
        inviteeEmail: "lea@example.com",
        inviteePhone: null,
        startTime: new Date("2026-09-22T08:00:00Z"),
        endTime: new Date("2026-09-22T08:15:00Z"),
        timezone: "Europe/Paris",
        location: null,
        calendlyStatus: "active",
        noShow: false,
        cancelUrl: null,
        rescheduleUrl: null,
        eventTypeName: "Échange apporteur d'affaires (15 min)",
        answersText: null,
        raw: { invitee: {}, event: {} },
      },
    };
  }

  it("rattache avec l'adresse que l'enrichissement vient d'apprendre", async () => {
    findUnique.mockResolvedValueOnce(row());
    fetchInvitee.mockResolvedValueOnce(api());
    findFirstSubmission.mockResolvedValueOnce({ id: "sub_lea", details: DETAILS_APPORTEUR });

    const res = await enrichCalendlyEvent("evt_1");

    expect(res.ok).toBe(true);
    expect(findFirstSubmission.mock.calls[0]?.[0]).toMatchObject({
      where: { contactEmailHash: "h-lea@example.com", deletedAt: null },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "evt_1", linkedSubmissionId: null, linkedJobApplicationId: null },
      data: { linkedSubmissionId: "sub_lea" },
    });
  });

  it("une ligne déjà rattachée à la main n'est pas touchée", async () => {
    findUnique.mockResolvedValueOnce(row({ linkedSubmissionId: "sub_manuel" }));
    fetchInvitee.mockResolvedValueOnce(api());

    const res = await enrichCalendlyEvent("evt_1");

    expect(res.ok).toBe(true);
    expect(findFirstSubmission).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("un rattachement qui lève ne fait pas échouer l'enrichissement", async () => {
    findUnique.mockResolvedValueOnce(row());
    fetchInvitee.mockResolvedValueOnce(api());
    findFirstSubmission.mockRejectedValueOnce(new Error("base injoignable"));

    const res = await enrichCalendlyEvent("evt_1");

    expect(res.ok).toBe(true);
    expect(captureException).toHaveBeenCalled();
  });
});
