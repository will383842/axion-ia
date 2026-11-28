import { beforeEach, describe, expect, it, vi } from "vitest";

import { bd, vider } from "./aide/base-annulations";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./aide/base-annulations")).fake }));
vi.mock("@/server/queue/queues", async () => ({
  enqueueEmail: (await import("./aide/base-annulations")).enqueueEmailFictif,
}));
vi.mock("@/lib/destinataires-internes", () => ({ destinataireAlertesInternes: () => "w@x.test" }));
vi.mock("../commissions", () => ({
  dejaEnvoye: async (jobId: string) =>
    (await import("./aide/base-annulations")).bd.jobIds.has(jobId),
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));

import { constaterAnnulations } from "../annulations-rendez-vous";

const MAINT = new Date("2026-11-05T10:00:00Z");

beforeEach(() => {
  vider();
  bd.res.push({
    presentationId: "P1",
    regle: "rendez_vous",
    echueAt: null,
    valideeAt: null,
    rendezVousCle: null,
    rendezVousPrisAt: null,
    rendezVousAt: null,
  });
  bd.props.push({
    presentationId: "P1",
    rendezVousCle: "calendly:E1",
    prisAt: new Date("2026-10-10T09:00:00Z"),
    rendezVousAt: new Date("2026-11-03T09:00:00Z"),
    ecarteeAt: null,
    retenueAt: null,
  });
});

describe("l'auteur d'une annulation n'est jamais déduit", () => {
  it("Calendly canceled (canceler_type: host) crée une ligne SANS auteur, et alerte une fois", async () => {
    bd.calendly.push({
      id: "E1",
      status: "canceled",
      cancelerType: "host",
      startTime: new Date("2026-11-03T09:00:00Z"),
    });
    expect(await constaterAnnulations(MAINT)).toBe(1);
    const l = bd.annulations[0]!;
    expect(l.auteur).toBeNull();
    expect(l.qualifieeAt).toBeNull();
    expect(l.qualifieePar).toBeNull();
    expect(l.etatSource).toBe("canceled");
    expect(l.constateeAt).toEqual(MAINT);
    expect(l.prevuAt).toEqual(new Date("2026-11-03T09:00:00Z"));
    expect(bd.alertes.map((a) => a.payload.code)).toEqual(["apporteur_annulation_a_qualifier"]);
    // rejoué : ni seconde ligne, ni seconde alerte
    expect(await constaterAnnulations(new Date(MAINT.getTime() + 86_400_000))).toBe(0);
    expect(bd.annulations).toHaveLength(1);
    expect(bd.alertes).toHaveLength(1);
  });

  it("un rendez-vous tenu ou prévu ne crée rien", async () => {
    bd.calendly.push({
      id: "E1",
      status: "scheduled",
      startTime: new Date("2026-11-03T09:00:00Z"),
    });
    expect(await constaterAnnulations(MAINT)).toBe(0);
    expect(bd.annulations).toHaveLength(0);
  });

  it("une rencontre qui remplace l'invité annulé est liée comme report", async () => {
    bd.calendly.push({
      id: "E1",
      status: "canceled",
      inviteeUri: "https://api.example/invitees/I1",
      startTime: new Date("2026-11-03T09:00:00Z"),
    });
    bd.rencontres.push({ id: "R2", ancienInviteeUri: "https://api.example/invitees/I1" });
    await constaterAnnulations(MAINT);
    expect(bd.annulations[0]!.reportCle).toBe("rencontre:R2");
    expect(bd.annulations[0]!.reportLieAt).toEqual(MAINT);
    expect(bd.annulations[0]!.auteur).toBeNull();
  });
});
