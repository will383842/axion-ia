/**
 * 🗑️ LES CANDIDATURES AUX OFFRES D'EMPLOI S'EFFACENT 2 ANS APRÈS LE DERNIER
 * ÉCHANGE — ET SEULEMENT ELLES, ET JAMAIS AVANT.
 *
 * **Décision du responsable de traitement, 2026-10-11** : « on garde les CV et
 * données 2 ans », puis effacement automatique (recommandation CNIL : deux ans
 * après le dernier contact). C'est le « nouvel arbitrage explicite » que
 * réclamait la décision du 2026-10-07 (« je ne veux surtout pas d'effacement »),
 * et il ne la renverse QUE pour `JobApplication` — candidatures aux offres,
 * avec leurs CV, photographies et vidéos.
 *
 * ## Ce que ce fichier garde
 *
 *  1. La durée : 24 mois, écrite en dur. Pas de variable d'environnement : la
 *     notice et le formulaire annoncent « 2 ans », et une variable permettrait
 *     de les faire mentir sans toucher au code.
 *  2. Le point de départ : le DERNIER ÉCHANGE, pas le dépôt. Une vieille
 *     candidature à laquelle on vient de répondre repart pour deux ans.
 *  3. L'exclusion des personnes RECRUTÉES (`hired`, décision `D4`) : leur
 *     dossier est une pièce du dossier du personnel.
 *  4. L'ordre : les fichiers d'abord, la ligne ensuite. Si le disque échoue, la
 *     ligne reste et la passe suivante réessaie.
 *  5. Le périmètre : `Submission` (candidats apporteurs, contacts) n'est
 *     TOUJOURS jamais supprimée — la décision du 2026-10-07 tient pour elle.
 *
 * ## Ce qui n'est pas concerné
 *
 * L'effacement MANUEL ou anticipé : `deleteApplicationAction` (console) et
 * `api/gdpr-erase` (droit à l'effacement). Ce sont des gestes, pas une horloge.
 *
 * ## Remplace `les-candidatures-ne-sont-jamais-purgees.spec.ts`
 *
 * Qui interdisait toute suppression de candidature dans le worker. Sa moitié
 * « fiches et apporteurs » est conservée ici, intacte.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = join(
  process.cwd(),
  "src",
  "server",
  "queue",
  "workers",
  "retention-purge-worker.ts",
);

/** Les commentaires sont RETIRÉS avant analyse : le worker raconte en prose ce qu'il ne fait plus. */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

// ── Harnais de comportement : Prisma mocké, aucun accès à une vraie base ──────

type Echue = { id: string; cvStoragePath: string | null; photoStoragePath: string | null };

const etat = vi.hoisted(() => ({
  echues: [] as Echue[],
  /** Journal ordonné de ce que la passe a fait aux candidatures et à leurs fichiers. */
  journal: [] as string[],
  findManyArgs: [] as unknown[],
  suppressionsParModele: new Map<string, number>(),
}));

vi.mock("@/lib/prisma", () => {
  function generique(modele: string) {
    const noter = () =>
      etat.suppressionsParModele.set(modele, (etat.suppressionsParModele.get(modele) ?? 0) + 1);
    return {
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => {
        noter();
        return { count: 0 };
      }),
      delete: vi.fn(async () => {
        noter();
        return {};
      }),
      count: vi.fn(async () => 0),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async () => ({})),
    };
  }
  const jobApplication = {
    findMany: vi.fn(async (args: unknown) => {
      etat.findManyArgs.push(args);
      return etat.echues;
    }),
    count: vi.fn(async () => 0),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      etat.journal.push(`ligne:${where.id}`);
      return {};
    }),
    deleteMany: vi.fn(async () => {
      etat.journal.push("deleteMany");
      return { count: 0 };
    }),
  };
  const cache = new Map<string, ReturnType<typeof generique>>();
  return {
    prisma: new Proxy(
      {},
      {
        get(_cible, modele: string, recepteur: unknown) {
          if (modele === "$transaction") {
            return (fn: (tx: unknown) => unknown) => fn(recepteur);
          }
          if (modele === "jobApplication") return jobApplication;
          if (!cache.has(modele)) cache.set(modele, generique(modele));
          return cache.get(modele);
        },
      },
    ),
  };
});

const { deleteCv, supprimerVideosCandidature } = vi.hoisted(() => ({
  deleteCv: vi.fn<(chemin: string | null | undefined) => Promise<undefined>>(),
  supprimerVideosCandidature: vi.fn<(id: string) => Promise<undefined>>(),
}));
vi.mock("@/server/careers/cv-storage", () => ({ deleteCv }));
vi.mock("@/server/careers/videos-candidat", () => ({ supprimerVideosCandidature }));
vi.mock("bullmq", () => ({ Worker: class {} }));
vi.mock("../connection", () => ({ getBullConnectionOrThrow: () => ({}) }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/server/newsletter/retention", () => ({ purgerOutboxCrm: vi.fn(async () => 0) }));

import {
  executerPurgeRetention,
  candidaturesEchuesWhere,
  CANDIDATURES_MOIS,
  CANDIDATURES_PAR_PASSE,
} from "../retention-purge-worker";

beforeEach(() => {
  etat.echues = [];
  etat.journal = [];
  etat.findManyArgs = [];
  etat.suppressionsParModele.clear();
  deleteCv.mockReset();
  deleteCv.mockImplementation(async (chemin) => {
    if (chemin) etat.journal.push(`fichier:${chemin}`);
    return undefined;
  });
  supprimerVideosCandidature.mockReset();
  supprimerVideosCandidature.mockImplementation(async (id) => {
    etat.journal.push(`videos:${id}`);
    return undefined;
  });
});

describe("🗑️ candidatures — effacées 2 ans après le dernier échange", () => {
  it("le fichier du worker est bien lu — sinon la garde ne garde rien", () => {
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    expect(code).toContain("executerPurgeRetention");
    expect(code.length).toBeGreaterThan(2_500);
  });

  it("🔴 la durée est de 24 mois, en dur — ce que la notice et le formulaire annoncent", () => {
    expect(CANDIDATURES_MOIS).toBe(24);
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    // Une variable d'environnement ferait mentir la notice sans toucher au code.
    expect(code).not.toContain("RETENTION_CANDIDATURES_MONTHS");
  });

  describe("le « dernier échange »", () => {
    const limite = new Date("2024-10-11T03:00:00.000Z");
    const where = candidaturesEchuesWhere(limite);

    it("🛑 une personne recrutée n'est jamais visée", () => {
      expect(where.status).toEqual({ notIn: ["hired"] });
    });

    it("le dépôt doit être antérieur à la limite", () => {
      expect(where.submittedAt).toEqual({ lt: limite });
    });

    it("🔴 une réponse, une réponse reçue, un entretien ou une ligne de journal RÉCENTS protègent une vieille candidature", () => {
      // Une candidature de 2023 à laquelle on a écrit le mois dernier a été
      // « contactée » le mois dernier : ses deux ans repartent de là.
      expect(where.OR).toEqual([{ lastActivityAt: null }, { lastActivityAt: { lt: limite } }]);
      expect(where.replies).toEqual({ none: { repliedAt: { gte: limite } } });
      expect(where.reponsesRecues).toEqual({ none: { receivedAt: { gte: limite } } });
      expect(where.interviews).toEqual({ none: { scheduledAt: { gte: limite } } });
    });
  });

  describe("à l'exécution, sur un Prisma mocké", () => {
    it("rien d'échu : rien n'est effacé, aucun fichier touché", async () => {
      await executerPurgeRetention();
      expect(etat.journal).toEqual([]);
      expect(deleteCv).not.toHaveBeenCalled();
      expect(supprimerVideosCandidature).not.toHaveBeenCalled();
    });

    it("la sélection porte la limite à 24 mois, le filtre du dernier échange et le plafond", async () => {
      const avant = Date.now();
      await executerPurgeRetention();
      expect(etat.findManyArgs).toHaveLength(1);
      const args = etat.findManyArgs[0] as {
        where: ReturnType<typeof candidaturesEchuesWhere>;
        take: number;
      };
      expect(args.take).toBe(CANDIDATURES_PAR_PASSE);
      const limite = args.where.submittedAt.lt;
      expect(args.where).toEqual(candidaturesEchuesWhere(limite));
      // 🔑 Jamais avant 24 mois : la limite tombe entre 729 et 732 jours en arrière.
      const jours = (avant - limite.getTime()) / 86_400_000;
      expect(jours).toBeGreaterThan(729);
      expect(jours).toBeLessThan(732);
    });

    it("🔴 une candidature échue : fichiers D'ABORD, ligne ENSUITE", async () => {
      etat.echues = [{ id: "c1", cvStoragePath: "cv/c1.pdf", photoStoragePath: "photo/c1.jpg" }];
      await executerPurgeRetention();
      expect(etat.journal).toEqual([
        "fichier:cv/c1.pdf",
        "fichier:photo/c1.jpg",
        "videos:c1",
        "ligne:c1",
      ]);
    });

    it("🔴 si l'effacement des fichiers échoue, la ligne RESTE — et les suivantes sont traitées", async () => {
      etat.echues = [
        { id: "c1", cvStoragePath: "cv/c1.pdf", photoStoragePath: null },
        { id: "c2", cvStoragePath: "cv/c2.pdf", photoStoragePath: null },
      ];
      deleteCv.mockImplementation(async (chemin) => {
        if (chemin === "cv/c1.pdf") throw new Error("disque");
        if (chemin) etat.journal.push(`fichier:${chemin}`);
        return undefined;
      });
      await executerPurgeRetention();
      expect(etat.journal).not.toContain("ligne:c1");
      expect(etat.journal).toContain("ligne:c2");
    });

    it("jamais de suppression en masse : une ligne à la fois, après ses fichiers", async () => {
      etat.echues = [{ id: "c1", cvStoragePath: null, photoStoragePath: null }];
      await executerPurgeRetention();
      expect(etat.journal).not.toContain("deleteMany");
    });

    it("🛑 les fiches (apporteurs, contacts) ne sont TOUJOURS jamais supprimées", async () => {
      etat.echues = [{ id: "c1", cvStoragePath: null, photoStoragePath: null }];
      await executerPurgeRetention();
      expect(etat.suppressionsParModele.get("submission") ?? 0).toBe(0);
      const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
      expect(code).not.toMatch(/\.submission\s*\.\s*delete/);
      expect(code).not.toContain("RETENTION_SUBS_ARCHIVE_MONTHS");
    });

    it("les purges techniques restent en place", async () => {
      await executerPurgeRetention();
      expect(etat.suppressionsParModele.get("webVitalSample") ?? 0).toBeGreaterThan(0);
      expect(etat.suppressionsParModele.get("generationLog") ?? 0).toBeGreaterThan(0);
    });
  });
});
