import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { documentSignatureHorodatage: m } }));

import {
  DELAI_ALERTE_HORODATAGE_MS,
  lireHorodatagesDeSignatures,
  listerHorodatagesEnRetard,
} from "./lire-horodatages";

const NOW = new Date("2026-11-20T12:00:00Z");
beforeEach(() => vi.clearAllMocks());

describe("lireHorodatagesDeSignatures (lecture seule)", () => {
  it("aucune signature : aucune requête", async () => {
    expect(await lireHorodatagesDeSignatures([])).toEqual([]);
    expect(m.findMany).not.toHaveBeenCalled();
  });
  it("une seule requête pour toutes les signatures", async () => {
    m.findMany.mockResolvedValue([{ statut: "obtenu", horodateAt: NOW, creeAt: NOW }]);
    const r = await lireHorodatagesDeSignatures(["s1", "s2"]);
    expect(r).toHaveLength(1);
    expect(m.findMany).toHaveBeenCalledTimes(1);
    expect(m.findMany.mock.calls[0]![0].where).toEqual({ signatureId: { in: ["s1", "s2"] } });
  });
  it("table absente (P2021) : liste vide, jamais de page tombée", async () => {
    m.findMany.mockRejectedValue(Object.assign(new Error("x"), { code: "P2021" }));
    expect(await lireHorodatagesDeSignatures(["s1"])).toEqual([]);
  });
});

describe("listerHorodatagesEnRetard", () => {
  it("seuil : en attente depuis plus de 24 h", async () => {
    m.findMany.mockResolvedValue([]);
    await listerHorodatagesEnRetard(NOW);
    const w = m.findMany.mock.calls[0]![0].where;
    expect(w.statut).toBe("en_attente");
    expect(w.creeAt.lt).toEqual(new Date(NOW.getTime() - DELAI_ALERTE_HORODATAGE_MS));
    expect(DELAI_ALERTE_HORODATAGE_MS).toBe(24 * 3600 * 1000);
  });
  it("rend le numéro de pièce et le devis lié", async () => {
    m.findMany.mockResolvedValue([
      {
        id: "h1",
        creeAt: new Date("2026-11-18T08:00:00Z"),
        essais: 4,
        signature: {
          documentGenere: { numero: "AXI-DEV-2026-001", devisPortes: [{ id: "d1" }] },
        },
      },
    ]);
    const r = await listerHorodatagesEnRetard(NOW);
    expect(r).toEqual([
      {
        id: "h1",
        depuis: new Date("2026-11-18T08:00:00Z"),
        essais: 4,
        numero: "AXI-DEV-2026-001",
        devisId: "d1",
      },
    ]);
  });
  it("lecture en échec : null (dit à l'écran, jamais tu)", async () => {
    m.findMany.mockRejectedValue(new Error("base"));
    expect(await listerHorodatagesEnRetard(NOW)).toBeNull();
  });
  it("table absente : liste vide", async () => {
    m.findMany.mockRejectedValue(Object.assign(new Error("x"), { code: "P2021" }));
    expect(await listerHorodatagesEnRetard(NOW)).toEqual([]);
  });
});
