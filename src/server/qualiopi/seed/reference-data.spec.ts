/**
 * Tests — seed du référentiel Qualiopi (offres + config + grilles).
 *
 * Couvre : verrou acquis (seed exécuté), verrou détenu par une autre instance
 * (skip propre), mode build stub.invalid (no-op), et calcul du statut.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { seedOffresSite, seedGrilleQualite, seedGrilleV2 } = vi.hoisted(() => ({
  seedOffresSite: vi.fn(async () => {}),
  seedGrilleQualite: vi.fn(async () => {}),
  seedGrilleV2: vi.fn(async () => {}),
}));

vi.mock("../../../../prisma/seeds/qualiopi/offres", () => ({ seedOffresSite }));
vi.mock("../../../../prisma/seeds/qualiopi/grille", () => ({ seedGrilleQualite }));
vi.mock("../../../../prisma/seeds/qualiopi/grille-v2", () => ({ seedGrilleV2 }));

import { seedQualiopiReferenceData, getQualiopiReferenceDataStatus } from "./reference-data";

interface MockOpts {
  locked?: boolean;
  offresCount?: number;
  configCount?: number;
  grilleActiveCle?: string | null;
}

function makePrisma(opts: MockOpts = {}) {
  const {
    locked = true,
    offresCount = 11,
    configCount = 7,
    grilleActiveCle = "grille_qualite_v2",
  } = opts;
  return {
    $queryRaw: vi.fn(async () => [{ locked }]),
    siteSetting: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
      count: vi.fn(async () => configCount),
    },
    offreSite: { count: vi.fn(async () => offresCount) },
    grilleQualiteConfig: {
      findFirst: vi.fn(async () =>
        grilleActiveCle == null ? null : { cleUnique: grilleActiveCle },
      ),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const ORIGINAL_DB_URL = process.env["DATABASE_URL"];

beforeEach(() => {
  seedOffresSite.mockClear();
  seedGrilleQualite.mockClear();
  seedGrilleV2.mockClear();
  process.env["DATABASE_URL"] = "postgresql://u:p@localhost:5432/db";
});

afterEach(() => {
  process.env["DATABASE_URL"] = ORIGINAL_DB_URL;
});

describe("seedQualiopiReferenceData", () => {
  it("exécute les 3 seeds quand le verrou est acquis et retourne ran=true + statut", async () => {
    const prisma = makePrisma({
      locked: true,
      offresCount: 11,
      grilleActiveCle: "grille_qualite_v2",
    });
    const report = await seedQualiopiReferenceData(prisma);
    expect(report.ran).toBe(true);
    expect(report.offresCount).toBe(11);
    expect(report.grilleActiveCle).toBe("grille_qualite_v2");
    expect(seedOffresSite).toHaveBeenCalledOnce();
    expect(seedGrilleQualite).toHaveBeenCalledOnce();
    expect(seedGrilleV2).toHaveBeenCalledOnce();
  });

  it("ne seed PAS et retourne ran=false si le verrou est détenu par une autre instance", async () => {
    const prisma = makePrisma({ locked: false });
    const report = await seedQualiopiReferenceData(prisma);
    expect(report.ran).toBe(false);
    expect(seedOffresSite).not.toHaveBeenCalled();
    expect(seedGrilleQualite).not.toHaveBeenCalled();
    expect(seedGrilleV2).not.toHaveBeenCalled();
  });

  it("est un no-op (ran=false, aucun queryRaw) en mode build stub.invalid", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const prisma = makePrisma();
    const report = await seedQualiopiReferenceData(prisma);
    expect(report.ran).toBe(false);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(seedOffresSite).not.toHaveBeenCalled();
  });

  it("libère le verrou (unlock) après seed", async () => {
    const prisma = makePrisma({ locked: true });
    await seedQualiopiReferenceData(prisma);
    // 1 appel lock + 1 appel unlock
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});

describe("getQualiopiReferenceDataStatus", () => {
  it("retourne les compteurs courants", async () => {
    const prisma = makePrisma({ offresCount: 3, configCount: 5, grilleActiveCle: null });
    const status = await getQualiopiReferenceDataStatus(prisma);
    expect(status.offresCount).toBe(3);
    expect(status.configKeysSet).toBe(5);
    expect(status.grilleActiveCle).toBeNull();
    expect(status.configKeysTotal).toBeGreaterThan(0);
  });
});
