/* eslint-disable @typescript-eslint/no-explicit-any -- doubles de base en mémoire */
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
vi.mock("../validation-rendez-vous", () => ({
  validerParRendezVous: vi.fn(),
  MESSAGE_DEJA_VALIDEE: "Cette entreprise est déjà validée : rien de plus à faire.",
}));

import { validerAnnulationsAxion } from "../annulations-rendez-vous";
import { validerParRendezVous } from "../validation-rendez-vous";

const PRIS = new Date("2026-10-10T09:00:00Z");
const PREVU = new Date("2026-11-03T09:00:00Z");
const APRES = new Date("2026-11-04T09:00:00Z");
const AVANT = new Date("2026-11-02T09:00:00Z");

function ligne(o: Record<string, any> = {}) {
  bd.annulations.push({
    id: "A1",
    presentationId: "P1",
    rendezVousCle: "calendly:E1",
    prisAt: PRIS,
    prevuAt: PREVU,
    constateeAt: AVANT,
    etatSource: "canceled",
    auteur: "axion",
    qualifieeAt: AVANT,
    qualifieePar: "U1",
    motif: null,
    reportCle: null,
    validationFaiteAt: null,
    ...o,
  });
}

beforeEach(() => {
  vider();
  vi.mocked(validerParRendezVous).mockReset();
  vi.mocked(validerParRendezVous).mockResolvedValue({
    ok: true,
    message: "ok",
    avertissements: [],
  });
});

describe("annulé par Axion IA = réputé tenu à la date où il était fixé", () => {
  it("date fixée passée : validerParRendezVous avec canal annule_par_axion et tenuAt = prevuAt", async () => {
    ligne();
    expect(await validerAnnulationsAxion(APRES)).toBe(1);
    expect(validerParRendezVous).toHaveBeenCalledTimes(1);
    const [saisie] = vi.mocked(validerParRendezVous).mock.calls[0]!;
    expect(saisie).toMatchObject({
      presentationId: "P1",
      rendezVousCle: null,
      prisAt: PRIS,
      tenuAt: PREVU,
      source: "saisie",
      canal: "annule_par_axion",
      acteurId: "systeme:annulation-axion",
      motif: "Rendez-vous annulé par Axion IA, réputé tenu (art. 3.2)",
    });
    expect(bd.annulations[0]!.validationFaiteAt).toEqual(APRES);
  });

  it("date fixée future : rien", async () => {
    ligne();
    expect(await validerAnnulationsAxion(AVANT)).toBe(0);
    expect(validerParRendezVous).not.toHaveBeenCalled();
  });

  it("deux passages : une seule validation", async () => {
    ligne();
    await validerAnnulationsAxion(APRES);
    await validerAnnulationsAxion(new Date(APRES.getTime() + 86_400_000));
    expect(validerParRendezVous).toHaveBeenCalledTimes(1);
  });

  it("jamais sans auteur « axion » posé : non qualifiée ou entreprise, aucune validation", async () => {
    ligne({ id: "A1", auteur: null, qualifieeAt: null, qualifieePar: null });
    ligne({ id: "A2", rendezVousCle: "calendly:E2", auteur: "entreprise", motif: "x" });
    expect(await validerAnnulationsAxion(APRES)).toBe(0);
    expect(validerParRendezVous).not.toHaveBeenCalled();
  });

  it("une autre déclaration occupe : le refus remonte en alerte interne, rien n'est écrit", async () => {
    ligne();
    vi.mocked(validerParRendezVous).mockResolvedValue({
      ok: false,
      message: "Une autre déclaration occupe encore cette entreprise.",
    });
    expect(await validerAnnulationsAxion(APRES)).toBe(0);
    expect(bd.annulations[0]!.validationFaiteAt).toBeNull();
    expect(bd.alertes).toHaveLength(1);
    expect(bd.alertes[0]!.gabarit).toBe("qualiopi-alerte-interne");
    expect(bd.alertes[0]!.payload.message).toContain("Une autre déclaration occupe");
  });
});
