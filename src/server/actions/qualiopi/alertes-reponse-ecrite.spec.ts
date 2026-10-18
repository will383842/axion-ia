/**
 * Chantier QNC, L04 — l'alerte « cas complexe » ne se ferme qu'avec la réponse
 * écrite du référent : le clic « Résoudre » est refusé, les autres alertes
 * restent résolubles à la main.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const resoudreAlerte = vi.fn(async (id: string) => ({ id, code: "autre" }));

vi.mock("@/lib/prisma", () => ({
  prisma: { alerteSysteme: { findUnique: (a: unknown) => findUnique(a) } },
}));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  resoudreAlerte: (id: string) => resoudreAlerte(id),
  marquerLu: vi.fn(),
  marquerToutLu: vi.fn(),
  synchroniserAlertes: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "u1" })),
  logQualiopiActivity: vi.fn(),
}));

import { resoudreAlerteAction } from "./alertes";

const ID = "11111111-2222-4333-8444-555555555555";

beforeEach(() => vi.clearAllMocks());

describe("résolution manuelle", () => {
  it("cas complexe d'adaptation : refusée, l'alerte reste ouverte", async () => {
    findUnique.mockResolvedValue({ code: "adaptation_cas_complexe" });
    const r = await resoudreAlerteAction({ id: ID });
    expect(r).toHaveProperty("error");
    expect(resoudreAlerte).not.toHaveBeenCalled();
  });

  it("autre alerte : résolue comme avant", async () => {
    findUnique.mockResolvedValue({ code: "adaptation_utilite_a_examiner" });
    expect(await resoudreAlerteAction({ id: ID })).toEqual({ data: { id: ID } });
    expect(resoudreAlerte).toHaveBeenCalledWith(ID);
  });
});
