/**
 * Registre de coût : types autorisés (CONTENT_GEN_CLAUDE_TYPES) et verrou consultatif.
 * Base simulée avec un vrai mutex qui imite `pg_advisory_xact_lock` (tenu jusqu'à la fin
 * de la transaction) : deux réservations concurrentes sous plafond ne peuvent pas passer
 * toutes les deux. Chiffres FICTIFS. (Pas de Postgres dans ce test : l'exclusion mutuelle
 * réelle relève de la base ; on prouve ici que le code prend le verrou AVANT de lire les
 * cumuls et le garde jusqu'au commit.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Ligne {
  id: string;
  costUsd: number;
}
const etat = vi.hoisted(() => ({
  lignes: [] as Array<{ id: string; costUsd: number }>,
  compteur: 0,
  jobTypeOk: true,
  requetes: [] as Array<{ sql: string; values: unknown[] }>,
  verrouLibre: Promise.resolve() as Promise<void>,
  verrousPris: [] as string[],
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => {
      let liberer: () => void = () => undefined;
      let verrouTenu = false;
      let avant = "[]";
      const tx = {
        $executeRaw: vi.fn(async (strings: TemplateStringsArray) => {
          const sql = strings.join("?");
          etat.verrousPris.push(sql);
          const attente = etat.verrouLibre;
          etat.verrouLibre = new Promise<void>((r) => (liberer = r));
          await attente; // bloque tant qu'une autre transaction tient le verrou
          verrouTenu = true;
          avant = JSON.stringify(etat.lignes); // instantané pris verrou tenu
          return 1;
        }),
        $queryRaw: vi.fn(async (q: { sql: string; values: unknown[] }) => {
          etat.requetes.push({ sql: q.sql, values: q.values });
          if (q.sql.includes("SELECT 1 FROM content_gen_jobs")) {
            return etat.jobTypeOk ? [{ "?column?": 1 }] : [];
          }
          const total = etat.lignes.reduce((s, l) => s + l.costUsd, 0);
          return [{ total }];
        }),
        costLedger: {
          create: vi.fn(async ({ data }: { data: { costUsd: number } }) => {
            // Une écriture sans verrou serait la faille : le test échoue alors.
            if (!verrouTenu) throw new Error("écriture sans verrou");
            const id = `L${etat.lignes.length + 1}`;
            etat.lignes.push({ id, costUsd: data.costUsd });
            return { id };
          }),
        },
        providerConfig: {
          findUnique: vi.fn(async () => ({ currentMonthSpentUsd: etat.compteur })),
          update: vi.fn(
            async ({ data }: { data: { currentMonthSpentUsd: { increment: number } } }) => {
              etat.compteur += data.currentMonthSpentUsd.increment;
            },
          ),
        },
      };
      try {
        return await fn(tx);
      } catch (e) {
        etat.lignes = JSON.parse(avant) as Ligne[];
        throw e;
      } finally {
        liberer(); // fin de transaction = verrou relâché
      }
    }),
  };
  return { prisma };
});

import { reserverCout } from "../blog-claude-ledger";

const base = {
  model: "claude-sonnet-5-5",
  tokensInputEstimes: 1000,
  coutMaxUsd: 0.6,
  plafondJourUsd: 1, // une réservation de 0,60 $ passe, deux (1,20 $) non
  plafondMoisBlogUsd: 10,
  plafondMoisGlobalUsd: 100,
  reserveQualiopiUsd: 5,
};

beforeEach(() => {
  vi.unstubAllEnvs();
  delete process.env["CONTENT_GEN_CLAUDE_TYPES"];
  etat.lignes = [];
  etat.compteur = 0;
  etat.jobTypeOk = true;
  etat.requetes = [];
  etat.verrouLibre = Promise.resolve();
  etat.verrousPris = [];
});
afterEach(() => vi.unstubAllEnvs());

describe("types autorisés dans le registre", () => {
  it("défaut : le contrôle du job ne liste que les 4 types blog", async () => {
    await reserverCout({ ...base, jobId: "j1" });
    const job = etat.requetes.find((r) => r.sql.includes("SELECT 1 FROM content_gen_jobs"))!;
    expect([...job.values].filter((v) => typeof v === "string" && v !== "j1").sort()).toEqual([
      "blog_article",
      "blog_from_keywords",
      "blog_from_rss",
      "blog_from_title",
    ]);
  });

  it("`tous` : le contrôle du job liste toute l'énumération", async () => {
    vi.stubEnv("CONTENT_GEN_CLAUDE_TYPES", "tous");
    await reserverCout({ ...base, jobId: "j1" });
    const job = etat.requetes.find((r) => r.sql.includes("SELECT 1 FROM content_gen_jobs"))!;
    expect(job.values).toContain("landing_ville");
    expect(job.values).toContain("qa_derived");
  });

  it("type hors liste : refus config_invalide, aucune ligne, aucun compteur", async () => {
    etat.jobTypeOk = false; // la base ne trouve pas le job dans la liste autorisée
    await expect(reserverCout({ ...base, jobId: "j1" })).rejects.toMatchObject({
      code: "config_invalide",
    });
    expect(etat.lignes).toHaveLength(0);
    expect(etat.compteur).toBe(0);
  });

  it("liste sans aucun type connu : refus avant toute écriture", async () => {
    vi.stubEnv("CONTENT_GEN_CLAUDE_TYPES", "faux");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(reserverCout({ ...base, jobId: "j1" })).rejects.toMatchObject({
      code: "config_invalide",
    });
    expect(etat.lignes).toHaveLength(0);
  });

  it("le cumul compte TOUS les types de contenu (réduire la liste n'efface pas la dépense)", async () => {
    await reserverCout({ ...base, jobId: "j1" });
    const cumuls = etat.requetes.filter((r) => r.sql.includes("SUM("));
    expect(cumuls).toHaveLength(2);
    for (const c of cumuls) {
      expect(c.values).toContain("landing_ville");
      expect(c.values).toContain("blog_article");
    }
  });
});

describe("verrou consultatif et concurrence", () => {
  it("deux réservations concurrentes sous plafond : une seule passe", async () => {
    const [a, b] = await Promise.allSettled([
      reserverCout({ ...base, jobId: "j1" }),
      reserverCout({ ...base, jobId: "j2" }),
    ]);
    const statuts = [a.status, b.status].sort();
    expect(statuts).toEqual(["fulfilled", "rejected"]);
    const refus = (a.status === "rejected" ? a : b) as PromiseRejectedResult;
    expect(refus.reason).toMatchObject({ code: "plafond_jour" });
    expect(etat.lignes).toHaveLength(1);
    expect(etat.verrousPris).toHaveLength(2);
    expect(etat.verrousPris.every((s) => s.includes("blog_claude_cap"))).toBe(true);
  });
});
