/**
 * Tests — import du catalogue marketing → table Formation.
 * Mapping pur + service idempotent (faux client Prisma, aucune DB réelle).
 */

import { describe, it, expect } from "vitest";
import type { PrismaClient } from "../../../../prisma/generated/client";
import { FORMATIONS_V2 } from "../../../content/formations/catalog-v2";
import { isValidDocumentNumber } from "../numbering/formats";
import {
  buildFormationImportData,
  importCatalogFormations,
  premierVerbe,
  reconcileFormationFields,
  toCatalogSnapshot,
  type CatalogSnapshot,
} from "./catalog-import";

const FIXED_NOW = new Date("2026-06-20T10:00:00.000Z");

// ─────────────────────────────────────────────────────────────────────────────
// Faux client Prisma (formation.count/findUnique/create/update + offreSite).
// Stocke des lignes complètes pour exercer la réconciliation 3-way.
// ─────────────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown> & { id: string; slug: string };

interface FakeDbConfig {
  /** Slugs déjà en base, pré-remplis comme une création catalogue (→ unchanged). */
  existingFormationSlugs?: string[];
  /** Lignes existantes explicites (pour tester synced/drifted/legacy). */
  existingRows?: Row[];
  missingOffreSlugs?: string[];
  /** Nombre de sessions verrouillantes (en_cours/realisee) par id de formation. */
  lockingSessionsByFormationId?: Record<string, number>;
}

/** Ligne existante alignée sur le catalogue (snapshot = catalogue) → unchanged. */
function rowFromCatalog(slug: string): Row {
  const f = FORMATIONS_V2.find((x) => x.slugFr === slug);
  if (!f) throw new Error(`slug inconnu: ${slug}`);
  const data = buildFormationImportData(f, `offre-${slug}`, { now: FIXED_NOW });
  return { ...data, id: `existing-${slug}`, slug, catalogSnapshot: toCatalogSnapshot(data) };
}

function makeFakeDb(config: FakeDbConfig = {}): {
  db: PrismaClient;
  rows: Map<string, Row>;
  createdRows: Row[];
  updates: Array<{ id: string; data: Record<string, unknown> }>;
} {
  const missingOffre = new Set(config.missingOffreSlugs ?? []);
  const rows = new Map<string, Row>();
  for (const slug of config.existingFormationSlugs ?? []) rows.set(slug, rowFromCatalog(slug));
  for (const row of config.existingRows ?? []) rows.set(row.slug, row);
  const createdRows: Row[] = [];
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  let count = rows.size;

  const db = {
    formation: {
      count: async () => count,
      findUnique: async ({ where }: { where: { slug: string } }) => rows.get(where.slug) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        count += 1;
        const row = { id: `id-${count}`, ...data } as Row;
        rows.set(row.slug, row);
        createdRows.push(row);
        return { id: row.id, numero: data.numero as string };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: where.id, data });
        for (const row of rows.values()) {
          if (row.id === where.id) Object.assign(row, data);
        }
        return { id: where.id };
      },
    },
    offreSite: {
      findUnique: async ({ where }: { where: { slug: string } }) =>
        missingOffre.has(where.slug) ? null : { id: `offre-${where.slug}` },
    },
    trainingSession: {
      count: async ({ where }: { where: { formationId: string } }) =>
        config.lockingSessionsByFormationId?.[where.formationId] ?? 0,
    },
  };

  return { db: db as unknown as PrismaClient, rows, createdRows, updates };
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
  const pilote = FORMATIONS_V2.find((f) => f.slugFr === "ia-pour-bien-commencer");

  it("le catalogue contient bien la formation pilote", () => {
    expect(pilote).toBeDefined();
  });

  it("mappe titre, slug, durée et offre", () => {
    const data = buildFormationImportData(pilote!, "offre-x");
    expect(data.titre).toBe(pilote!.titreFr);
    expect(data.slug).toBe("ia-pour-bien-commencer");
    expect(data.offreSiteId).toBe("offre-x");
    expect(data.dureeHeures).toBe(4); // 4h → 4
    expect(data.modalite).toBe("presentiel");
  });

  it("mappe chaque objectif (verbe + description)", () => {
    const data = buildFormationImportData(pilote!, "offre-x");
    expect(data.objectifsPedagogiques).toHaveLength(pilote!.objectifsFr.length);
    expect(data.objectifsPedagogiques[0]).toEqual({
      id: "obj-1",
      verbe: "Décrire",
      description: pilote!.objectifsFr[0],
    });
  });

  it("mappe le programme en modules + séquences (temps préservé)", () => {
    const data = buildFormationImportData(pilote!, "offre-x");
    expect(data.programmeDetaille).toHaveLength(pilote!.programme.length);
    const mod0 = data.programmeDetaille[0]!;
    expect(mod0.moduleId).toBe("mod-1");
    expect(mod0.titre).toBe(pilote!.programme[0]!.titreFr);
    expect(mod0.sequences[0]!.titre).toBe(pilote!.programme[0]!.steps[0]!.titre);
    expect(mod0.sequences[0]!.temps).toBe(pilote!.programme[0]!.steps[0]!.temps);
  });

  it("sort en état session-ready", () => {
    const data = buildFormationImportData(pilote!, "offre-x");
    expect(data.statutGeneration).toBe("publie");
    expect(data.statut).toBe("actif");
    expect(data.aiGenerated).toBe(false);
    expect(data.ratioPratiquePct).toBeGreaterThanOrEqual(60);
  });

  it("ne pose validatedBy/At que si un admin déclenche", () => {
    const sansAdmin = buildFormationImportData(pilote!, "offre-x", { now: FIXED_NOW });
    expect(sansAdmin.validatedBy).toBeNull();
    expect(sansAdmin.validatedAt).toBeNull();

    const avecAdmin = buildFormationImportData(pilote!, "offre-x", {
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

  it("est idempotent : ré-exécution ne crée ni ne modifie rien (tout aligné)", async () => {
    const { db, updates } = makeFakeDb({
      existingFormationSlugs: FORMATIONS_V2.map((f) => f.slugFr),
    });
    const report = await importCatalogFormations(db, { now: FIXED_NOW });
    expect(report.created).toBe(0);
    expect(report.skippedExistantes).toBe(FORMATIONS_V2.length);
    expect(report.synced).toBe(0);
    expect(report.drifted).toBe(0);
    expect(report.items.every((i) => i.status === "unchanged")).toBe(true);
    expect(updates).toHaveLength(0); // aucune écriture parasite
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

  it("auto-synchronise un champ que le catalogue a changé et que l'admin n'a pas touché", async () => {
    const slug = FORMATIONS_V2[0]!.slugFr;
    // Ligne existante = catalogue, MAIS titre DB == ancien titre == snapshot
    // (admin non touché) → catalogue actuel ≠ DB → synchro sûre.
    const row = rowFromCatalog(slug);
    row.titre = "Ancien titre catalogue";
    (row.catalogSnapshot as CatalogSnapshot).titre = "Ancien titre catalogue";

    const { db, updates } = makeFakeDb({ existingRows: [row] });
    const report = await importCatalogFormations(db, { now: FIXED_NOW });

    expect(report.synced).toBe(1);
    expect(report.drifted).toBe(0);
    const item = report.items.find((i) => i.slug === slug);
    expect(item?.status).toBe("synced");
    expect(item?.syncedFields).toContain("titre");
    const write = updates.find((u) => u.id === row.id)!;
    expect(write.data.titre).toBe(FORMATIONS_V2[0]!.titreFr);
    expect(write.data.catalogSyncedAt).toBe(FIXED_NOW);
    expect(write.data.catalogDriftAt).toBeNull();
  });

  it("préserve l'édition admin et reporte un écart quand catalogue ET admin ont divergé", async () => {
    const slug = FORMATIONS_V2[0]!.slugFr;
    const row = rowFromCatalog(slug);
    // Admin a réécrit le titre (DB ≠ snapshot) ET le catalogue a bougé depuis
    // (snapshot ≠ catalogue actuel) → conflit.
    row.titre = "Titre édité par l'admin";
    (row.catalogSnapshot as CatalogSnapshot).titre = "Titre catalogue d'origine";

    const { db, updates } = makeFakeDb({ existingRows: [row] });
    const report = await importCatalogFormations(db, { now: FIXED_NOW });

    expect(report.drifted).toBe(1);
    expect(report.synced).toBe(0);
    const item = report.items.find((i) => i.slug === slug);
    expect(item?.status).toBe("drifted");
    expect(item?.driftFields).toContain("titre");
    // L'admin est préservé : aucune écriture du champ titre.
    const write = updates.find((u) => u.id === row.id)!;
    expect(write.data.titre).toBeUndefined();
    expect(write.data.catalogDriftAt).toBe(FIXED_NOW);
  });

  it("backfille la baseline d'une ligne legacy (snapshot null) sans drift quand elle est alignée", async () => {
    const slug = FORMATIONS_V2[0]!.slugFr;
    const row = rowFromCatalog(slug);
    row.catalogSnapshot = null; // ligne créée avant WS2

    const { db, updates } = makeFakeDb({ existingRows: [row] });
    const report = await importCatalogFormations(db, { now: FIXED_NOW });

    expect(report.skippedExistantes).toBe(1);
    expect(report.drifted).toBe(0);
    const write = updates.find((u) => u.id === row.id)!;
    expect(write.data.catalogSnapshot).toBeDefined();
    expect(write.data.catalogSyncedAt).toBe(FIXED_NOW);
  });

  it("legacy (snapshot null) divergente → drift sans écraser (pas de baseline pour trancher)", async () => {
    const slug = FORMATIONS_V2[0]!.slugFr;
    const row = rowFromCatalog(slug);
    row.titre = "Valeur DB divergente";
    row.catalogSnapshot = null;

    const { db, updates } = makeFakeDb({ existingRows: [row] });
    const report = await importCatalogFormations(db, { now: FIXED_NOW });

    expect(report.drifted).toBe(1);
    const item = report.items.find((i) => i.slug === slug);
    expect(item?.driftFields).toContain("titre");
    const write = updates.find((u) => u.id === row.id)!;
    expect(write.data.titre).toBeUndefined();
  });

  it("NE synchronise PAS une formation à session verrouillante → drift (garde WS4)", async () => {
    const slug = FORMATIONS_V2[0]!.slugFr;
    // Catalogue a changé, DB == snapshot (sync sûre EN TEMPS NORMAL)…
    const row = rowFromCatalog(slug);
    row.titre = "Ancien titre catalogue";
    (row.catalogSnapshot as CatalogSnapshot).titre = "Ancien titre catalogue";

    // …mais une session est en cours/réalisée → contenu figé, pas de réécriture.
    const { db, updates } = makeFakeDb({
      existingRows: [row],
      lockingSessionsByFormationId: { [row.id]: 1 },
    });
    const report = await importCatalogFormations(db, { now: FIXED_NOW });

    expect(report.synced).toBe(0);
    expect(report.drifted).toBe(1);
    const item = report.items.find((i) => i.slug === slug);
    expect(item?.status).toBe("drifted");
    expect(item?.driftFields).toContain("titre");
    // Le titre DB est PRÉSERVÉ (aucune écriture du champ).
    const write = updates.find((u) => u.id === row.id);
    expect(write?.data.titre).toBeUndefined();
  });

  it("no-op sous l'URL stub (build/SSG) — aucune mutation", async () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const { db, createdRows, updates } = makeFakeDb();
      const report = await importCatalogFormations(db, { now: FIXED_NOW });
      expect(report.created).toBe(0);
      expect(report.items).toHaveLength(0);
      expect(createdRows).toHaveLength(0);
      expect(updates).toHaveLength(0);
    } finally {
      if (prev === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prev;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reconcileFormationFields (merge 3-way pur)
// ─────────────────────────────────────────────────────────────────────────────

describe("reconcileFormationFields", () => {
  const base = (): CatalogSnapshot => ({
    titre: "T",
    objectifsPedagogiques: [{ id: "obj-1", verbe: "Produire", description: "Produire X" }],
    programmeDetaille: [],
    methodesPedagogiques: "M",
    ratioPratiquePct: 70,
    accessibleHandicap: true,
    certificationType: "aucune",
  });

  it("DB == catalogue → ni update ni drift, baseline = catalogue", () => {
    const desired = base();
    const r = reconcileFormationFields(desired, { ...desired }, null);
    expect(r.syncedFields).toHaveLength(0);
    expect(r.driftFields).toHaveLength(0);
    expect(r.updates).toEqual({});
    expect(r.nextSnapshot.titre).toBe("T");
  });

  it("catalogue a bougé, DB == snapshot → synchro", () => {
    const desired = { ...base(), titre: "Nouveau" };
    const db = base(); // titre = "T"
    const snapshot = base(); // titre = "T" == DB
    const r = reconcileFormationFields(desired, db, snapshot);
    expect(r.syncedFields).toEqual(["titre"]);
    expect(r.updates.titre).toBe("Nouveau");
    expect(r.driftFields).toHaveLength(0);
  });

  it("catalogue a bougé, DB ≠ snapshot → conflit (drift, pas d'update)", () => {
    const desired = { ...base(), titre: "Catalogue v2" };
    const db = { ...base(), titre: "Edité admin" };
    const snapshot = base(); // "T"
    const r = reconcileFormationFields(desired, db, snapshot);
    expect(r.driftFields).toEqual(["titre"]);
    expect(r.updates).toEqual({});
    expect(r.nextSnapshot.titre).toBe("T"); // baseline NON adoptée sur le conflit
  });

  it("pas de baseline + divergence → drift sans update", () => {
    const desired = { ...base(), titre: "Catalogue" };
    const db = { ...base(), titre: "DB" };
    const r = reconcileFormationFields(desired, db, null);
    expect(r.driftFields).toEqual(["titre"]);
    expect(r.updates).toEqual({});
  });

  it("compare les Json structurellement (ordre de clés indifférent)", () => {
    const desired = base();
    const dbReordered: CatalogSnapshot = {
      ...desired,
      objectifsPedagogiques: [{ description: "Produire X", verbe: "Produire", id: "obj-1" }],
    };
    const r = reconcileFormationFields(desired, dbReordered, null);
    expect(r.driftFields).toHaveLength(0);
    expect(r.syncedFields).toHaveLength(0);
  });
});
