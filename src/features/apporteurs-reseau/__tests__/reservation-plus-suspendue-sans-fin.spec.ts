/* eslint-disable @typescript-eslint/no-explicit-any -- doubles de base en mémoire */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { bd, enqueueEmailFictif, fake, vider } from "./aide/base-annulations";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./aide/base-annulations")).fake }));
vi.mock("@/server/queue/queues", async () => ({
  enqueueEmail: (await import("./aide/base-annulations")).enqueueEmailFictif,
}));
vi.mock("@/lib/destinataires-internes", () => ({ destinataireAlertesInternes: () => "w@x.test" }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("../commissions", () => ({
  dejaEnvoye: async (jobId: string) =>
    (await import("./aide/base-annulations")).bd.jobIds.has(jobId),
}));

import { passerReseauApporteurs } from "../passage-quotidien";

void fake;
void enqueueEmailFictif;

const JOUR = 86_400_000;
const RECUE = new Date("2026-09-01T09:00:00Z");
const FIN = new Date("2026-10-31T09:00:00Z");
const PRIS = new Date("2026-10-10T09:00:00Z");
const CONSTATEE = new Date("2026-11-05T10:00:00Z");
const apres = (n: number) => new Date(CONSTATEE.getTime() + n * JOUR);

function installer(annulation: Record<string, any>) {
  bd.pres.push({ id: "P1", denomination: "Acme", recueAt: RECUE, statut: "reservee" });
  bd.res.push({
    presentationId: "P1",
    regle: "rendez_vous",
    reserveeJusquAt: FIN,
    echueAt: null,
    valideeAt: null,
    rendezVousPrisAt: null,
    rendezVousAt: null,
    rendezVousCle: null,
  });
  bd.props.push({
    id: "PR1",
    presentationId: "P1",
    rendezVousCle: "calendly:E1",
    prisAt: PRIS,
    rendezVousAt: new Date("2026-11-03T09:00:00Z"),
    ecarteeAt: null,
    retenueAt: null,
  });
  bd.calendly.push({ id: "E1", status: "canceled", startTime: new Date("2026-11-03T09:00:00Z") });
  bd.annulations.push({
    id: "A0",
    presentationId: "P1",
    rendezVousCle: "calendly:E1",
    prisAt: PRIS,
    prevuAt: new Date("2026-11-03T09:00:00Z"),
    constateeAt: CONSTATEE,
    etatSource: "canceled",
    auteur: null,
    qualifieeAt: null,
    qualifieePar: null,
    motif: null,
    reportCle: null,
    reportLieAt: null,
    validationFaiteAt: null,
    ...annulation,
  });
}
const entreprise = {
  auteur: "entreprise",
  qualifieeAt: CONSTATEE,
  qualifieePar: "U1",
  motif: "Client injoignable",
};

beforeEach(() => {
  vider();
  // Les autres étapes du passage échouent faute de tables simulées : sans objet ici.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("APPORTEURS_VALIDATION_RDV", "true");
});

describe("la réservation n'est plus suspendue sans fin (art. 3.2)", () => {
  it("annulation entreprise sans report, à J+16 : la présentation est terminee", async () => {
    installer(entreprise);
    await passerReseauApporteurs(apres(16));
    expect(bd.pres[0]!.statut).toBe("terminee");
    expect(bd.res[0]!.echueAt).not.toBeNull();
  });

  it("à J+10 : toujours suspendue (le report reste possible)", async () => {
    installer(entreprise);
    await passerReseauApporteurs(apres(10));
    expect(bd.pres[0]!.statut).toBe("reservee");
    expect(bd.res[0]!.echueAt).toBeNull();
  });

  it("non qualifiée à J+40 : toujours suspendue, avec alerte critique", async () => {
    installer({});
    await passerReseauApporteurs(apres(40));
    expect(bd.pres[0]!.statut).toBe("reservee");
    const critique = bd.alertes.filter((a) => a.payload.niveau === "critique");
    expect(critique.map((a) => a.payload.code)).toContain(
      "apporteur_annulation_non_qualifiee_critique",
    );
    // une alerte par fait : un second passage n'en ajoute pas
    const avant = bd.alertes.length;
    await passerReseauApporteurs(apres(41));
    expect(bd.alertes.length).toBe(avant);
  });

  it("report lié : suspendue même à J+40", async () => {
    installer({ ...entreprise, reportCle: "rencontre:R2", reportLieAt: apres(3) });
    await passerReseauApporteurs(apres(40));
    expect(bd.pres[0]!.statut).toBe("reservee");
  });

  it("n'écarte jamais la proposition (rien n'est communiqué à l'apporteur)", async () => {
    installer(entreprise);
    await passerReseauApporteurs(apres(16));
    expect(bd.props[0]!.ecarteeAt).toBeNull();
    expect(bd.props[0]!.ecarteeNotifieeAt).toBeUndefined();
  });
});
