import { beforeEach, describe, expect, it, vi } from "vitest";

// PR H (#2464) : AUCUNE part de parrainage sur une prime de challenge. La prime n'est pas la
// commission d'un filleul : annuler ou réduire une prime ne touche jamais une part de parrain,
// même si une ligne de parrainage portait (par erreur) le même `factureId`.

const PRIME = "9c1d0f3a-2b4e-4c8a-8f55-3a7e6d5c4b21";
const d = vi.hoisted(() => ({
  lignes: [] as Array<Record<string, unknown>>,
  requetesParrainage: 0,
  maj: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    commissionApporteur: {
      findUnique: async (a: { where: { id: string } }) =>
        d.lignes.find((l) => l["id"] === a.where.id) ?? null,
      findMany: async (a: { where: Record<string, unknown> }) => {
        if (a.where["parrainage"] === true) d.requetesParrainage += 1;
        return d.lignes.filter(
          (l) =>
            l["factureId"] === a.where["factureId"] && l["parrainage"] === a.where["parrainage"],
        );
      },
      updateMany: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        d.maj.push({ ...a.where, ...a.data });
        const l = d.lignes.find((x) => x["id"] === a.where["id"]);
        if (!l) return { count: 0 };
        Object.assign(l, a.data);
        return { count: 1 };
      },
    },
    activityLog: { create: async () => ({}) },
  },
}));
vi.mock("../commissions", () => ({ grilleDeLaLigne: vi.fn(async () => ({ grille: "v3" })) }));
vi.mock("../resiliation", () => ({
  enregistrerReprise: vi.fn(),
  PREFIXE_PALIER_REPRISE: "reprise:",
}));

import { annulerCommission, reduireCommission } from "../ajustement";

const prime = () => ({
  id: "p1",
  statut: "due",
  activite: "prime_challenge",
  palier: "challenge:5b0c7e0e-6f0e-4d57-9a64-0d9d6b1f4a10",
  prixPublicHtCents: null,
  factureHtCents: 0,
  montantCents: 50_000,
  autofactureNumero: null,
  factureId: PRIME,
  parrainage: false,
  presentationId: null,
});
const part = () => ({
  id: "part1",
  statut: "due",
  activite: "formation",
  palier: null,
  prixPublicHtCents: null,
  factureHtCents: 0,
  montantCents: 5_000,
  autofactureNumero: null,
  factureId: PRIME,
  parrainage: true,
  presentationId: null,
  apporteurId: "PARRAIN",
});

beforeEach(() => {
  d.lignes = [prime(), part()];
  d.requetesParrainage = 0;
  d.maj = [];
});

describe("une prime n'a jamais de part de parrainage", () => {
  it("annuler une prime ne cherche ni ne touche aucune part de parrain", async () => {
    const r = await annulerCommission("p1", "prime attribuée par erreur");
    expect(r).toMatchObject({ ok: true });
    expect(d.requetesParrainage).toBe(0);
    expect(d.lignes.find((l) => l["id"] === "part1")).toMatchObject({
      statut: "due",
      montantCents: 5_000,
    });
  });

  it("réduire une prime ne cherche ni ne touche aucune part de parrain", async () => {
    await reduireCommission("p1", 100_000, "motif");
    expect(d.requetesParrainage).toBe(0);
    expect(d.lignes.find((l) => l["id"] === "part1")!["montantCents"]).toBe(5_000);
  });
});
