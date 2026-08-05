/**
 * Tests — seed du référentiel Qualiopi (offres + config + grilles).
 *
 * Couvre : verrou XACT acquis (seed exécuté dans la transaction), verrou détenu
 * par une autre instance (skip propre, ran=false), atomicité (une erreur de
 * sous-seed rejette la transaction), auto-réparation grille hors verrou, mode
 * build stub.invalid (no-op), et calcul du statut.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { seedOffresSite, seedGrilleQualite, seedGrilleV2, seedGrilleV3 } = vi.hoisted(() => ({
  seedOffresSite: vi.fn(async () => {}),
  seedGrilleQualite: vi.fn(async () => {}),
  seedGrilleV2: vi.fn(async () => {}),
  seedGrilleV3: vi.fn(async () => {}),
}));

vi.mock("../../../../prisma/seeds/qualiopi/offres", () => ({ seedOffresSite }));
vi.mock("../../../../prisma/seeds/qualiopi/grille", () => ({ seedGrilleQualite }));
vi.mock("../../../../prisma/seeds/qualiopi/grille-v2", () => ({ seedGrilleV2 }));
vi.mock("../../../../prisma/seeds/qualiopi/grille-v3", () => ({ seedGrilleV3 }));

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
  const prisma = {
    $queryRaw: vi.fn(async () => [{ locked }]),
    // La transaction interactive invoque le callback avec le client transactionnel
    // (ici le mock lui-même, `tx` === `prisma`) et propage tout rejet du callback.
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
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
      // Auto-réparation : réactivation explicite de la v3 hors verrou.
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return prisma;
}

const ORIGINAL_DB_URL = process.env["DATABASE_URL"];

beforeEach(() => {
  seedOffresSite.mockClear();
  seedGrilleQualite.mockClear();
  seedGrilleV2.mockClear();
  seedGrilleV3.mockClear();
  process.env["DATABASE_URL"] = "postgresql://u:p@localhost:5432/db";
});

afterEach(() => {
  process.env["DATABASE_URL"] = ORIGINAL_DB_URL;
});

describe("seedQualiopiReferenceData", () => {
  it("exécute les 3 seeds dans la transaction quand le verrou est acquis et retourne ran=true + statut", async () => {
    const prisma = makePrisma({
      locked: true,
      offresCount: 11,
      grilleActiveCle: "grille_qualite_v2",
    });
    const report = await seedQualiopiReferenceData(prisma);
    expect(report.ran).toBe(true);
    expect(report.offresCount).toBe(11);
    expect(report.grilleActiveCle).toBe("grille_qualite_v2");
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(seedOffresSite).toHaveBeenCalledOnce();
    expect(seedGrilleQualite).toHaveBeenCalledOnce();
    expect(seedGrilleV2).toHaveBeenCalledOnce();
    // grille déjà active → pas d'auto-réparation, seedGrilleV3 appelé une seule fois (dans la tx)
    expect(seedGrilleV3).toHaveBeenCalledOnce();
  });

  it("acquiert un verrou XACT dans une transaction (un seul queryRaw, pas d'unlock manuel)", async () => {
    const prisma = makePrisma({ locked: true });
    await seedQualiopiReferenceData(prisma);
    // Seul le lock (pg_try_advisory_xact_lock) passe par $queryRaw ; l'unlock est
    // automatique au COMMIT (plus d'appel pg_advisory_unlock).
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("ne seed PAS et retourne ran=false si le verrou est détenu par une autre instance", async () => {
    const prisma = makePrisma({ locked: false });
    const report = await seedQualiopiReferenceData(prisma);
    expect(report.ran).toBe(false);
    expect(seedOffresSite).not.toHaveBeenCalled();
    expect(seedGrilleQualite).not.toHaveBeenCalled();
    expect(seedGrilleV2).not.toHaveBeenCalled();
    // Grille active présente (défaut du mock) → pas d'auto-réparation non plus.
    expect(seedGrilleV3).not.toHaveBeenCalled();
  });

  it("rejette (rollback) si un sous-seed échoue dans la transaction", async () => {
    const prisma = makePrisma({ locked: true });
    seedOffresSite.mockRejectedValueOnce(new Error("boom offres"));
    await expect(seedQualiopiReferenceData(prisma)).rejects.toThrow("boom offres");
    // Les seeds postérieurs n'ont pas tourné (la tx a rejeté sur l'offre).
    expect(seedGrilleQualite).not.toHaveBeenCalled();
  });

  it("auto-répare la grille hors verrou si elle est absente après la transaction", async () => {
    const prisma = makePrisma({ locked: true, grilleActiveCle: null });
    const report = await seedQualiopiReferenceData(prisma);
    expect(report.ran).toBe(true);
    // seedGrilleV3 appelé 2× : une fois dans la tx, une fois en réparation hors
    // verrou — suivie de la réactivation explicite (v3 active, les autres non).
    expect(seedGrilleV3).toHaveBeenCalledTimes(2);
    expect(prisma.grilleQualiteConfig.updateMany).toHaveBeenCalledWith({
      where: { cleUnique: "grille_qualite_v3" },
      data: { actif: true },
    });
  });

  it("est un no-op (ran=false, aucune transaction) en mode build stub.invalid", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const prisma = makePrisma();
    const report = await seedQualiopiReferenceData(prisma);
    expect(report.ran).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(seedOffresSite).not.toHaveBeenCalled();
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
