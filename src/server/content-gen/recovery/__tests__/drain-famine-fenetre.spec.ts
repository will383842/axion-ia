/**
 * Famine de fenêtre du drain des échecs — régression du 2026-09-01.
 *
 * Mesuré en production le jour où le crédit OpenAI a été rechargé, sur les
 * 1 441 échecs encore relançables :
 *
 *   rang 1 à 29 : échecs PERMANENTS de début juillet (« plan invalide »,
 *                 « aucun output valide », « quality_gate », parse errors)
 *   rang 30     : le PREMIER échec relançable
 *   rangs 30+   : 1 383 échecs de quota, tous parfaitement régénérables
 *
 * L'ancien drain lisait UNE page de `budget * 6` lignes (30 au plus) et
 * espérait y trouver de quoi remplir son budget. La page s'ouvrait donc sur
 * 29 cadavres, écartés par `isAutoRetryable` mais toujours `failed` avec
 * `retryCount < maxRetries` : ils reprenaient la même place au tick suivant,
 * indéfiniment. Et le budget est lissé sur la journée — il vaut le plus
 * souvent 1 à 3, jamais 5. Le rechargement du crédit n'aurait donc rien
 * rattrapé : pas un seul des 1 383 jobs récupérables.
 *
 * 🔑 Une fenêtre doit être dimensionnée par CE QU'ON CHERCHE, pas par ce qu'on
 * espère trouver.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
const countMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentGenJob: {
      findMany: (args: unknown) => findManyMock(args),
      count: (args: unknown) => countMock(args),
      update: (args: unknown) => updateMock(args),
    },
  },
}));

import { DEFAULT_RECOVERY_SETTINGS, drainFailedJobs } from "../backlog-recovery";

function makeQueue() {
  const addMock = vi.fn().mockResolvedValue({ id: "bull-1" });
  return { queue: { getJob: vi.fn().mockResolvedValue(null), add: addMock } as never, addMock };
}

function job(id: string, errorMessage: string) {
  return {
    id,
    contentType: "blog_article",
    targetSearchIntent: "informational",
    inputPayload: { slotIndex: 1 },
    retryCount: 0,
    errorMessage,
  };
}

/** Échec de qualité : `isAutoRetryable` le refuse à jamais. */
const PERMANENT = "blog-article: plan invalide après 2 tentatives";
/** Échec de quota : relançable dès que le crédit revient. */
const TRANSIENT = "OpenAI rate limited: 429 You have no credits remaining.";

/**
 * Simule une vraie table paginée : le mock HONORE `skip` et `take`.
 * C'est ce qui rend le test capable de juger l'arithmétique d'offset, et pas
 * seulement le fait qu'on ait appelé `findMany` plusieurs fois.
 */
function servirTable(lignes: ReadonlyArray<ReturnType<typeof job>>) {
  const restantes = [...lignes];
  findManyMock.mockImplementation((args: { skip?: number; take?: number }) =>
    Promise.resolve(
      restantes.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? restantes.length)),
    ),
  );
  return {
    /** Retire de la table les lignes remises en file (leur statut devient `queued`). */
    retirer: (id: string) => {
      const i = restantes.findIndex((l) => l.id === id);
      if (i >= 0) restantes.splice(i, 1);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMock.mockResolvedValue({});
  countMock.mockResolvedValue(0);
});

describe("le drain atteint les échecs relançables derrière la tête permanente", () => {
  it("40 échecs permanents en tête ne masquent plus les relançables derrière", async () => {
    // 40 > `budget * 6` (= 30) : l'ancienne page unique ne voyait QUE des
    // cadavres et relançait zéro job. C'est la production du 01/09 en réduction.
    const { queue } = makeQueue();
    const table = [
      ...Array.from({ length: 40 }, (_, i) => job(`perm-${i}`, PERMANENT)),
      ...Array.from({ length: 5 }, (_, i) => job(`quota-${i}`, TRANSIENT)),
    ];
    const t = servirTable(table);
    const { queue: q, addMock } = makeQueue();
    addMock.mockImplementation((_n: string, data: { contentGenJobId: string }) => {
      t.retirer(data.contentGenJobId);
      return Promise.resolve({ id: "bull" });
    });

    const outcome = await drainFailedJobs(q, DEFAULT_RECOVERY_SETTINGS);

    expect(outcome.requeued).toBe(5);
    expect(outcome.skipped).toBe(40);
    // Ce sont bien les jobs de quota qui repartent, pas les cadavres.
    const relances = addMock.mock.calls.map(
      (c) => (c[1] as { contentGenJobId: string }).contentGenJobId,
    );
    expect(relances).toEqual(["quota-0", "quota-1", "quota-2", "quota-3", "quota-4"]);
    void queue;
  });

  it("pagine réellement : le second appel reprend là où le premier s'est arrêté", async () => {
    // 150 permanents : la première page (100) est entièrement écartée, donc la
    // suivante doit démarrer à 100 — sinon on relit les mêmes à l'infini.
    const { queue } = makeQueue();
    servirTable([
      ...Array.from({ length: 150 }, (_, i) => job(`perm-${i}`, PERMANENT)),
      job("quota-0", TRANSIENT),
    ]);

    await drainFailedJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    const skips = findManyMock.mock.calls.map((c) => (c[0] as { skip?: number }).skip);
    expect(skips.length).toBeGreaterThan(1);
    expect(skips[0]).toBe(0);
    expect(skips[1]).toBe(100);
  });

  it("s'arrête au plafond de balayage au lieu de tourner sans fin", async () => {
    // Table entièrement permanente : le drain ne doit ni boucler, ni marteler
    // la base. Le plafond par tick est de 600 lignes.
    const { queue } = makeQueue();
    servirTable(Array.from({ length: 5000 }, (_, i) => job(`perm-${i}`, PERMANENT)));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const outcome = await drainFailedJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    expect(outcome.requeued).toBe(0);
    expect(outcome.skipped).toBe(600);
    expect(findManyMock.mock.calls.length).toBeLessThanOrEqual(7);
    // Le signal qui manquait : un drain affamé doit le DIRE.
    expect(warn.mock.calls.flat().join(" ")).toContain("affamé");
    warn.mockRestore();
  });

  it("s'arrête dès le budget rempli — la pagination ne fait pas dépenser plus", async () => {
    // Garde anti-régression de dépense : élargir la lecture ne doit pas élargir
    // la relance. `maxPerTick` reste le plafond.
    const { queue: q, addMock } = makeQueue();
    const t = servirTable(Array.from({ length: 300 }, (_, i) => job(`quota-${i}`, TRANSIENT)));
    addMock.mockImplementation((_n: string, data: { contentGenJobId: string }) => {
      t.retirer(data.contentGenJobId);
      return Promise.resolve({ id: "bull" });
    });

    const outcome = await drainFailedJobs(q, DEFAULT_RECOVERY_SETTINGS);

    expect(outcome.requeued).toBe(DEFAULT_RECOVERY_SETTINGS.maxPerTick);
    expect(findManyMock.mock.calls.length).toBe(1);
  });

  it("le budget partagé reste souverain", async () => {
    const { queue: q, addMock } = makeQueue();
    const t = servirTable(Array.from({ length: 300 }, (_, i) => job(`quota-${i}`, TRANSIENT)));
    addMock.mockImplementation((_n: string, data: { contentGenJobId: string }) => {
      t.retirer(data.contentGenJobId);
      return Promise.resolve({ id: "bull" });
    });

    const outcome = await drainFailedJobs(q, DEFAULT_RECOVERY_SETTINGS, 2);

    expect(outcome.requeued).toBe(2);
  });
});
