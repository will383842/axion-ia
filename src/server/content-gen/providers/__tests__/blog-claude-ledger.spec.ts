/**
 * Registre de coût du blog : minuit de Paris (changements d'heure), réservation
 * sous verrou, plafonds, réserve Qualiopi, solde idempotent. Chiffres FICTIFS.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Etat {
  lignes: Array<{ id: string; costUsd: number; tokensInput: number; tokensOutput: number }>;
  compteur: number;
  verrous: number;
  totaux: number[];
  echecBase: boolean;
  jobExiste: boolean;
  ordre: string[];
  sqls: string[];
  options: unknown[];
}
const etat: Etat = {
  lignes: [],
  compteur: 0,
  verrous: 0,
  totaux: [],
  echecBase: false,
  jobExiste: true,
  ordre: [],
  sqls: [],
  options: [],
};

vi.mock("@/lib/prisma", () => {
  const tx = {
    $executeRaw: vi.fn(async () => {
      etat.verrous += 1;
      return 1;
    }),
    $queryRaw: vi.fn(async (q: { sql: string }) => {
      etat.sqls.push(q.sql);
      if (q.sql.includes("SELECT 1 FROM content_gen_jobs")) {
        etat.ordre.push("job");
        return etat.jobExiste ? [{ "?column?": 1 }] : [];
      }
      etat.ordre.push("cumul");
      return [{ total: etat.totaux.shift() ?? 0 }];
    }),
    costLedger: {
      create: vi.fn(async ({ data }: { data: { costUsd: number } }) => {
        etat.ordre.push("insertion");
        const id = `L${etat.lignes.length + 1}`;
        etat.lignes.push({ id, costUsd: data.costUsd, tokensInput: 0, tokensOutput: 0 });
        return { id };
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const l = etat.lignes.find((x) => x.id === where.id);
        return l ? { costUsd: l.costUsd } : null;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, number> }) => {
          const l = etat.lignes.find((x) => x.id === where.id)!;
          if (data["costUsd"] !== undefined) l.costUsd = data["costUsd"];
        },
      ),
    },
    providerConfig: {
      findUnique: vi.fn(async () => ({ currentMonthSpentUsd: etat.compteur })),
      update: vi.fn(async ({ data }: { data: { currentMonthSpentUsd: { increment: number } } }) => {
        etat.compteur += data.currentMonthSpentUsd.increment;
      }),
    },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>, opts?: unknown) => {
        etat.options.push(opts);
        if (etat.echecBase) throw new Error("base KO");
        const copie = JSON.stringify({ l: etat.lignes, c: etat.compteur });
        try {
          return await fn(tx);
        } catch (e) {
          const o = JSON.parse(copie) as { l: Etat["lignes"]; c: number };
          etat.lignes = o.l;
          etat.compteur = o.c;
          throw e;
        }
      }),
    },
  };
});

import {
  BlogClaudeRefusError,
  debutMoisParis,
  jourParis,
  minuitParis,
  reserverCout,
  solderReservation,
  auCentimeSuperieur,
  TRANSACTION_MAX_WAIT_MS,
  TRANSACTION_TIMEOUT_MS,
} from "../blog-claude-ledger";

const base = {
  jobId: "job1",
  model: "claude-sonnet-5-5",
  tokensInputEstimes: 1000,
  coutMaxUsd: 0.05,
  plafondJourUsd: 2,
  plafondMoisBlogUsd: 10,
  plafondMoisGlobalUsd: 100,
  reserveQualiopiUsd: 5,
};

beforeEach(() => {
  etat.lignes = [];
  etat.compteur = 10;
  etat.verrous = 0;
  etat.totaux = [];
  etat.echecBase = false;
  etat.jobExiste = true;
  etat.ordre = [];
  etat.sqls = [];
  etat.options = [];
});

describe("minuit de Paris", () => {
  const iso = (d: Date) => d.toISOString();
  it("changement d'heure de printemps (2026-03-29) : 22:30 et 23:30 UTC", () => {
    // Le 29 mars à 22:30 UTC il est 00:30 le 30 (UTC+2) : minuit = 29 mars 22:00 UTC.
    expect(iso(minuitParis(new Date("2026-03-29T22:30:00Z")))).toBe("2026-03-29T22:00:00.000Z");
    expect(iso(minuitParis(new Date("2026-03-29T23:30:00Z")))).toBe("2026-03-29T22:00:00.000Z");
    // La veille (UTC+1) : 22:30 UTC = 23:30 Paris le 28 → minuit = 27 mars 23:00 UTC.
    expect(iso(minuitParis(new Date("2026-03-28T22:30:00Z")))).toBe("2026-03-27T23:00:00.000Z");
    expect(iso(minuitParis(new Date("2026-03-28T23:30:00Z")))).toBe("2026-03-28T23:00:00.000Z");
  });
  it("changement d'heure d'automne (2026-10-25) : 22:30 et 23:30 UTC", () => {
    expect(iso(minuitParis(new Date("2026-10-24T22:30:00Z")))).toBe("2026-10-24T22:00:00.000Z");
    // 25 oct 22:30 UTC = 23:30 Paris (UTC+1) → minuit du 25 = 24 oct 22:00 UTC.
    expect(iso(minuitParis(new Date("2026-10-25T22:30:00Z")))).toBe("2026-10-24T22:00:00.000Z");
    // 25 oct 23:30 UTC = 00:30 le 26 (UTC+1) → minuit = 25 oct 23:00 UTC.
    expect(iso(minuitParis(new Date("2026-10-25T23:30:00Z")))).toBe("2026-10-25T23:00:00.000Z");
  });
  it("début de mois et jour de Paris", () => {
    expect(iso(debutMoisParis(new Date("2026-03-31T23:30:00Z")))).toBe("2026-03-31T22:00:00.000Z");
    expect(jourParis(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
  });
});

describe("reserverCout", () => {
  it("pose UNE ligne et avance le compteur, sous verrou", async () => {
    etat.totaux = [0.5, 3];
    const r = await reserverCout(base);
    expect(r.id).toBe("L1");
    expect(etat.lignes).toHaveLength(1);
    expect(etat.compteur).toBeCloseTo(10.05);
    expect(etat.verrous).toBe(1);
  });
  it("dépassement du jour = refus et transaction annulée (aucune ligne)", async () => {
    etat.totaux = [2.01, 3];
    await expect(reserverCout(base)).rejects.toMatchObject({ code: "plafond_jour" });
    expect(etat.lignes).toHaveLength(0);
    expect(etat.compteur).toBe(10);
  });
  it("dépassement du mois du blog = refus", async () => {
    etat.totaux = [0.5, 10.5];
    await expect(reserverCout(base)).rejects.toMatchObject({ code: "plafond_mois" });
    expect(etat.lignes).toHaveLength(0);
  });
  it("réserve Qualiopi entamée = refus", async () => {
    etat.totaux = [0.1, 0.1];
    etat.compteur = 95; // 95 + 0,05 + 0,15 > 100 − 5
    await expect(reserverCout(base)).rejects.toMatchObject({ code: "reserve_qualiopi" });
    expect(etat.lignes).toHaveLength(0);
  });
  it("job inconnu ou d'un autre type = refus, aucune ligne écrite", async () => {
    etat.jobExiste = false;
    await expect(reserverCout(base)).rejects.toMatchObject({ code: "config_invalide" });
    expect(etat.lignes).toHaveLength(0);
    expect(etat.compteur).toBe(10);
    expect(etat.sqls[0]).toContain("content_gen_jobs");
    expect(etat.sqls[0]).toContain('"contentType"');
  });
  it("SQL des cumuls : fournisseur anthropic et filtre sur les types du blog ; ordre insertion → cumuls", async () => {
    etat.totaux = [0.5, 3];
    await reserverCout(base);
    const cumuls = etat.sqls.filter((q) => q.includes("SUM("));
    expect(cumuls).toHaveLength(2);
    for (const q of cumuls) {
      expect(q).toContain("provider::text = 'anthropic'");
      expect(q).toContain('"contentType"::text IN');
    }
    expect(etat.ordre).toEqual(["job", "insertion", "cumul", "cumul"]);
  });
  it("la réservation est arrondie au centime supérieur", async () => {
    expect(auCentimeSuperieur(0.0412)).toBe(0.05);
    expect(auCentimeSuperieur(0.05)).toBe(0.05);
    etat.totaux = [0.1, 0.1];
    await reserverCout({ ...base, coutMaxUsd: 0.0412 });
    expect(etat.lignes[0]!.costUsd).toBe(0.05);
    expect(etat.compteur).toBeCloseTo(10.05);
  });
  it("transaction aux délais explicites", async () => {
    etat.totaux = [0.1, 0.1];
    await reserverCout(base);
    expect(etat.options[0]).toEqual({
      maxWait: TRANSACTION_MAX_WAIT_MS,
      timeout: TRANSACTION_TIMEOUT_MS,
    });
  });
  it("base en erreur = refus (UnrecoverableError)", async () => {
    etat.echecBase = true;
    const err = await reserverCout(base).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BlogClaudeRefusError);
    expect((err as BlogClaudeRefusError).code).toBe("base_indisponible");
    expect((err as Error).name).toBe("BlogClaudeRefusError");
  });
});

describe("solderReservation", () => {
  it("corrige la ligne et le compteur de l'écart, sans doublon", async () => {
    etat.totaux = [0.1, 0.1];
    const r = await reserverCout(base);
    await solderReservation(r.id, 0.02);
    expect(etat.lignes).toHaveLength(1);
    expect(etat.lignes[0]!.costUsd).toBe(0.02);
    expect(etat.compteur).toBeCloseTo(10.02);
    await solderReservation(r.id, 0.02); // idempotent
    expect(etat.compteur).toBeCloseTo(10.02);
  });
  it("l'écart du compteur se calcule sur des valeurs arrondies au centime", async () => {
    etat.totaux = [0.1, 0.1];
    const r = await reserverCout({ ...base, coutMaxUsd: 0.2 }); // 0,20
    await solderReservation(r.id, 0.0412); // → 0,05 : écart −0,15
    expect(etat.compteur).toBeCloseTo(10.05);
    await solderReservation(r.id, 0.0412);
    expect(etat.compteur).toBeCloseTo(10.05);
  });
  it("ligne absente : journalisé, rien ne bouge", async () => {
    const w = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await solderReservation("inconnue", 0.01);
    expect(w).toHaveBeenCalled();
    expect(etat.compteur).toBe(10);
  });
  it("base en erreur au solde : ne lève pas, la réservation maximale reste", async () => {
    etat.totaux = [0.1, 0.1];
    const r = await reserverCout(base);
    etat.echecBase = true;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(solderReservation(r.id, 0.01)).resolves.toBeUndefined();
    expect(etat.lignes[0]!.costUsd).toBe(0.05);
  });
});
