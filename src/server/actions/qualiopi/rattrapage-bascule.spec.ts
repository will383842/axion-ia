/**
 * Lot D2 (M22) — « Inscrire au relevé mensuel » (rattrapage avant la bascule).
 * Habilitation « rémunérer », confirmation exigée, date au 1er du mois ; n'écrit
 * que si l'aperçu relu compte autant de couples que celui affiché.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const lire = vi.fn();
const inscrire = vi.fn();
const log = vi.fn();
const redirect = vi.fn((u: string) => {
  throw new Error(`NEXT_REDIRECT ${u}`);
});

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "u", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => log(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/rattrapage-bascule", () => ({
  lireApercuRattrapage: (...a: unknown[]) => lire(...a),
  inscrireRattrapage: (...a: unknown[]) => inscrire(...a),
  debutFenetreRattrapage: () => new Date("2025-12-01T00:00:00Z"),
}));
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { inscrireRattrapageFormAction } from "./rattrapage-bascule";

const RETOUR = "/fr/adm/qualiopi/formateurs/interrupteurs";
const ok = { retour: RETOUR, dateBascule: "2026-12-01", aRevendiquerVu: "2", confirmer: "oui" };

function fd(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}
async function url(p: Promise<unknown>): Promise<string> {
  await expect(p).rejects.toThrow(/NEXT_REDIRECT/);
  return decodeURIComponent(String(redirect.mock.calls.at(-1)![0]));
}

beforeEach(() => {
  vi.clearAllMocks();
  lire.mockResolvedValue({ dateBascule: "2026-12-01", couples: [], aRevendiquer: 2, conflits: [] });
  inscrire.mockResolvedValue(2);
});

describe("inscrireRattrapageFormAction", () => {
  it("aperçu identique : inscrit, journal sans cible nominative", async () => {
    const u = await url(inscrireRattrapageFormAction(fd(ok)));
    expect(inscrire).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toMatchObject({ targetId: null, changes: { inscrits: 2 } });
    expect(u).toMatch(/ok=2 couple/);
  });

  it("la liste a changé depuis l'aperçu : rien n'est inscrit", async () => {
    lire.mockResolvedValue({
      dateBascule: "2026-12-01",
      couples: [],
      aRevendiquer: 3,
      conflits: [],
    });
    const u = await url(inscrireRattrapageFormAction(fd(ok)));
    expect(inscrire).not.toHaveBeenCalled();
    expect(u).toMatch(/erreur=La liste a changé/);
  });

  it("sans confirmation, date hors du 1er, aperçu absent : rien n'est lu ni inscrit", async () => {
    await url(inscrireRattrapageFormAction(fd({ ...ok, confirmer: "" })));
    await url(inscrireRattrapageFormAction(fd({ ...ok, dateBascule: "2026-12-15" })));
    await url(inscrireRattrapageFormAction(fd({ ...ok, aRevendiquerVu: "" })));
    expect(lire).not.toHaveBeenCalled();
    expect(inscrire).not.toHaveBeenCalled();
  });
});
