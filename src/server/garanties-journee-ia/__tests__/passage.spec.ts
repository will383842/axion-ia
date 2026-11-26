import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, creerOuActualiser } = vi.hoisted(() => ({
  prisma: {
    garantieJourneeIa: { findMany: vi.fn() },
    alerteSysteme: { findMany: vi.fn(), updateMany: vi.fn() },
  },
  creerOuActualiser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuActualiser: (...a: unknown[]) => creerOuActualiser(...a),
}));

import { passerGarantiesJourneeIa } from "../passage";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const base = {
  id: "11111111-1111-4111-8111-111111111111",
  dateJournee: d("2026-12-01"),
  rapportRemisLe: null,
  demandeRecueLe: null,
  decision: null,
  decisionLe: null,
  virementLe: null,
  client: { raisonSociale: "ACME" },
};
// Le rapport est dû le 15/12/2026 (10 jours ouvrés après le 01/12). On passe le 10/12 → J-5.
const MAINTENANT = new Date("2026-12-10T06:50:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  prisma.garantieJourneeIa.findMany.mockResolvedValue([base]);
  prisma.alerteSysteme.findMany.mockResolvedValue([]);
  prisma.alerteSysteme.updateMany.mockResolvedValue({ count: 0 });
  creerOuActualiser.mockResolvedValue({ id: "a" });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("passerGarantiesJourneeIa", () => {
  it("lève l'alerte du palier atteint, avec sa cible et son palier en métadonnées", async () => {
    const b = await passerGarantiesJourneeIa(MAINTENANT);
    expect(b.creeesOuMisesAJour).toBe(1);
    const a = creerOuActualiser.mock.calls[0]?.[0];
    expect(a).toMatchObject({
      code: "garantie_ji_rapport",
      niveau: "info",
      cibleType: "GarantieJourneeIa",
      cibleId: base.id,
      metadata: { echeance: "rapport", palier: "J-5" },
    });
  });

  it("idempotent : deux passages le même jour = mêmes arguments (le service ne ré-arme rien)", async () => {
    await passerGarantiesJourneeIa(MAINTENANT);
    await passerGarantiesJourneeIa(new Date("2026-12-10T18:00:00Z"));
    expect(creerOuActualiser.mock.calls[0]?.[0]).toEqual(creerOuActualiser.mock.calls[1]?.[0]);
    // Service sans effet (alerte identique) : rien n'est compté.
    creerOuActualiser.mockResolvedValue(null);
    expect((await passerGarantiesJourneeIa(MAINTENANT)).creeesOuMisesAJour).toBe(0);
  });

  it("un nouveau palier change le niveau et le texte (donc ré-arme une notification)", async () => {
    await passerGarantiesJourneeIa(MAINTENANT);
    await passerGarantiesJourneeIa(new Date("2026-12-14T06:50:00Z")); // J-1 → palier J-2
    const [a, b] = [creerOuActualiser.mock.calls[0]?.[0], creerOuActualiser.mock.calls[1]?.[0]];
    expect(b.niveau).toBe("important");
    expect(b.message).not.toBe(a.message);
  });

  it("passe aussi le week-end (samedi 12/12 : J-3 → palier J-5)", async () => {
    await passerGarantiesJourneeIa(new Date("2026-12-12T06:50:00Z"));
    expect(creerOuActualiser).toHaveBeenCalledTimes(1);
  });

  it("échéance faite : aucune alerte, et l'alerte ouverte est refermée", async () => {
    prisma.garantieJourneeIa.findMany.mockResolvedValue([
      { ...base, rapportRemisLe: d("2026-12-03") },
    ]);
    prisma.alerteSysteme.findMany.mockResolvedValue([
      { id: "x", code: "garantie_ji_rapport", cibleId: base.id },
    ]);
    prisma.alerteSysteme.updateMany.mockResolvedValue({ count: 1 });
    const b = await passerGarantiesJourneeIa(MAINTENANT);
    expect(creerOuActualiser).not.toHaveBeenCalled();
    expect(b.resolues).toBe(1);
    expect(prisma.alerteSysteme.updateMany.mock.calls[0]?.[0].where).toEqual({ id: { in: ["x"] } });
  });

  it("dossier archivé : ignoré par la requête, ses alertes ouvertes sont refermées", async () => {
    prisma.garantieJourneeIa.findMany.mockResolvedValue([]);
    prisma.alerteSysteme.findMany.mockResolvedValue([
      { id: "y", code: "garantie_ji_reponse", cibleId: base.id },
    ]);
    prisma.alerteSysteme.updateMany.mockResolvedValue({ count: 1 });
    await passerGarantiesJourneeIa(MAINTENANT);
    expect(prisma.garantieJourneeIa.findMany.mock.calls[0]?.[0].where).toEqual({ archiveLe: null });
    expect(prisma.alerteSysteme.updateMany).toHaveBeenCalledTimes(1);
  });

  it("garde l'alerte encore voulue, ne referme que le reste, et ne touche qu'aux trois codes", async () => {
    prisma.alerteSysteme.findMany.mockResolvedValue([
      { id: "ok", code: "garantie_ji_rapport", cibleId: base.id },
    ]);
    await passerGarantiesJourneeIa(MAINTENANT);
    expect(prisma.alerteSysteme.updateMany).not.toHaveBeenCalled();
    expect(prisma.alerteSysteme.findMany.mock.calls[0]?.[0].where.code.in).toEqual([
      "garantie_ji_rapport",
      "garantie_ji_reponse",
      "garantie_ji_remboursement",
    ]);
  });

  it("demande réputée acceptée : alerte de virement, sans rien écrire sur le dossier", async () => {
    prisma.garantieJourneeIa.findMany.mockResolvedValue([
      { ...base, rapportRemisLe: d("2026-12-01"), demandeRecueLe: d("2026-12-02") },
    ]);
    // 02/12 + 15 j = 17/12 ; le 20/12 la réponse est dépassée, le virement (17/12 + 30 j = 16/01) est lointain.
    await passerGarantiesJourneeIa(new Date("2026-12-20T06:50:00Z"));
    const codes = creerOuActualiser.mock.calls.map((c) => c[0].code);
    expect(codes).toContain("garantie_ji_reponse");
    expect(
      creerOuActualiser.mock.calls.find((c) => c[0].code === "garantie_ji_reponse")?.[0].niveau,
    ).toBe("critique");
  });

  it("table absente (P2021) : journal, sortie propre, rien d'écrit", async () => {
    prisma.garantieJourneeIa.findMany.mockRejectedValue(
      Object.assign(new Error("no table"), { code: "P2021" }),
    );
    const b = await passerGarantiesJourneeIa(MAINTENANT);
    expect(b.tableAbsente).toBe(true);
    expect(creerOuActualiser).not.toHaveBeenCalled();
    expect(prisma.alerteSysteme.updateMany).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("P2021"));
  });

  it("toute autre erreur remonte", async () => {
    prisma.garantieJourneeIa.findMany.mockRejectedValue(
      Object.assign(new Error("boom"), { code: "P1001" }),
    );
    await expect(passerGarantiesJourneeIa(MAINTENANT)).rejects.toThrow("boom");
  });
});
