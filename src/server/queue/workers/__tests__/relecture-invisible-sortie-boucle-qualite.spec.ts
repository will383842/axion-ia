/**
 * Un job sorti de la boucle qualité doit ENTRER dans la file de relecture.
 *
 * Ce que ces tests protègent, mesuré en production le 2026-09-01 :
 *
 *   51 jobs `needs_review` SANS ligne `ReviewQueue`. Tous portaient
 *   `qualityImprovementAttempts ≥ 1` — donc tous sortis de la boucle qualité.
 *   Le plus récent datait du 24/08 : le trou était encore ouvert.
 *
 * Conséquence exacte : l'écran de relecture de la console se construit à partir
 * de `ReviewQueue`. Un job sans cette ligne existe en base, porte un contenu
 * généré et facturé, et n'apparaît NULLE PART. Personne ne peut le valider, le
 * rejeter, ni même savoir qu'il attend.
 *
 * 🔑 `content-gen-worker.ts` documentait déjà l'exigence (« Sans cette row,
 * /review-queue/[id] ne trouve rien »). Elle n'était appliquée que sur le
 * chemin d'AUTO-PUBLICATION de ce worker-ci — six autres sorties basculaient en
 * `needs_review` sans rien créer. Un invariant écrit à un seul endroit n'est pas
 * un invariant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const upsertMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { reviewQueue: { upsert: (args: unknown) => upsertMock(args) } },
}));

// Le worker tire une chaîne lourde (Server Actions → next-auth, BullMQ, Sentry).
// On la neutralise pour pouvoir importer LE VRAI module testé — c'est bien le
// code de production qui s'exécute ici, seules ses dépendances sont simulées.
vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/server/content-gen/config-store", () => ({
  persistContentGenConfig: vi.fn(),
  readKillSwitchFailSafe: vi.fn().mockResolvedValue({ active: false }),
}));
vi.mock("@/server/content-gen/shared/generation-log", () => ({
  logGeneration: vi.fn(),
  logStep: vi.fn(),
}));
vi.mock("@/server/content-gen/reviewer/llm-judge", () => ({
  reviewArticle: vi.fn(),
  formatJudgeFeedback: vi.fn(),
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn().mockResolvedValue(undefined) }));

/**
 * Convention du dépôt (cf. `aucun-envoi-ignore.spec.ts`). Si le worker est
 * déplacé, `readFileSync` lève : la garde ROUGIT au lieu de devenir muette.
 */
const WORKER_PATH = join(
  process.cwd(),
  "src",
  "server",
  "queue",
  "workers",
  "content-quality-improver-worker.ts",
);

/** Source sans commentaires — sinon la garde se prouve avec sa propre prose. */
function sourceSansCommentaires(): string {
  return readFileSync(WORKER_PATH, "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

beforeEach(() => {
  vi.clearAllMocks();
  upsertMock.mockResolvedValue({});
});

describe("ensurePendingReviewRow", () => {
  it("crée une ligne `pending` pour le job", async () => {
    const { ensurePendingReviewRow } = await import("../content-quality-improver-worker");

    await ensurePendingReviewRow("job-1");

    const arg = upsertMock.mock.calls[0]?.[0] as {
      where: { jobId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ jobId: "job-1" });
    expect(arg.create).toEqual({ jobId: "job-1", status: "pending" });
  });

  it("n'écrase JAMAIS une ligne existante — une décision humaine prime", async () => {
    // `update: {}` n'est pas un oubli : un job qui repasse par la boucle ne doit
    // pas faire retomber en `pending` un `approved` ou un `rejected` déjà saisi.
    const { ensurePendingReviewRow } = await import("../content-quality-improver-worker");

    await ensurePendingReviewRow("job-1");

    const arg = upsertMock.mock.calls[0]?.[0] as { update: Record<string, unknown> };
    expect(arg.update).toEqual({});
  });

  it("ne fait pas échouer la passe si la file de relecture refuse l'écriture", async () => {
    // Fail-open volontaire : une panne de la file de relecture ne doit pas
    // perdre le travail de la boucle qualité. Mais elle doit se VOIR.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    upsertMock.mockRejectedValueOnce(new Error("base indisponible"));
    const { ensurePendingReviewRow } = await import("../content-quality-improver-worker");

    await expect(ensurePendingReviewRow("job-1")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("aucune sortie du worker ne bascule en relecture sans sa ligne", () => {
  it('chaque écriture `status: "needs_review"` est suivie de l\'appel', () => {
    const src = sourceSansCommentaires();
    const marqueur = 'status: "needs_review"';

    const positions: number[] = [];
    for (let i = src.indexOf(marqueur); i !== -1; i = src.indexOf(marqueur, i + 1)) {
      positions.push(i);
    }
    // Si ce compte tombe à zéro, c'est la garde qui est morte, pas le défaut qui
    // est réglé : on l'exige explicitement.
    expect(positions.length).toBeGreaterThanOrEqual(5);

    const orphelines = positions.filter(
      (i) => !src.slice(i, i + 220).includes("ensurePendingReviewRow("),
    );
    expect(orphelines).toEqual([]);
  });

  it("la sortie principale (verdict du juge) est couverte elle aussi", () => {
    // Celle-ci écrit `status: nextStatus` : le marqueur littéral ne la voit pas.
    // C'est pourtant elle qui produisait le gros des 51 orphelins.
    const src = sourceSansCommentaires();
    const i = src.indexOf('nextStatus === "needs_review"');

    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, i + 220)).toContain("ensurePendingReviewRow(");
  });
});
