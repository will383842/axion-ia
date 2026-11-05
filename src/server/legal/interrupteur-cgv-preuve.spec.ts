// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { setting: { findUnique } } }));

import { allumagePreuveCgv, CLE_SETTING_CGV_PREUVE } from "./interrupteur-cgv-preuve";

const MAJ = new Date("2026-11-01T00:00:00Z");
beforeEach(() => vi.resetAllMocks());

describe("allumagePreuveCgv", () => {
  it.each([
    ["clé absente", null],
    ["valeur illisible", { value: "oui", updatedAt: MAJ }],
    ["tableau", { value: [], updatedAt: MAJ }],
    ["arrêté", { value: { actif: false }, updatedAt: MAJ }],
    ["actif non booléen", { value: { actif: "true" }, updatedAt: MAJ }],
  ])("%s : éteint (null)", async (_n, ligne) => {
    findUnique.mockResolvedValue(ligne);
    expect(await allumagePreuveCgv()).toBeNull();
    expect(findUnique.mock.calls[0]?.[0]).toMatchObject({ where: { key: CLE_SETTING_CGV_PREUVE } });
  });

  it("lecture en panne : éteint, ne lève pas", async () => {
    findUnique.mockRejectedValue(new Error("db"));
    expect(await allumagePreuveCgv()).toBeNull();
  });

  it("allumé : date d'allumage, sinon dernière écriture", async () => {
    findUnique.mockResolvedValue({
      value: { actif: true, allumeLe: "2026-11-03T08:00:00.000Z" },
      updatedAt: MAJ,
    });
    expect((await allumagePreuveCgv())?.toISOString()).toBe("2026-11-03T08:00:00.000Z");
    findUnique.mockResolvedValue({ value: { actif: true }, updatedAt: MAJ });
    expect(await allumagePreuveCgv()).toEqual(MAJ);
  });
});
