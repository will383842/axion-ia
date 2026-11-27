import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  commission: null as Record<string, unknown> | null,
  parrainId: null as string | null,
  signature: { version: "2.8" } as unknown,
  part: null as Record<string, unknown> | null,
  signeeAt: new Date("2026-12-01T00:00:00Z") as Date | null,
  maj: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../envois", () => ({ envoyer: vi.fn(async () => "envoye") }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    commissionApporteur: {
      findUnique: vi.fn(async (a: { where: Record<string, unknown> }) =>
        "factureId_apporteurId_parrainage" in a.where ? etat.part : etat.commission,
      ),
      updateMany: vi.fn(
        async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          etat.maj.push(a);
          return { count: 1 };
        },
      ),
      aggregate: vi.fn(async () => ({ _sum: { montantCents: 0 } })),
    },
    factureFormation: {
      findUnique: vi.fn(async () => ({ emiseAt: etat.signeeAt, devis: null })),
    },
    presentationEntreprise: {
      findUnique: vi.fn(async () => ({
        recueAt: new Date("2026-11-01T00:00:00Z"),
        apporteur: { signatureApporteur: etat.signature },
      })),
    },
    pieceApporteur: { findMany: vi.fn(async () => []) },
    apporteurReseau: {
      findUnique: vi.fn(async (a: { where: { id: string } }) => ({
        parrainId: etat.parrainId,
        signatureApporteur: a.where.id === "PARRAIN" ? { version: "2.6" } : etat.signature,
      })),
    },
    emailLog: { count: vi.fn(async () => 1) },
  },
}));

import { classerActiviteCommission, qualifierCommission } from "../commissions";

const ligne = {
  id: "C1",
  apporteurId: "APP1",
  factureId: "F1",
  presentationId: "P1",
  parrainage: false,
  activite: "formation",
  factureHtCents: 200_000,
  statut: "a_qualifier",
};

beforeEach(() => {
  etat.commission = { ...ligne };
  etat.parrainId = null;
  etat.signature = { version: "2.8" };
  etat.part = null;
  etat.maj = [];
  etat.signeeAt = new Date("2026-12-01T00:00:00Z");
});

describe("règle et version posées à la qualification (jamais rétroactif)", () => {
  it("formation au prix public : forfait_palier + version signée, sous la garde a_qualifier", async () => {
    const r = await qualifierCommission("C1", "formation-generale-1j");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.where).toMatchObject({ statut: "a_qualifier" });
    expect(etat.maj[0]!.data).toMatchObject({
      regleAppliquee: "forfait_palier",
      versionContrat: "2.8",
    });
  });
  it("formation sous le prix public : prorata_remise", async () => {
    etat.commission = { ...ligne, factureHtCents: 1_000 };
    await qualifierCommission("C1", "formation-generale-1j");
    expect(etat.maj[0]!.data).toMatchObject({ regleAppliquee: "prorata_remise" });
  });
  it("Journée IA : journee_ia", async () => {
    await qualifierCommission("C1", "journee-ia");
    expect(etat.maj[0]!.data).toMatchObject({ regleAppliquee: "journee_ia" });
  });
  it("conférence d'avant la date d'effet : tarif_avant_date_effet", async () => {
    etat.signeeAt = new Date("2026-06-01T00:00:00Z");
    await qualifierCommission("C1", "conference");
    expect(etat.maj[0]!.data).toMatchObject({ regleAppliquee: "tarif_avant_date_effet" });
  });
  it("signature illisible : grille inconnue, ESCALADE (rien n'est écrit, rien d'inventé)", async () => {
    etat.signature = null;
    const r = await qualifierCommission("C1", "formation-generale-1j");
    expect(r.ok).toBe(false);
    expect(etat.maj).toHaveLength(0);
  });
  it("classement d'une activité (audit) : taux_ht + version", async () => {
    etat.commission = { ...ligne, activite: "inconnue" };
    await classerActiviteCommission("C1", "audit");
    expect(etat.maj[0]!.data).toMatchObject({ regleAppliquee: "taux_ht", versionContrat: "2.8" });
  });
  it("part du parrain qualifiée avec le filleul : parrainage_10 + version DU PARRAIN", async () => {
    etat.parrainId = "PARRAIN";
    etat.part = { id: "P1", statut: "a_qualifier", apporteurId: "PARRAIN" };
    await qualifierCommission("C1", "formation-generale-1j");
    const maj = etat.maj.find((m) => (m.where as { id?: string }).id === "P1");
    expect(maj!.data).toMatchObject({ regleAppliquee: "parrainage_10", versionContrat: "2.6" });
  });
});
