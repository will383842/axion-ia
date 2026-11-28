import { beforeEach, describe, expect, it, vi } from "vitest";

import { bd, vider } from "./aide/base-annulations";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./aide/base-annulations")).fake }));
vi.mock("@/server/queue/queues", async () => ({
  enqueueEmail: vi.fn((await import("./aide/base-annulations")).enqueueEmailFictif),
}));
vi.mock("@/lib/destinataires-internes", () => ({ destinataireAlertesInternes: () => "w@x.test" }));
vi.mock("../commissions", () => ({
  dejaEnvoye: async (jobId: string) =>
    (await import("./aide/base-annulations")).bd.jobIds.has(jobId),
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("../validation-rendez-vous", () => ({
  validerParRendezVous: vi.fn(async () => ({ ok: true, message: "ok", avertissements: [] })),
}));

import { enqueueEmail } from "@/server/queue/queues";
import {
  alerterAnnulationsNonQualifiees,
  constaterAnnulations,
  validerAnnulationsAxion,
} from "../annulations-rendez-vous";

beforeEach(() => {
  vider();
  vi.mocked(enqueueEmail).mockClear();
});

describe("l'étape des annulations n'écrit jamais à l'apporteur", () => {
  it("constat, alertes à J+5 / J+10 et validation Axion : seul `alerteInterne` envoie", async () => {
    bd.res.push({ presentationId: "P1", regle: "rendez_vous", echueAt: null, valideeAt: null });
    bd.props.push({
      presentationId: "P1",
      rendezVousCle: "calendly:E1",
      prisAt: new Date("2026-10-10T09:00:00Z"),
      rendezVousAt: new Date("2026-11-03T09:00:00Z"),
      ecarteeAt: null,
      retenueAt: null,
    });
    bd.calendly.push({ id: "E1", status: "canceled", startTime: new Date("2026-11-03T09:00:00Z") });
    bd.annulations.push({
      id: "AX",
      presentationId: "P2",
      rendezVousCle: "calendly:E9",
      prisAt: new Date("2026-10-10T09:00:00Z"),
      prevuAt: new Date("2026-11-01T09:00:00Z"),
      constateeAt: new Date("2026-11-01T09:00:00Z"),
      etatSource: "canceled",
      auteur: "axion",
      qualifieeAt: new Date("2026-11-01T09:00:00Z"),
      qualifieePar: "U1",
      validationFaiteAt: null,
    });
    const loin = new Date("2026-12-31T10:00:00Z");
    await constaterAnnulations(new Date("2026-11-05T10:00:00Z"));
    await alerterAnnulationsNonQualifiees(loin);
    await validerAnnulationsAxion(loin);
    const appels = vi.mocked(enqueueEmail).mock.calls;
    expect(appels.length).toBeGreaterThan(0);
    for (const [gabarit] of appels) {
      expect(String(gabarit).startsWith("apporteur-")).toBe(false);
      expect(gabarit).toBe("qualiopi-alerte-interne");
    }
    expect(bd.alertes.every((a) => a.gabarit === "qualiopi-alerte-interne")).toBe(true);
  });
});
