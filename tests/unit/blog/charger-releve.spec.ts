/** Relevé du baromètre rattaché à un article (G8) : jointure stricte, jamais de chiffre deviné. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const job = vi.fn();
const snap = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentGenJob: { findUnique: (...a: unknown[]) => job(...a) },
    barometerSnapshot: { findUnique: (...a: unknown[]) => snap(...a) },
  },
}));

const { chargerReleve } = await import("@/server/content-gen/blog/charger-releve");

const PAYLOAD = {
  totalResponses: 120,
  generatedAt: "2026-10-01T00:00:00.000Z",
  filter: { companySize: null, sector: null, region: null },
  distributions: {
    maturityLevel: [
      { value: "none", count: 30, pct: 25 },
      { value: "poc", count: 60, pct: 50 },
    ],
  },
  insights: { competitors_use_ai: 62, no_formal_strategy: 0, autre_cle: 9 },
};
const AVANT = new Date("2026-10-01T10:00:00Z");
const APRES = new Date("2026-10-02T10:00:00Z");

beforeEach(() => {
  job.mockReset();
  snap.mockReset();
  delete process.env.DATABASE_URL;
});

describe("chargerReleve", () => {
  it("sans identifiant de job : null, aucune requête", async () => {
    expect(await chargerReleve(null)).toBeNull();
    expect(job).not.toHaveBeenCalled();
  });

  it("sous le Proxy stub.invalid : null, aucune requête", async () => {
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
    expect(await chargerReleve("j1")).toBeNull();
    expect(job).not.toHaveBeenCalled();
  });

  it("job d'un autre type que barometer_insight : null", async () => {
    job.mockResolvedValue({ contentType: "faq_geo", startedAt: AVANT, createdAt: AVANT });
    expect(await chargerReleve("j1")).toBeNull();
    expect(snap).not.toHaveBeenCalled();
  });

  it("relevé calculé avant le début du job : rendu, chiffres tels quels", async () => {
    job.mockResolvedValue({
      contentType: "barometer_insight",
      startedAt: APRES,
      createdAt: APRES,
    });
    snap.mockResolvedValue({ computedAt: AVANT, totalResponses: 120, payload: PAYLOAD });
    const r = await chargerReleve("j1");
    expect(r).not.toBeNull();
    expect(r!.dateIso).toBe("2026-10-01");
    expect(r!.total).toBe(120);
    // 0 % et clé inconnue écartés, comme dans le bloc « DONNÉES VÉRIFIÉES » du générateur
    expect(r!.constats).toEqual([{ cle: "competitors_use_ai", pct: 62 }]);
    expect(r!.maturite).toEqual([
      { valeur: "none", pct: 25 },
      { valeur: "poc", pct: 50 },
    ]);
  });

  it("relevé recalculé APRÈS le job : null (les chiffres ont pu changer)", async () => {
    job.mockResolvedValue({
      contentType: "barometer_insight",
      startedAt: AVANT,
      createdAt: AVANT,
    });
    snap.mockResolvedValue({ computedAt: APRES, totalResponses: 120, payload: PAYLOAD });
    expect(await chargerReleve("j1")).toBeNull();
  });

  it("pas de relevé, ou lecture en erreur : null", async () => {
    job.mockResolvedValue({ contentType: "barometer_insight", startedAt: APRES, createdAt: APRES });
    snap.mockResolvedValue(null);
    expect(await chargerReleve("j1")).toBeNull();
    job.mockRejectedValue(new Error("db"));
    expect(await chargerReleve("j1")).toBeNull();
  });
});
