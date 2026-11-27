/**
 * Porte de coût et appels du pilotage (P0) : la réservation passe avec un job porteur et est
 * refusée sans lui ; le cumul commun reste appliqué ; les sous-plafonds (jour, mois) refusent ;
 * le modèle est Sonnet 5.5 ou Opus 5.5. Chiffres FICTIFS, aucun appel réseau.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Etat {
  jobExiste: boolean;
  origine: string | null;
  cumulCommun: number[];
  cumulPilotage: number[];
  config: Record<string, unknown>;
  configEnErreur: boolean;
  lignes: number;
  sqls: string[];
}
const etat: Etat = {
  jobExiste: true,
  origine: "pilotage",
  cumulCommun: [],
  cumulPilotage: [],
  config: {},
  configEnErreur: false,
  lignes: 0,
  sqls: [],
};

vi.mock("@/lib/prisma", () => {
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async (q: { sql: string }) => {
      etat.sqls.push(q.sql);
      if (q.sql.includes("FROM content_gen_jobs WHERE id")) {
        return etat.jobExiste ? [{ plafondJobUsd: null, origine: etat.origine }] : [];
      }
      if (q.sql.includes("'origine'")) return [{ total: etat.cumulPilotage.shift() ?? 0 }];
      return [{ total: etat.cumulCommun.shift() ?? 0 }];
    }),
    contentGenConfig: {
      findMany: vi.fn(async () => {
        if (etat.configEnErreur) throw new Error("config KO");
        return Object.entries(etat.config).map(([key, value]) => ({ key, value }));
      }),
    },
    costLedger: {
      create: vi.fn(async () => {
        etat.lignes += 1;
        return { id: `L${etat.lignes}` };
      }),
    },
    providerConfig: {
      findUnique: vi.fn(async () => ({ currentMonthSpentUsd: 0 })),
      update: vi.fn(async () => undefined),
    },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
});

import { BlogClaudeRefusError, reserverCout } from "../blog-claude-ledger";

const base = {
  jobId: "porteur1",
  model: "claude-sonnet-5-5",
  tokensInputEstimes: 1000,
  coutMaxUsd: 0.25,
  plafondJourUsd: 10,
  plafondMoisBlogUsd: 200,
  plafondMoisGlobalUsd: 500,
  reserveQualiopiUsd: 5,
};

beforeEach(() => {
  etat.jobExiste = true;
  etat.origine = "pilotage";
  etat.cumulCommun = [];
  etat.cumulPilotage = [];
  etat.config = {};
  etat.configEnErreur = false;
  etat.lignes = 0;
  etat.sqls = [];
});

describe("réservation avec job porteur", () => {
  it("passe avec le porteur (sous-plafonds par défaut 2 $ / 30 $)", async () => {
    etat.cumulCommun = [1, 5];
    etat.cumulPilotage = [0.5, 3];
    await expect(reserverCout(base)).resolves.toMatchObject({ id: "L1" });
  });

  it("refusée sans porteur : aucune ligne écrite", async () => {
    etat.jobExiste = false;
    await expect(reserverCout({ ...base, jobId: "maj-abc" })).rejects.toMatchObject({
      code: "config_invalide",
    });
    expect(etat.lignes).toBe(0);
  });

  it("le cumul commun (jour 10 $, mois 200 $) s'applique au porteur", async () => {
    etat.cumulCommun = [10.01, 5];
    etat.cumulPilotage = [0.1, 0.1];
    await expect(reserverCout(base)).rejects.toMatchObject({ code: "plafond_jour" });
    etat.cumulCommun = [1, 200.01];
    await expect(reserverCout(base)).rejects.toMatchObject({ code: "plafond_mois" });
  });
});

describe("sous-plafonds du pilotage", () => {
  it("2 $ par jour atteint : refus `plafond_pilotage_jour`", async () => {
    etat.cumulCommun = [3, 6];
    etat.cumulPilotage = [2.01, 2.01];
    const err = await reserverCout(base).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BlogClaudeRefusError);
    expect(err).toMatchObject({ code: "plafond_pilotage_jour" });
  });

  it("exactement 2 $ : passe (le plafond est inclus)", async () => {
    etat.cumulCommun = [3, 6];
    etat.cumulPilotage = [2, 2];
    await expect(reserverCout(base)).resolves.toBeDefined();
  });

  it("30 $ par mois atteint : refus `plafond_pilotage_mois`", async () => {
    etat.cumulCommun = [3, 60];
    etat.cumulPilotage = [1, 30.01];
    await expect(reserverCout(base)).rejects.toMatchObject({ code: "plafond_pilotage_mois" });
  });

  it("les sous-plafonds posés en base sont lus", async () => {
    etat.config = { pilotage_cout_max_jour_usd: 0.5, pilotage_cout_max_mois_usd: 1 };
    etat.cumulCommun = [3, 6];
    etat.cumulPilotage = [0.6, 0.6];
    await expect(reserverCout(base)).rejects.toMatchObject({ code: "plafond_pilotage_jour" });
  });

  it("valeur de base illisible : défaut (jamais un plafond ouvert)", async () => {
    etat.config = { pilotage_cout_max_jour_usd: "illimité" };
    etat.cumulCommun = [3, 6];
    etat.cumulPilotage = [2.5, 2.5];
    await expect(reserverCout(base)).rejects.toMatchObject({ code: "plafond_pilotage_jour" });
  });

  it("lecture de la base en erreur : refus sûr `base_indisponible`", async () => {
    etat.configEnErreur = true;
    await expect(reserverCout(base)).rejects.toMatchObject({ code: "base_indisponible" });
  });

  it("une autre origine (équipe éditoriale) n'est pas soumise aux sous-plafonds du pilotage", async () => {
    etat.origine = "equipe_maj";
    etat.cumulCommun = [3, 6];
    etat.cumulPilotage = [99, 99];
    await expect(reserverCout(base)).resolves.toBeDefined();
    expect(etat.sqls.some((s) => s.includes("cost_ledger") && s.includes("'origine'"))).toBe(false);
  });

  it("job sans origine (génération classique) : aucun calcul de sous-plafond", async () => {
    etat.origine = null;
    etat.cumulCommun = [3, 6];
    await expect(reserverCout(base)).resolves.toBeDefined();
    expect(etat.sqls.some((s) => s.includes("cost_ledger") && s.includes("'origine'"))).toBe(false);
  });
});

describe("modèle imposé au pilotage", () => {
  it.each(["claude-sonnet-5-5", "claude-opus-5-5"])("%s accepté", async (model) => {
    etat.cumulCommun = [1, 1];
    etat.cumulPilotage = [0, 0];
    await expect(reserverCout({ ...base, model })).resolves.toBeDefined();
  });

  it.each(["claude-haiku-5-5", "claude-sonnet-4", "autre"])("%s refusé", async (model) => {
    await expect(reserverCout({ ...base, model })).rejects.toMatchObject({
      code: "modele_interdit",
    });
    expect(etat.lignes).toBe(0);
  });
});
