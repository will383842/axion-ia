import { describe, it, expect } from "vitest";
import { collectCell, prospectableWhere, type CollectDb, type CellToCollect } from "./collect-cell";

interface Recorder {
  runsCreated: number;
  runsUpdated: number;
  cellUpdates: Array<{ collecte: number; statut: string }>;
  countCalls: number;
}

function makeDb(companyCount: number, pendingIds: string[]): { db: CollectDb; rec: Recorder } {
  const rec: Recorder = { runsCreated: 0, runsUpdated: 0, cellUpdates: [], countCalls: 0 };
  const db = {
    prospectionCompany: {
      async count() {
        rec.countCalls++;
        return companyCount;
      },
      async findMany() {
        return pendingIds.map((id) => ({ id }));
      },
    },
    prospectionCollectRun: {
      async create() {
        rec.runsCreated++;
        return { id: `run-${rec.runsCreated}` };
      },
      async update() {
        rec.runsUpdated++;
        return {};
      },
    },
    prospectionCoverageCell: {
      async update(a: { data: { collecte: number; statut: string } }) {
        rec.cellUpdates.push({ collecte: a.data.collecte, statut: a.data.statut });
        return {};
      },
    },
  } as unknown as CollectDb;
  return { db, rec };
}

const CELL: CellToCollect = {
  id: "cell-1",
  departement: "38",
  naf: "41.20A",
  taille: "PME",
  attendu: 12,
};

describe("prospectableWhere — RGPD (opt-out + non-diffusible exclus)", () => {
  it("filtre diffusible/actif/non-opt-out", () => {
    expect(prospectableWhere(CELL)).toMatchObject({
      statutDiffusion: "diffusible",
      etatAdministratif: "actif",
      optOut: false,
    });
  });
});

describe("collectCell", () => {
  it("collecte ≥ attendu → fait + CollectRun + cell mise à jour", async () => {
    const { db, rec } = makeDb(12, []);
    const r = await collectCell(db, CELL, { enrichirContacts: false });
    expect(r.collecte).toBe(12);
    expect(r.statut).toBe("fait");
    expect(rec.runsCreated).toBe(1);
    expect(rec.runsUpdated).toBe(1);
    expect(rec.cellUpdates[0]).toEqual({ collecte: 12, statut: "fait" });
  });

  it("collecte < attendu → erreur (exhaustivité)", async () => {
    const { db } = makeDb(9, []);
    const r = await collectCell(db, CELL, { enrichirContacts: false });
    expect(r.statut).toBe("erreur");
  });

  it("enfile l'enrichissement des entreprises pending si enrichirContacts", async () => {
    const { db } = makeDb(12, ["a", "b", "c"]);
    const enqueued: string[] = [];
    const r = await collectCell(db, CELL, {
      enrichirContacts: true,
      enqueueEnrich: async (id) => {
        enqueued.push(id);
      },
    });
    expect(r.enrichEnqueued).toBe(3);
    expect(enqueued).toEqual(["a", "b", "c"]);
  });

  it("idempotent : recompter ne crée AUCUNE entreprise (anti-doublon #6)", async () => {
    const { db, rec } = makeDb(12, []);
    await collectCell(db, CELL, { enrichirContacts: false });
    await collectCell(db, CELL, { enrichirContacts: false });
    // count appelé 2×, mais aucune création d'entreprise (collect ne fait que compter)
    expect(rec.countCalls).toBe(2);
    expect(rec.cellUpdates.every((u) => u.collecte === 12)).toBe(true);
  });
});
