import { beforeEach, describe, expect, it, vi } from "vitest";

// Relecture du 27/11 (point 1) : la part du PARRAIN, ajustée par `suivreParrain` quand le filleul
// n'est pas encore facturé, doit être annoncée au parrain, avec l'identité de la ligne écrite.
// Données fictives uniquement.

const d = vi.hoisted(() => ({
  filleul: {} as Record<string, unknown>,
  parts: [] as Array<Record<string, unknown>>,
  maj: vi.fn(async (..._a: unknown[]) => ({ count: 1 })),
  reprise: vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({
    ok: true,
    message: "",
    repriseId: "rep-1",
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    commissionApporteur: {
      findUnique: vi.fn(async () => d.filleul),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        "palier" in where ? [] : d.parts,
      ),
      updateMany: (...a: unknown[]) => d.maj(...a),
    },
    activityLog: { create: vi.fn(async () => ({})) },
  },
}));
// Cas calibrés sur la grille v3 (la grille de la ligne est lue par `grilleDeLaLigne`).
vi.mock("../commissions", () => ({
  grilleDeLaLigne: vi.fn(async () => ({ grille: "v3", signeeAt: null })),
}));
vi.mock("../resiliation", () => ({
  PREFIXE_PALIER_REPRISE: "reprise:",
  enregistrerReprise: (...a: unknown[]) => d.reprise(...a),
}));

import { annulerCommission, reduireCommission } from "../ajustement";

const FILLEUL = {
  id: "f1",
  statut: "due",
  activite: "formation",
  palier: null,
  prixPublicHtCents: null,
  factureHtCents: 100_000,
  montantCents: 10_000,
  autofactureNumero: null,
  factureId: "fa1",
  parrainage: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  d.filleul = { ...FILLEUL };
});

describe("suivreParrain annonce l'écriture faite sur la part du parrain", () => {
  it("annulation du filleul : la part due du parrain annulée est rapportée (type annulee)", async () => {
    d.parts = [
      {
        id: "p1",
        apporteurId: "parrain1",
        montantCents: 1_000,
        statut: "due",
        autofactureNumero: null,
      },
    ];
    const vu: unknown[] = [];
    await annulerCommission("f1", "avoir total", null, async (e) => void vu.push(e));
    expect(vu).toEqual([
      { type: "annulee", apporteurId: "parrain1", ligneId: "p1", avantCents: 1_000 },
    ]);
  });

  it("réduction du filleul : la part réduite est rapportée avec son nouveau montant (type reduite)", async () => {
    d.parts = [
      {
        id: "p1",
        apporteurId: "parrain1",
        montantCents: 1_000,
        statut: "due",
        autofactureNumero: null,
      },
    ];
    const vu: Array<Record<string, unknown>> = [];
    d.filleul = { ...FILLEUL, activite: "un_a_un" };
    const r = await reduireCommission("f1", 10_000, "avoir partiel", null, async (e) => {
      vu.push({ ...e });
    });
    expect(r.ok).toBe(true);
    expect(vu).toHaveLength(1);
    expect(vu[0]!).toMatchObject({
      type: "reduite",
      apporteurId: "parrain1",
      ligneId: "p1",
      avantCents: 1_000,
    });
    expect(typeof vu[0]!.apresCents).toBe("number");
    expect(vu[0]!.apresCents as number).toBeLessThan(1_000);
  });

  it("part déjà versée : la reprise est rapportée avec son repriseId et le montant repris", async () => {
    d.parts = [
      {
        id: "p1",
        apporteurId: "parrain1",
        montantCents: 1_000,
        statut: "versee",
        autofactureNumero: "X",
      },
    ];
    const vu: unknown[] = [];
    await annulerCommission("f1", "avoir total", null, async (e) => void vu.push(e));
    expect(vu).toEqual([
      {
        type: "reprise",
        apporteurId: "parrain1",
        ligneId: "p1",
        avantCents: 1_000,
        reprisCents: 1_000,
        repriseId: "rep-1",
      },
    ]);
  });

  it("reprise refusée, ou écriture perdue (count 0) : rien n'est rapporté", async () => {
    d.parts = [
      {
        id: "p1",
        apporteurId: "parrain1",
        montantCents: 1_000,
        statut: "versee",
        autofactureNumero: "X",
      },
    ];
    d.reprise.mockResolvedValueOnce({ ok: false, message: "verrou" });
    const vu: unknown[] = [];
    await annulerCommission("f1", "x", null, async (e) => void vu.push(e));
    expect(vu).toEqual([]);

    d.parts = [
      {
        id: "p2",
        apporteurId: "parrain1",
        montantCents: 1_000,
        statut: "due",
        autofactureNumero: null,
      },
    ];
    d.maj.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await annulerCommission("f1", "x", null, async (e) => void vu.push(e));
    expect(vu).toEqual([]);
  });

  it("un rappel qui lève ne défait ni ne fait échouer l'ajustement", async () => {
    d.parts = [
      {
        id: "p1",
        apporteurId: "parrain1",
        montantCents: 1_000,
        statut: "due",
        autofactureNumero: null,
      },
    ];
    const r = await annulerCommission("f1", "x", null, async () => {
      throw new Error("boum");
    });
    expect(r.ok).toBe(true);
  });
});
