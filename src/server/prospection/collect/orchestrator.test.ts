import { describe, it, expect } from "vitest";
import { orchestrateCampaign, type OrchestratorDb } from "./orchestrator";
import type { StockRefRow } from "./campaign-expansion";

const REFS: StockRefRow[] = [
  { departement: "38", naf: "41.20A", taille: "PME", stockAttendu: 12 },
  { departement: "38", naf: "43.99Z", taille: "PME", stockAttendu: 5 },
  { departement: "38", naf: "86.10Z", taille: "PME", stockAttendu: 8 }, // hors BTP
];

// Simule des cellules avec statut préexistant : 41.20A déjà `fait`.
function makeDb(statutBySiretKey: Record<string, string>): {
  db: OrchestratorDb;
  enqueued: string[];
  campaignUpdated: { cellulesTotal?: number };
} {
  const enqueued: string[] = [];
  const campaignUpdated: { cellulesTotal?: number } = {};
  let idc = 0;
  const db = {
    prospectionStockReference: {
      async findMany() {
        return REFS;
      },
    },
    prospectionCoverageCell: {
      async upsert(a: { create: { naf: string } }) {
        idc++;
        const naf = a.create.naf;
        return { id: `cell-${idc}`, statut: statutBySiretKey[naf] ?? "a_faire" };
      },
    },
    prospectionCampaign: {
      async update(a: { data: { cellulesTotal?: number } }) {
        if (a.data.cellulesTotal !== undefined)
          campaignUpdated.cellulesTotal = a.data.cellulesTotal;
        return {};
      },
    },
  } as unknown as OrchestratorDb;
  return { db, enqueued, campaignUpdated };
}

describe("orchestrateCampaign", () => {
  it("détend en cellules (BTP dép 38 PME) et n'enfile que a_faire/erreur", async () => {
    const { db, enqueued, campaignUpdated } = makeDb({ "41.20A": "fait" }); // 41.20A déjà fait
    let runN = 0;
    const r = await orchestrateCampaign(
      db,
      { id: "camp-1", departements: ["38"], secteurs: ["btp"], nafCodes: [], tailles: ["PME"] },
      {
        enqueueCollect: async (cellId) => {
          enqueued.push(cellId);
        },
        genRunId: () => `run-${++runN}`,
      },
    );
    // 2 cellules BTP (41.20A, 43.99Z) — 86.10Z exclu (hors secteur)
    expect(r.cellsTotal).toBe(2);
    expect(campaignUpdated.cellulesTotal).toBe(2);
    // 41.20A est `fait` → non enfilé ; seul 43.99Z (a_faire) enfilé
    expect(r.cellsEnqueued).toBe(1);
    expect(enqueued).toHaveLength(1);
  });

  it("respecte le quota (arrête d'enfiler au-delà)", async () => {
    const { db, enqueued } = makeDb({}); // toutes a_faire
    const r = await orchestrateCampaign(
      db,
      { id: "camp-2", departements: ["38"], secteurs: ["btp"], nafCodes: [], tailles: ["PME"] },
      {
        enqueueCollect: async (cellId) => {
          enqueued.push(cellId);
        },
        genRunId: () => "run",
        quotaMax: 10, // 41.20A=12 attendu > 10 → une seule cellule enfilée puis stop
      },
    );
    expect(r.cellsEnqueued).toBe(1);
  });
});
