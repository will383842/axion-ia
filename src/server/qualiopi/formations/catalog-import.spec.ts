/**
 * Tests — import du catalogue marketing → table Formation.
 * Mapping pur + service idempotent (faux client Prisma, aucune DB réelle).
 */

import { describe, it, expect } from "vitest";
import type { PrismaClient } from "../../../../prisma/generated/client";
import { FORMATIONS_V2 } from "../../../content/formations/catalog-v2";
import { isValidDocumentNumber } from "../numbering/formats";
import { buildFormationImportData, importCatalogFormations, premierVerbe } from "./catalog-import";

const FIXED_NOW = new Date("2026-06-20T10:00:00.000Z");

// ─────────────────────────────────────────────────────────────────────────────
// Faux client Prisma minimal (formation.count/findUnique/create + offreSite)
// ─────────────────────────────────────────────────────────────────────────────

interface FakeDbConfig {
  existingFormationSlugs?: string[];
  missingOffreSlugs?: string[];
}

function makeFakeDb(config: FakeDbConfig = {}): {
  db: PrismaClient;
  createdRows: Array<Record<string, unknown>>;
} {
  const existing = new Set(config.existingFormationSlugs ?? []);
  const missingOffre = new Set(config.missingOffreSlugs ?? []);
  const createdRows: Array<Record<string, unknown>> = [];
  let count = 0;

  const db = {
    formation: {
      count: async () => count,
      findUnique: async ({ where }: { where: { slug: string } }) => {
        if (existing.has(where.slug)) return { id: `existing-${where.slug}` };
        const found = createdRows.find((r) => r.slug === where.slug);
        return found ? { id: found.id as string } : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        count += 1;
        const row = { id: `id-${count}`, ...data };
        createdRows.push(row);
        return { id: row.id, numero: data.numero as string };
      },
    },
    offreSite: {
      findUnique: async ({ where }: { where: { slug: string } }) =>
        missingOffre.has(where.slug) ? null : { id: `offre-${where.slug}` },
    },
  };

  return { db: db as unknown as PrismaClient, createdRows };
}

// ─────────────────────────────────────────────────────────────────────────────
// premierVerbe
// ─────────────────────────────────────────────────────────────────────────────

describe("premierVerbe", () => {
  it("renvoie le premier mot (verbe d'action)", () => {
    expect(premierVerbe("Produire un texte professionnel")).toBe("Produire");
    expect(premierVerbe("  Anonymiser en 30 secondes")).toBe("Anonymiser");
    expect(premierVerbe("")).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildFormationImportData
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFormationImportData", () => {
  const iaExpress = FORMATIONS_V2.find((f) => f.slugFr === "ia-express");

  it("le catalogue contient bien la formation pilote", () => {
    expect(iaExpress).toBeDefined();
  });

  it("mappe titre, slug, durée et offre", () => {
    const data = buildFormationImportData(iaExpress!, "offre-x");
    expect(data.titre).toBe(iaExpress!.titreFr);
    expect(data.slug).toBe("ia-express");
    expect(data.offreSiteId).toBe("offre-x");
    expect(data.dureeHeures).toBe(4); // 4h → 4
    expect(data.modalite).toBe("presentiel");
  });

  it("mappe chaque objectif (verbe + description)", () => {
    const data = buildFormationImportData(iaExpress!, "offre-x");
    expect(data.objectifsPedagogiques).toHaveLength(iaExpress!.objectifsFr.length);
    expect(data.objectifsPedagogiques[0]).toEqual({
      id: "obj-1",
      verbe: "Produire",
      description: iaExpress!.objectifsFr[0],
    });
  });

  it("mappe le programme en modules + séquences (temps préservé)", () => {
    const data = buildFormationImportData(iaExpress!, "offre-x");
    expect(data.programmeDetaille).toHaveLength(iaExpress!.programme.length);
    const mod0 = data.programmeDetaille[0]!;
    expect(mod0.moduleId).toBe("mod-1");
    expect(mod0.titre).toBe(iaExpress!.programme[0]!.titreFr);
    expect(mod0.sequences[0]!.titre).toBe(iaExpress!.programme[0]!.steps[0]!.titre);
    expect(mod0.sequences[0]!.temps).toBe(iaExpress!.programme[0]!.steps[0]!.temps);
  });

  it("sort en état session-ready", () => {
    const data = buildFormationImportData(iaExpress!, "offre-x");
    expect(data.statutGeneration).toBe("publie");
    expect(data.statut).toBe("actif");
    expect(data.aiGenerated).toBe(false);
    expect(data.ratioPratiquePct).toBeGreaterThanOrEqual(60);
  });

  it("ne pose validatedBy/At que si un admin déclenche", () => {
    const sansAdmin = buildFormationImportData(iaExpress!, "offre-x", { now: FIXED_NOW });
    expect(sansAdmin.validatedBy).toBeNull();
    expect(sansAdmin.validatedAt).toBeNull();

    const avecAdmin = buildFormationImportData(iaExpress!, "offre-x", {
      adminUserId: "admin-1",
      now: FIXED_NOW,
    });
    expect(avecAdmin.validatedBy).toBe("admin-1");
    expect(avecAdmin.validatedAt).toBe(FIXED_NOW);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// importCatalogFormations
// ─────────────────────────────────────────────────────────────────────────────

describe("importCatalogFormations", () => {
  it("crée les 17 formations sur une base vierge", async () => {
    const { db, createdRows } = makeFakeDb();
    const report = await importCatalogFormations(db, { now: FIXED_NOW });

    expect(report.total).toBe(FORMATIONS_V2.length);
    expect(report.created).toBe(FORMATIONS_V2.length);
    expect(report.skippedExistantes).toBe(0);
    expect(report.skippedOffreAbsente).toBe(0);
    expect(createdRows).toHaveLength(FORMATIONS_V2.length);
  });

  it("alloue des numéros AXI-FORM séquentiels valides", async () => {
    const { db } = makeFakeDb();
    const report = await importCatalogFormations(db, { now: FIXED_NOW });
    const created = report.items.filter((i) => i.status === "created");
    expect(created[0]!.numero).toBe("AXI-FORM-2026-001");
    for (const item of created) {
      expect(isValidDocumentNumber(item.numero!)).toBe(true);
    }
  });

  it("est idempotent : ré-exécution ne crée rien (tout déjà présent)", async () => {
    const { db } = makeFakeDb({
      existingFormationSlugs: FORMATIONS_V2.map((f) => f.slugFr),
    });
    const report = await importCatalogFormations(db, { now: FIXED_NOW });
    expect(report.created).toBe(0);
    expect(report.skippedExistantes).toBe(FORMATIONS_V2.length);
  });

  it("ignore (sans bloquer) une formation dont l'offre V2 manque", async () => {
    const cible = FORMATIONS_V2[0]!.slugFr;
    const { db } = makeFakeDb({ missingOffreSlugs: [cible] });
    const report = await importCatalogFormations(db, { now: FIXED_NOW });

    expect(report.created).toBe(FORMATIONS_V2.length - 1);
    expect(report.skippedOffreAbsente).toBe(1);
    const item = report.items.find((i) => i.slug === cible);
    expect(item?.status).toBe("skipped_offre_absente");
  });
});
