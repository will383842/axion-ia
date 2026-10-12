/**
 * M21 (lot E) — la purge des candidatures à 2 ans n'efface JAMAIS la candidature d'une
 * personne retenue ou devenue formateur.
 *
 * Décision déjà prise : effacement automatique 2 ans après le dernier échange, SAUF
 * les candidatures des personnes retenues (`hired`, déjà exclues par le filtre) et des
 * personnes devenues formateurs. Le worker consulte désormais
 * `candidaturesAConserverPour` (la règle de l'effacement à la demande, W5 I-11), et
 * garde aussi toute candidature reliée à une fiche formateur, même interrupteur coupé.
 *
 * Ni le droit du candidat d'effacer sa candidature ni l'action de la console ne
 * changent : ce fichier ne regarde que le worker.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// ── Harnais de comportement : Prisma mocké, aucun accès à une vraie base ──────

type Echue = {
  id: string;
  cvStoragePath: string | null;
  photoStoragePath: string | null;
  email?: string;
  trainerId?: string | null;
  fichesFormateurOuvertes?: Array<{ id: string }>;
};

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
const { aConserver } = vi.hoisted(() => ({
  aConserver: vi.fn<(email: string) => Promise<ReadonlySet<string>>>(),
}));
vi.mock("@/lib/rgpd-formateur-independant", () => ({ candidaturesAConserverPour: aConserver }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v?.replace(/^enc:/, "") }));

import { executerPurgeRetention } from "../retention-purge-worker";

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
  supprimerVideosCandidature.mockImplementation(async () => undefined);
  aConserver.mockReset();
  aConserver.mockResolvedValue(new Set());
});

const echue = (id: string, over: Partial<Echue> = {}): Echue => ({
  id,
  cvStoragePath: `cv/${id}.pdf`,
  photoStoragePath: null,
  email: `enc:${id}@example.test`,
  trainerId: null,
  fichesFormateurOuvertes: [],
  ...over,
});

describe("M21 — la purge des candidatures épargne les formateurs", () => {
  it("consulte `candidaturesAConserverPour` avec l'adresse déchiffrée", async () => {
    etat.echues = [echue("c1")];
    await executerPurgeRetention();
    expect(aConserver).toHaveBeenCalledWith("c1@example.test");
    expect(etat.journal).toContain("ligne:c1");
  });

  it("🛑 candidature d'un formateur sous lien contractuel : ni fichier ni ligne effacés", async () => {
    etat.echues = [echue("c1"), echue("c2")];
    aConserver.mockImplementation(async (email) =>
      email === "c2@example.test" ? new Set(["c2"]) : new Set(),
    );
    await executerPurgeRetention();
    expect(etat.journal).toContain("ligne:c1");
    expect(etat.journal).not.toContain("ligne:c2");
    expect(etat.journal).not.toContain("fichier:cv/c2.pdf");
  });

  it("🛑 candidature reliée à une fiche formateur (même interrupteur coupé) : gardée", async () => {
    etat.echues = [
      echue("c3", { trainerId: "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13" }),
      echue("c4", { fichesFormateurOuvertes: [{ id: "t" }] }),
    ];
    await executerPurgeRetention();
    expect(etat.journal).toEqual([]);
  });

  it("dans le doute (consultation en échec), la candidature est gardée", async () => {
    etat.echues = [echue("c5")];
    aConserver.mockRejectedValue(new Error("panne"));
    await executerPurgeRetention();
    expect(etat.journal).toEqual([]);
  });

  it("la lecture écarte d'emblée les candidatures reliées à une fiche (pas de lot bloqué)", async () => {
    await executerPurgeRetention();
    const args = etat.findManyArgs[0] as { where: Record<string, unknown> };
    expect(args.where).toMatchObject({ trainerId: null, fichesFormateurOuvertes: { none: {} } });
    expect(args.where).toMatchObject({ status: { notIn: ["hired"] } });
  });

  it("la lecture demande ce qu'il faut pour décider (adresse, fiche reliée)", async () => {
    await executerPurgeRetention();
    const args = etat.findManyArgs[0] as { select: Record<string, unknown> };
    expect(args.select).toMatchObject({
      email: true,
      trainerId: true,
      fichesFormateurOuvertes: { select: { id: true }, take: 1 },
    });
  });
});
