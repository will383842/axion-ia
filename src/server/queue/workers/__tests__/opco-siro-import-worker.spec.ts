/**
 * INT-T60-A — le passage mensuel de l'import SIRO.
 *
 * Réseau et base INJECTÉS : aucun appel réseau. Fichier SYNTHÉTIQUE au format
 * réel (IDCC 1000+, libellés réels de la SIRO) : ne rien en déduire sur le
 * rattachement réel d'une convention.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CONFIG_FICHIER_SIRO,
  SIRO_DATASET_API,
  type BaseIdccOpco,
  type TxIdccOpco,
} from "@/server/qualiopi/financements/idcc-import";
import {
  estTableAbsente,
  executerImportSiro,
  importSiroActif,
  OPCO_SIRO_IMPORT_QUEUE_NAME,
} from "../opco-siro-import-worker";

const URL_SIRO =
  "https://static.data.gouv.fr/resources/table-siret-opco/20260924-155236/siro-202606.csv";
const ACTIF = { IDCC_OPCO_IMPORT_ENABLED: "true", NODE_ENV: "test" } as NodeJS.ProcessEnv;

function fichier(n: number): string {
  const libelles = Object.keys(CONFIG_FICHIER_SIRO.libellesOpco);
  const lignes = ["SIRET|IDCC|OPCO_PROPRIETAIRE|OPCO_GESTION"];
  for (let i = 0; i < n; i++) {
    const idcc = String(1000 + Math.floor(i / libelles.length));
    lignes.push(`${90_000_000_000_000 + i}|${idcc}|${libelles[i % libelles.length]}|`);
  }
  return lignes.join("\n");
}

function reseau(texte: string, statut = 200) {
  const appels: string[] = [];
  const fetch = async (url: string, _init: { signal: AbortSignal }) => {
    appels.push(url);
    if (url === SIRO_DATASET_API) {
      return new Response(
        JSON.stringify({ resources: [{ format: "csv", title: "siro-202606.csv", url: URL_SIRO }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(texte, { status: statut, headers: { "content-type": "text/csv" } });
  };
  return { fetch, appels };
}

/** Base minimale : compte les lignes écrites ; `panne` simule une erreur Prisma. */
function base(panne?: unknown) {
  const etat = { lignes: 0 };
  const db: BaseIdccOpco = {
    async $transaction(fn) {
      if (panne) throw panne;
      const tx: TxIdccOpco = {
        idccOpco: {
          findMany: async () => [],
          deleteMany: async () => ({ count: 0 }),
          createMany: async ({ data }) => {
            etat.lignes += data.length;
            return { count: data.length };
          },
        },
        idccOpcoChangement: { createMany: async ({ data }) => ({ count: data.length }) },
      };
      return fn(tx);
    },
  };
  return { db, etat };
}

afterEach(() => vi.restoreAllMocks());

describe("importSiroActif — l'interrupteur IDCC_OPCO_IMPORT_ENABLED", () => {
  it("actif par défaut en production, coupé par « false »", () => {
    expect(importSiroActif({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(true);
    expect(
      importSiroActif({
        NODE_ENV: "production",
        IDCC_OPCO_IMPORT_ENABLED: "false",
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it("coupé en test sauf « true » explicite", () => {
    expect(importSiroActif({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe(false);
    expect(importSiroActif(ACTIF)).toBe(true);
  });

  it("est déclaré dans env.ts", () => {
    const env = readFileSync(join(process.cwd(), "src/env.ts"), "utf8");
    expect(env).toContain(`IDCC_OPCO_IMPORT_ENABLED: z.enum(["true", "false"]).optional()`);
    expect(env).toContain("IDCC_OPCO_IMPORT_ENABLED: process.env.IDCC_OPCO_IMPORT_ENABLED");
  });
});

describe("executerImportSiro — le passage mensuel", () => {
  it("drapeau coupé : rien n'est téléchargé", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { fetch, appels } = reseau(fichier(1_100));
    const r = await executerImportSiro({
      db: base().db,
      fetch,
      tableDisponible: async () => true,
      env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
    });
    expect(r).toEqual({ statut: "coupe" });
    expect(appels).toEqual([]);
  });

  it("table absente (le worker précède la migration) : log, sortie propre, AUCUN téléchargement", async () => {
    const avert = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { fetch, appels } = reseau(fichier(1_100));
    const r = await executerImportSiro({
      db: base().db,
      fetch,
      tableDisponible: async () => false,
      env: ACTIF,
    });
    expect(r).toEqual({ statut: "table_absente" });
    expect(appels).toEqual([]);
    expect(avert.mock.calls[0]?.[0]).toMatch(/table idcc_opco absente/);
  });

  it("table disparue en cours de route (P2021) : sortie propre, pas d'exception", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const p2021 = Object.assign(new Error("The table `public.idcc_opco` does not exist"), {
      code: "P2021",
    });
    const r = await executerImportSiro({
      db: base(p2021).db,
      fetch: reseau(fichier(1_100)).fetch,
      tableDisponible: async () => true,
      env: ACTIF,
    });
    expect(r).toEqual({ statut: "table_absente" });
  });

  it("importe et journalise le résultat, URL de la ressource comprise", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { db, etat } = base();
    const { fetch, appels } = reseau(fichier(1_100));
    const r = await executerImportSiro({
      db,
      fetch,
      tableDisponible: async () => true,
      env: ACTIF,
    });
    expect(r).toMatchObject({ statut: "importe", changements: 0 });
    expect(appels).toEqual([SIRO_DATASET_API, URL_SIRO]);
    expect(etat.lignes).toBeGreaterThanOrEqual(1_000);
    expect(log.mock.calls[0]?.[0]).toContain(URL_SIRO);
    expect(log.mock.calls[0]?.[0]).toContain("premier import");
  });

  it("fichier refusé (HTTP 500, tronqué) : log clair, table intacte, pas d'exception", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const [texte, statut, motif] of [
      ["", 500, /HTTP 500/],
      [fichier(30), 200, /plancher/],
    ] as const) {
      const { db, etat } = base();
      const r = await executerImportSiro({
        db,
        fetch: reseau(texte, statut).fetch,
        tableDisponible: async () => true,
        env: ACTIF,
      });
      expect(r).toMatchObject({ statut: "refuse", motif: expect.stringMatching(motif) });
      expect(etat.lignes).toBe(0);
    }
    expect(err.mock.calls.every((c) => /table intacte/.test(String(c[0])))).toBe(true);
  });

  it("une erreur inattendue remonte au job (échec visible), sans être maquillée en refus", async () => {
    await expect(
      executerImportSiro({
        db: base(new Error("connexion perdue")).db,
        fetch: reseau(fichier(1_100)).fetch,
        tableDisponible: async () => true,
        env: ACTIF,
      }),
    ).rejects.toThrow("connexion perdue");
  });
});

describe("estTableAbsente", () => {
  it("reconnaît P2021, 42P01 et le message Postgres, pas le reste", () => {
    expect(estTableAbsente({ code: "P2021" })).toBe(true);
    expect(estTableAbsente({ code: "42P01" })).toBe(true);
    expect(estTableAbsente(new Error('relation "idcc_opco" does not exist'))).toBe(true);
    expect(estTableAbsente(new Error('relation "idcc_opco_changements" does not exist'))).toBe(
      true,
    );
    expect(estTableAbsente(new Error("connexion perdue"))).toBe(false);
    expect(estTableAbsente(null)).toBe(false);
  });
});

describe("branchement de la file", () => {
  const racine = process.cwd();
  const lire = (f: string) => readFileSync(join(racine, f), "utf8");

  it("file `opco-siro-import`, le 20 du mois à 06:00 À PARIS, inscrite dans queues.ts, types.ts et worker.ts", () => {
    expect(OPCO_SIRO_IMPORT_QUEUE_NAME).toBe("opco-siro-import");
    const queues = lire("src/server/queue/queues.ts");
    expect(queues).toContain(`new Queue<OpcoSiroImportJobData>("opco-siro-import"`);
    expect(queues).toContain(`export const PATTERN_IMPORT_SIRO = "0 6 20 * *";`);
    expect(queues).toContain(`export const FUSEAU_IMPORT_SIRO = "Europe/Paris";`);
    expect(queues).toContain("repeat: { pattern: PATTERN_IMPORT_SIRO, tz: FUSEAU_IMPORT_SIRO }");
    expect(lire("src/server/queue/types.ts")).toContain("export interface OpcoSiroImportJobData");
    expect(lire("src/server/queue/worker.ts")).toContain("startOpcoSiroImportWorker(),");
  });
});
