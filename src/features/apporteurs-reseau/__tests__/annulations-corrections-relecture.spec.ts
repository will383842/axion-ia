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
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "U1", role: "admin" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: () => "/x" }));

import { lierReportAction } from "../actions-annulations";
import {
  clesQuiNeRetiennentPlus,
  constaterAnnulations,
  validerAnnulationsAxion,
} from "../annulations-rendez-vous";
import { validerParRendezVous } from "../validation-rendez-vous";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const PRIS = new Date("2026-10-10T09:00:00Z");
const PREVU = new Date("2026-11-03T09:00:00Z");
const MAINT = new Date("2026-11-05T10:00:00Z");

function ligne(o: Record<string, any> = {}) {
  bd.annulations.push({
    id: "A1",
    presentationId: "P1",
    rendezVousCle: "calendly:E1",
    prisAt: PRIS,
    prevuAt: PREVU,
    constateeAt: new Date("2026-11-02T09:00:00Z"),
    etatSource: "canceled",
    auteur: "axion",
    qualifieeAt: null,
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

describe("bloquant 1 : une erreur sur une ligne ne bloque ni les autres ni l'étape", () => {
  it("la 1re ligne lève, la 2e est validée, une alerte interne part avec un jobId stable", async () => {
    ligne({ id: "A1", presentationId: "P1" });
    ligne({ id: "A2", presentationId: "P2", rendezVousCle: "calendly:E2" });
    vi.mocked(validerParRendezVous).mockRejectedValueOnce(
      new Error("invalid input syntax for type uuid"),
    );
    expect(await validerAnnulationsAxion(MAINT)).toBe(1);
    expect(bd.annulations.find((l) => l.id === "A1")!.validationFaiteAt).toBeNull();
    expect(bd.annulations.find((l) => l.id === "A2")!.validationFaiteAt).toEqual(MAINT);
    expect(bd.alertes.map((a) => a.jobId)).toEqual(["apporteur-annulation-axion-erreur-A1"]);
    // rejouée : toujours une seule alerte
    await validerAnnulationsAxion(MAINT);
    expect(bd.alertes).toHaveLength(1);
  });
});

describe("non bloquant 3 : « déjà validée » n'alerte pas et ne se relit pas chaque jour", () => {
  it("pose validationFaiteAt sans alerte", async () => {
    ligne();
    vi.mocked(validerParRendezVous).mockResolvedValue({
      ok: false,
      message: "Cette entreprise est déjà validée : rien de plus à faire.",
    });
    expect(await validerAnnulationsAxion(MAINT)).toBe(0);
    expect(bd.annulations[0]!.validationFaiteAt).toEqual(MAINT);
    expect(bd.alertes).toHaveLength(0);
    await validerAnnulationsAxion(MAINT);
    expect(validerParRendezVous).toHaveBeenCalledTimes(1);
  });

  it("un autre refus alerte toujours et reste à refaire", async () => {
    ligne();
    vi.mocked(validerParRendezVous).mockResolvedValue({ ok: false, message: "autre" });
    await validerAnnulationsAxion(MAINT);
    expect(bd.annulations[0]!.validationFaiteAt).toBeNull();
    expect(bd.alertes.map((a) => a.payload.code)).toEqual(["apporteur_annulation_axion_refusee"]);
  });
});

describe("bloquant 2 : le report détecté seul s'applique aux lignes NON qualifiées (auteur NULL)", () => {
  it("ligne sans auteur : reportCle posé ; ligne « axion » : jamais", async () => {
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
      rendezVousCle: "calendly:E9",
      prisAt: PRIS,
      rendezVousAt: PREVU,
      ecarteeAt: null,
      retenueAt: null,
    });
    ligne({ id: "N1", presentationId: "P1", rendezVousCle: "calendly:E1", auteur: null });
    ligne({ id: "X1", presentationId: "P1", rendezVousCle: "calendly:E2", auteur: "axion" });
    for (const [id, uri] of [
      ["E1", "I1"],
      ["E2", "I2"],
    ] as const)
      bd.calendly.push({ id, status: "canceled", inviteeUri: `u/${uri}`, startTime: PREVU });
    bd.rencontres.push(
      { id: "R1", ancienInviteeUri: "u/I1" },
      { id: "R2", ancienInviteeUri: "u/I2" },
    );
    await constaterAnnulations(MAINT);
    expect(bd.annulations.find((l) => l.id === "N1")!.reportCle).toBe("rencontre:R1");
    expect(bd.annulations.find((l) => l.id === "X1")!.reportCle).toBeNull();
  });
});

describe("non bloquant 2 : une ligne de réservation porte aussi un candidat", () => {
  it("rendez-vous de la ligne annulé à la source : annulation constatée", async () => {
    bd.res.push({
      presentationId: "P1",
      regle: "rendez_vous",
      echueAt: null,
      valideeAt: null,
      rendezVousCle: "calendly:E1",
      rendezVousPrisAt: PRIS,
      rendezVousAt: PREVU,
    });
    bd.calendly.push({ id: "E1", status: "canceled", startTime: PREVU });
    expect(await constaterAnnulations(MAINT)).toBe(1);
    expect(bd.annulations[0]).toMatchObject({
      presentationId: "P1",
      rendezVousCle: "calendly:E1",
      auteur: null,
    });
  });
});

describe("bloquant 3 : la suspension sans fin ne revient pas par la chaîne des reports", () => {
  const C = new Date("2026-11-02T09:00:00Z");
  const APRES = new Date("2026-12-20T10:00:00Z"); // > 15 jours après le constat
  it("A (report B) et B annulés par l'entreprise sans report : plus rien ne retient après 15 jours", async () => {
    ligne({
      id: "A",
      rendezVousCle: "calendly:A",
      auteur: "entreprise",
      constateeAt: C,
      reportCle: "calendly:B",
    });
    ligne({
      id: "B",
      rendezVousCle: "calendly:B",
      auteur: "entreprise",
      constateeAt: C,
      reportCle: null,
    });
    expect([...(await clesQuiNeRetiennentPlus("P1", APRES))].sort()).toEqual([
      "calendly:A",
      "calendly:B",
    ]);
  });

  it("un report encore vivant (non annulé) continue de retenir A", async () => {
    ligne({
      id: "A",
      rendezVousCle: "calendly:A",
      auteur: "entreprise",
      constateeAt: C,
      reportCle: "calendly:B",
    });
    expect([...(await clesQuiNeRetiennentPlus("P1", APRES))]).toEqual([]);
  });

  it("chaîne de trois : A → B → C, C libre libère tout", async () => {
    ligne({
      id: "A",
      rendezVousCle: "calendly:A",
      auteur: "entreprise",
      constateeAt: C,
      reportCle: "calendly:B",
    });
    ligne({
      id: "B",
      rendezVousCle: "calendly:B",
      auteur: "entreprise",
      constateeAt: C,
      reportCle: "calendly:C",
    });
    ligne({
      id: "C",
      rendezVousCle: "calendly:C",
      auteur: "entreprise",
      constateeAt: C,
      reportCle: null,
    });
    expect((await clesQuiNeRetiennentPlus("P1", APRES)).size).toBe(3);
  });

  it("avant les 15 jours, tout retient encore", async () => {
    ligne({
      id: "A",
      rendezVousCle: "calendly:A",
      auteur: "entreprise",
      constateeAt: C,
      reportCle: "calendly:B",
    });
    ligne({
      id: "B",
      rendezVousCle: "calendly:B",
      auteur: "entreprise",
      constateeAt: C,
      reportCle: null,
    });
    expect((await clesQuiNeRetiennentPlus("P1", new Date("2026-11-10T10:00:00Z"))).size).toBe(0);
  });
});

describe("bloquant 3 : lierReportAction respecte les 15 jours de l'art. 3.2", () => {
  const fd = (cle: string) => {
    const f = new FormData();
    f.set("id", UUID_A);
    f.set("reportCle", cle);
    return f;
  };
  const prep = (constateeAt: Date, prisAt: Date) => {
    ligne({ id: UUID_A, auteur: "entreprise", constateeAt });
    bd.props.push({ id: "PR2", presentationId: "P1", rendezVousCle: "calendly:E2", prisAt });
  };

  it("report pris dans les 15 jours : lié", async () => {
    prep(new Date(), new Date());
    expect((await lierReportAction({ etat: "idle" } as any, fd("calendly:E2"))).etat).toBe("ok");
    expect(bd.annulations[0]!.reportCle).toBe("calendly:E2");
  });

  it("15 jours passés : refusé", async () => {
    prep(new Date("2026-01-02T09:00:00Z"), new Date("2026-01-03T09:00:00Z"));
    const r = await lierReportAction({ etat: "idle" } as any, fd("calendly:E2"));
    expect(r.etat).toBe("erreur");
    expect(bd.annulations[0]!.reportCle).toBeNull();
  });

  it("report pris après les 15 jours : refusé", async () => {
    const c = new Date(Date.now() - 3 * 86_400_000);
    prep(c, new Date(c.getTime() + 20 * 86_400_000));
    const r = await lierReportAction({ etat: "idle" } as any, fd("calendly:E2"));
    expect(r.etat).toBe("erreur");
    expect(bd.annulations[0]!.reportCle).toBeNull();
  });
});
