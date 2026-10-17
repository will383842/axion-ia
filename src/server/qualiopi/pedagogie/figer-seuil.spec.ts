import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { setting: { findUnique: vi.fn() } } }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(75),
}));

import { prisma } from "@/lib/prisma";
import { figerSeuilSiPedagogie } from "./figer-seuil";

const find = (prisma as unknown as { setting: { findUnique: ReturnType<typeof vi.fn> } }).setting
  .findUnique;
const snap = { v: 1, titre: "Formation IA" };

beforeEach(() => vi.clearAllMocks());

describe("figerSeuilSiPedagogie", () => {
  it("éteint : snapshot inchangé, sans seuil", async () => {
    find.mockResolvedValue(null);
    expect(await figerSeuilSiPedagogie(snap)).toBe(snap);
  });

  it.each(["essai", "actif"])("%s : le seuil du réglage est figé", async (etat) => {
    find.mockResolvedValue({ value: { etat } });
    expect(await figerSeuilSiPedagogie(snap)).toEqual({ ...snap, seuilReussitePct: 75 });
  });
});
