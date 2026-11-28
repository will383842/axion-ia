import { beforeEach, describe, expect, it, vi } from "vitest";

// PR K (2464) — non-régression : un apporteur RETIRÉ du réseau, sans argent en jeu,
// reste sur la page neutre (null), même avec un lien valide. L'archive ne vaut que
// pour un contrat résilié.
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  retraitDe: vi.fn(async () => new Date() as Date | null),
  argentEnJeu: vi.fn(async () => false),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { apporteurReseau: { findUnique: (...a: unknown[]) => h.findUnique(...a) } },
}));
vi.mock("../retrait", () => ({
  retraitDe: (...a: unknown[]) => h.retraitDe(...(a as [])),
  argentEnJeu: (...a: unknown[]) => h.argentEnJeu(...(a as [])),
}));

import { lireDossierParLien } from "../donnees";
import { jetonDossier } from "../jeton";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

beforeEach(() => {
  vi.clearAllMocks();
  h.findUnique.mockResolvedValue({ versionLien: 3, statut: "signe" });
  h.retraitDe.mockResolvedValue(new Date());
  h.argentEnJeu.mockResolvedValue(false);
});

describe("retiré sans argent", () => {
  it("lien valide → page neutre (null), sans archive", async () => {
    expect(await lireDossierParLien(ID, jetonDossier(ID, 3)!)).toBeNull();
    expect(h.retraitDe).toHaveBeenCalledWith(ID);
  });
});
