// @vitest-environment node

/**
 * LES DÉPENDANCES RÉELLES DU DÉPÔT PUBLIC (relecture sécurité, 2026-10-08, L5b).
 *
 *  - le limiteur REFUSE en cas de panne de Redis : sur une route publique qui
 *    ouvre des envois vers le stockage, laisser passer transformerait une panne
 *    en porte ouverte (`surPanne: "refuser"`) ;
 *  - le plafond de fichiers par lien se compte SOUS un verrou consultatif
 *    Postgres propre au lien (`pg_advisory_xact_lock`), dans une transaction :
 *    deux envois simultanés ne peuvent pas passer tous les deux.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  checkRateLimit: vi.fn(async (_cle: string, _o: Record<string, unknown>) => ({ allowed: true })),
  sql: [] as string[],
  options: null as unknown,
  ordre: [] as string[],
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (cle: string, o: Record<string, unknown>) => d.checkRateLimit(cle, o),
}));
vi.mock("@/lib/prisma", () => {
  const tx = {
    $executeRaw: async (morceaux: TemplateStringsArray, ...valeurs: unknown[]) => {
      d.ordre.push("verrou");
      d.sql.push(morceaux.join("?") + " | " + valeurs.join(","));
      return 1;
    },
    fichierPartage: {
      count: async () => {
        d.ordre.push("count");
        return 0;
      },
    },
  };
  return {
    prisma: {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>, options: unknown) => {
        d.options = options;
        d.ordre.push("debut");
        const r = await fn(tx);
        d.ordre.push("fin");
        return r;
      },
    },
  };
});
vi.mock("../depot", () => ({
  commencerDepotPersonne: vi.fn(),
  signerMorceaux: vi.fn(),
  reprendreDepot: vi.fn(),
  terminerDepot: vi.fn(),
}));

import { depsDepotParDefaut } from "../depot-public";

const LIEN = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  d.sql = [];
  d.ordre = [];
});

describe("les dépendances réelles du dépôt public", () => {
  it("le limiteur refuse en cas de panne de Redis", async () => {
    const deps = await depsDepotParDefaut();
    await deps.limiter(`partages:depot:${LIEN}`);
    expect(d.checkRateLimit).toHaveBeenCalledWith(
      `partages:depot:${LIEN}`,
      expect.objectContaining({ surPanne: "refuser" }),
    );
  });

  it("le compte se fait sous un verrou consultatif propre au lien, dans une transaction", async () => {
    const deps = await depsDepotParDefaut();
    const n = await deps.sousVerrouLien(LIEN, async (db) => {
      const c = await db.fichierPartage.count({ where: { lienDepotId: LIEN } });
      d.ordre.push("commencer");
      return c;
    });
    expect(n).toBe(0);
    expect(d.ordre).toEqual(["debut", "verrou", "count", "commencer", "fin"]);
    expect(d.sql).toHaveLength(1);
    expect(d.sql[0]).toMatch(/pg_advisory_xact_lock\(hashtext\(/);
    expect(d.sql[0]).toContain(`partages:depot:${LIEN}`);
    // Le verrou couvre l'ouverture de l'envoi (appel au stockage) : délai élargi.
    expect(d.options).toMatchObject({ timeout: expect.any(Number) });
  });
});
