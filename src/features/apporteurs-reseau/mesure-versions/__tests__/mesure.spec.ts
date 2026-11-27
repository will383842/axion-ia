import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { formaterRapport, mesurerDepuisBase, mesurerVersions, versionSignee } from "../mesure";

describe("versionSignee", () => {
  it("lit la version, absente = 2, jamais signé = null, illisible signalé", () => {
    expect(versionSignee({ version: "2.6" })).toBe("2.6");
    expect(versionSignee({})).toBe("absente");
    expect(versionSignee({ version: "2.6.0" })).toBe("2.6");
    expect(versionSignee({ version: "3" })).toBe("3.0");
    expect(versionSignee({ version: "2.08" })).toBe("illisible");
    expect(versionSignee({ version: "n'importe quoi" })).toBe("illisible");
    expect(versionSignee({ version: 2.6 })).toBe("illisible");
    expect(versionSignee(null)).toBeNull();
    expect(versionSignee([])).toBe("illisible");
    expect(versionSignee({ version: { x: 1 } })).toBe("illisible");
  });
});

describe("mesurerVersions (données fictives)", () => {
  it("compte apporteurs et commissions par version", () => {
    const apporteurs = [
      { id: "a", statut: "signe", signatureApporteur: { version: "2.6" } },
      { id: "b", statut: "signe", signatureApporteur: { version: "2.6" } },
      { id: "c", statut: "signe", signatureApporteur: { version: "2.8" } },
      { id: "d", statut: "signe", signatureApporteur: {} },
      { id: "e", statut: "a_verifier", signatureApporteur: null },
    ];
    const commissions = [
      { apporteurId: "a" },
      { apporteurId: "a" },
      { apporteurId: "c" },
      { apporteurId: "e" },
    ];
    const m = mesurerVersions(apporteurs, commissions);
    expect(m.sansSignature).toBe(1);
    expect(m.commissionsNonRattachees).toBe(1);
    expect(m.lignes).toEqual([
      { version: "2.6", apporteurs: 2, apporteursAvecCommission: 1, commissions: 2 },
      { version: "2.8", apporteurs: 1, apporteursAvecCommission: 1, commissions: 1 },
      { version: "absente", apporteurs: 1, apporteursAvecCommission: 0, commissions: 0 },
    ]);
  });

  it("masque toute la ligne (commissions comprises) sous le seuil d'apporteurs", () => {
    const r = formaterRapport(
      {
        lignes: [
          { version: "2.7", apporteurs: 1, apporteursAvecCommission: 1, commissions: 40 },
          { version: "2.6", apporteurs: 12, apporteursAvecCommission: 3, commissions: 40 },
        ],
        sansSignature: 2,
        commissionsNonRattachees: 3,
      },
      "2026-11-26",
    );
    expect(r).toContain("2.7 | < 5 | < 5 | < 5");
    expect(r.split("\n").find((l) => l.startsWith("2.7"))).not.toContain("40");
    expect(r).toContain("2.6 | 12 | < 5 | 40");
    expect(r).toContain("sans signature : < 5");
    expect(r).toContain("non rattachées (apporteur sans signature) depuis 2026-11-26 : < 5");
  });
});

describe("lecture seule", () => {
  it("n'appelle que findMany", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const client = { apporteurReseau: { findMany }, commissionApporteur: { findMany } };
    await mesurerDepuisBase(client);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("aucune écriture Prisma dans le module ni dans le script", () => {
    const racine = join(__dirname, "../../../../..");
    for (const f of [
      "src/features/apporteurs-reseau/mesure-versions/mesure.ts",
      "scripts/apporteurs/mesure-versions-contrat.ts",
    ]) {
      const src = readFileSync(join(racine, f), "utf8");
      expect(src).not.toMatch(
        /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRawUnsafe|\$transaction/,
      );
    }
  });
});
