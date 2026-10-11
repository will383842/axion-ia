/**
 * Lot F-CAL-2 — l'issue de l'échange FORMATEUR : famille du module commun (FAC-7),
 * une fois par personne, F5 seulement avec le dossier en ligne, aucune décision
 * sans candidature rattachée.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueEvt = vi.fn();
const findUniqueJA = vi.fn();
const findManyJA = vi.fn();
const countSuivi = vi.fn();
const findFirstLog = vi.fn();
const findFirstOutbox = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: { findUnique: (...a: unknown[]) => findUniqueEvt(...a) },
    jobApplication: {
      findUnique: (...a: unknown[]) => findUniqueJA(...a),
      findMany: (...a: unknown[]) => findManyJA(...a),
    },
    rendezVousSuivi: { count: (...a: unknown[]) => countSuivi(...a) },
    emailLog: { findFirst: (...a: unknown[]) => findFirstLog(...a) },
    emailOutbox: { findFirst: (...a: unknown[]) => findFirstOutbox(...a) },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v.replace(/^enc:/, "") }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) => (e ? `h-${e}` : null),
}));

import { GABARITS_ISSUE_PAR_FAMILLE } from "../issue-echange";
import { MESSAGE_SANS_DOSSIER, preparerIssueFormateur } from "../issue-formateur-envoi";

const CAND = "0b7c3a52-4a0e-4d4c-9f43-2f6a7d1c9e10";

beforeEach(() => {
  vi.clearAllMocks();
  findUniqueEvt.mockResolvedValue({
    id: "evt_f1",
    eventTypeName: "Échange formateur indépendant (20 min)",
    typeRendezVous: "autre",
    linkedJobApplicationId: CAND,
  });
  findUniqueJA.mockResolvedValue({
    id: CAND,
    email: "enc:camille@example.com",
    emailHash: "h-camille",
    firstName: "enc:Camille",
  });
  findManyJA.mockResolvedValue([{ id: CAND }]);
  countSuivi.mockResolvedValue(0);
  findFirstLog.mockResolvedValue(null);
  findFirstOutbox.mockResolvedValue(null);
});

describe("la famille formateur du module commun", () => {
  it("porte F7, F5 et F6 du catalogue", () => {
    expect(GABARITS_ISSUE_PAR_FAMILLE.formateur).toEqual({
      absent: "formateur-issue-absent",
      retenu: "formateur-issue-retenu",
      non_retenu: "formateur-issue-non-retenu",
    });
  });
});

describe("preparerIssueFormateur", () => {
  it("Absent : F7, avec le lien de réservation marqué fa-<id>, une clé par personne", async () => {
    const p = await preparerIssueFormateur({ calendlyEventId: "evt_f1", issue: "absent" });
    if (!p.ok || !p.envoi) throw new Error("attendu : un envoi");
    expect(p.envoi.gabarit).toBe("formateur-issue-absent");
    expect(p.envoi.destinataire).toBe("camille@example.com");
    expect(p.envoi.payload.lien).toMatch(
      new RegExp(`/fr/appel/formateur-independant\\?depuis=fa-${CAND}$`),
    );
    expect(p.envoi.jobId).toBe("formateur-issue-formateur-issue-absent-h-camille");
  });

  it("deuxième absence : plus de nouveau créneau", async () => {
    countSuivi.mockResolvedValue(1);
    const p = await preparerIssueFormateur({ calendlyEventId: "evt_f1", issue: "absent" });
    expect(p.ok && p.envoi).toBeNull();
  });

  it("Retenu : F5 ne part pas tant que le dossier en ligne n'existe pas", async () => {
    const p = await preparerIssueFormateur({ calendlyEventId: "evt_f1", issue: "retenu" });
    expect(p).toMatchObject({ ok: true, envoi: null, sansEmail: MESSAGE_SANS_DOSSIER });
  });

  it("Non retenu déjà parti à cette personne : rien ne repart", async () => {
    findFirstLog.mockResolvedValue({ createdAt: new Date("2026-10-15T10:00:00Z") });
    const p = await preparerIssueFormateur({ calendlyEventId: "evt_f1", issue: "non_retenu" });
    expect(p).toMatchObject({ ok: true, envoi: null });
    expect(findFirstLog.mock.calls[0]![0].where.entityId).toEqual({ in: [CAND] });
  });

  it("Reporté et À revoir : aucun e-mail", async () => {
    for (const issue of ["reporte", "a_revoir"] as const) {
      const p = await preparerIssueFormateur({ calendlyEventId: "evt_f1", issue });
      expect(p).toMatchObject({ ok: true, envoi: null });
    }
  });

  it("sans candidature rattachée : refus, rien n'est préparé", async () => {
    findUniqueEvt.mockResolvedValue({
      id: "evt_f1",
      eventTypeName: "Échange formateur indépendant (20 min)",
      typeRendezVous: null,
      linkedJobApplicationId: null,
    });
    const p = await preparerIssueFormateur({ calendlyEventId: "evt_f1", issue: "absent" });
    expect(p.ok).toBe(false);
  });

  it("un échange apporteur n'a pas d'issue « formateur »", async () => {
    findUniqueEvt.mockResolvedValue({
      id: "evt_a",
      eventTypeName: "Échange apporteur d'affaires (15 min)",
      typeRendezVous: "apporteur",
      linkedJobApplicationId: CAND,
    });
    const p = await preparerIssueFormateur({ calendlyEventId: "evt_a", issue: "absent" });
    expect(p.ok).toBe(false);
  });
});
