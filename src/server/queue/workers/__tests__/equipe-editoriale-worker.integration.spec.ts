/**
 * PR 12 (corrections) — test d'intégration du worker de génération.
 *
 * On fait tourner le vrai `processJob` (capturé via le `Worker` BullMQ simulé) avec les modules
 * externes simulés (base, rôles, générateur). Équipe allumée : ordre des rôles, journal, arrêts
 * avant écriture (verrou relâché), angle du gardien transmis au rédacteur, garde de plafond du
 * routeur. Éteinte, ou carte des requêtes illisible : chemin d'avant (aucun rôle appelé).
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const ordre: string[] = [];
  const state = {
    processeur: undefined as undefined | ((job: unknown) => Promise<void>),
    cout: 0,
    /** Ce que la garde du routeur a répondu pendant l'écriture. */
    garde: "non appelée" as string,
    /** À partir du N-ième appel de lecture du coût, le registre rend 3,5 $. */
    depasseDepuis: Infinity,
    appelsCout: 0,
  };
  const prisma = {
    contentGenJob: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
    reviewQueue: { create: vi.fn(async () => ({})), count: vi.fn(async () => 0) },
    coverageCampaign: { findUnique: vi.fn(async () => null) },
  };
  return { ordre, state, prisma };
});

vi.mock("bullmq", () => {
  class Worker {
    constructor(_n: string, proc: (job: unknown) => Promise<void>) {
      h.state.processeur = proc;
    }
    on() {
      return this;
    }
    close() {
      return Promise.resolve();
    }
  }
  class Queue {
    add() {
      return Promise.resolve();
    }
  }
  class UnrecoverableError extends Error {}
  return { Worker, Queue, UnrecoverableError };
});
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/content-gen/config-store", () => ({
  readKillSwitchFailSafe: async () => ({ active: false }),
}));
vi.mock("@/server/content-gen/kb-health", () => ({
  assertKbReady: async () => undefined,
  KbNotReadyError: class extends Error {},
}));
vi.mock("@/server/content-gen/shared/generation-log", () => ({
  logStep: vi.fn(async () => undefined),
  logStepError: vi.fn(async () => undefined),
  logGeneration: vi.fn(async () => undefined),
}));
vi.mock("@/server/content-gen/template-resolver", () => ({
  resolveTemplateOverride: async () => null,
}));
vi.mock("@/server/content-gen/lib/keyword-lock", () => ({
  acquireKeywordLock: vi.fn(async () => true),
  releaseKeywordLock: vi.fn(async () => undefined),
  KEYWORD_LOCK_TTL_SEC: 1800,
}));
vi.mock("@/server/content-gen/providers/blog-claude-ledger", () => ({
  coutCumuleJobUsd: async () => {
    h.state.appelsCout += 1;
    return h.state.appelsCout >= h.state.depasseDepuis ? 3.5 : h.state.cout;
  },
}));
vi.mock("@/server/content-gen/strategie/carte-requetes-source", () => ({
  chargerCarteRequetes: vi.fn(async () => ({})),
}));
vi.mock("@/server/content-gen/equipe/strategie", () => ({
  produireBrief: vi.fn(async () => {
    h.ordre.push("strateg");
    return {
      statut: "brief",
      coutUsd: 0.02,
      brief: { motCle: "ia pme", entites: [], questions: [] },
    };
  }),
}));
vi.mock("@/server/content-gen/equipe/gardien", () => ({
  decider: vi.fn(async () => {
    h.ordre.push("gardien");
    return { decision: "feu_vert", raison: "ok" };
  }),
}));
vi.mock("@/server/content-gen/generators", async () => {
  const { verifierPlafondJob } = await import("@/server/content-gen/providers/plafond-job");
  return {
    getGenerator: () => ({
      generate: vi.fn(async (input: unknown) => {
        h.ordre.push("generateur");
        h.state.garde = await verifierPlafondJob("job-1").then(
          () => "ok",
          (e: Error) => `refus : ${e.message}`,
        );
        throw Object.assign(new Error("STOP-TEST"), { entree: input });
      }),
    }),
  };
});
vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: async (_k: string, def: unknown) => def,
}));
vi.mock("@/server/qualiopi/config/financing", () => ({ financementPublicCitable: () => false }));
vi.mock("@/server/content-gen/shared/content-gen-alerts", () => ({
  alertKbNotReady: vi.fn(),
  alertBatchFail: vi.fn(),
  alertNewReview: vi.fn(),
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("./../content-quality-improver-worker", () => ({ addQualityLoopSpend: vi.fn() }));

import { startContentGenWorker } from "../content-gen-worker";
import { produireBrief } from "@/server/content-gen/equipe/strategie";
import { decider } from "@/server/content-gen/equipe/gardien";
import { chargerCarteRequetes } from "@/server/content-gen/strategie/carte-requetes-source";
import { releaseKeywordLock } from "@/server/content-gen/lib/keyword-lock";
import { verifierPlafondJob } from "@/server/content-gen/providers/plafond-job";

const ENV_SAUVEES = { ...process.env };

function lancer() {
  startContentGenWorker();
  const proc = h.state.processeur;
  if (!proc) throw new Error("processeur non capturé");
  return proc({
    data: {
      contentGenJobId: "job-1",
      contentType: "blog_article",
      targetSearchIntent: "informational",
      inputPayload: { primaryKeyword: "ia pme" },
    },
  });
}

type ErreurTest = Error & { entree?: { improvementFeedback?: string } };
/** Lance le job et rend l'erreur levée (le générateur simulé en lève toujours une). */
async function lancerEtCapter(): Promise<ErreurTest> {
  try {
    await lancer();
  } catch (e) {
    return e as ErreurTest;
  }
  throw new Error("le job aurait dû lever STOP-TEST");
}

beforeEach(() => {
  h.ordre.length = 0;
  h.state.cout = 0;
  h.state.depasseDepuis = Infinity;
  h.state.appelsCout = 0;
  h.prisma.contentGenJob.findUnique.mockResolvedValue({
    id: "job-1",
    campaignId: null,
    templateId: null,
    idempotencyKey: null,
    inputPayload: { primaryKeyword: "ia pme" },
    outputJsonRaw: null,
    anchorVilleSlug: null,
    anchorDepartementCode: null,
    anchorRegionSlug: null,
    targetAudienceSize: null,
    targetAudienceOrganisation: null,
    correlationId: null,
    qualityImprovementAttempts: 0,
  });
  h.prisma.contentGenJob.update.mockClear();
  vi.mocked(produireBrief).mockClear();
  vi.mocked(decider).mockClear();
  vi.mocked(chargerCarteRequetes)
    .mockReset()
    .mockResolvedValue({} as never);
  vi.mocked(releaseKeywordLock).mockClear();
  process.env["REDIS_URL"] = "redis://127.0.0.1:6399";
  process.env["CONTENT_GEN_BLOG_CLAUDE"] = "true";
  process.env["CONTENT_EQUIPE_EDITORIALE"] = "true";
});
afterEach(() => {
  process.env = { ...ENV_SAUVEES };
});

const miseAJours = () =>
  (
    h.prisma.contentGenJob.update.mock.calls as unknown as Array<
      [{ data: Record<string, unknown> }]
    >
  ).map((c) => c[0]);

describe("worker content-gen : équipe éditoriale allumée", () => {
  it("enchaîne stratège → gardien → rédaction ; la garde du routeur est posée pendant le job puis retirée", async () => {
    await expect(lancer()).rejects.toThrow("STOP-TEST");
    expect(h.ordre).toEqual(["strateg", "gardien", "generateur"]);
    expect(h.state.garde).toBe("ok");
    await expect(verifierPlafondJob("job-1")).resolves.toBeUndefined();
  });

  it("plafond atteint avant l'écriture : jamais d'appel au rédacteur, journal complet, verrou relâché", async () => {
    // Lectures du coût : stratège (1), phase A (2) → 0 $ ; « plan et rédaction » (3) → 3,5 $.
    h.state.depasseDepuis = 3;
    await lancer();
    expect(h.ordre).toEqual(["strateg", "gardien"]);
    const maj = miseAJours().find((m) => m.data["status"] === "cancelled");
    expect(maj).toBeDefined();
    const journal = (
      maj!.data["outputJsonRaw"] as { equipe: { issue: string; entrees: Array<{ role: string }> } }
    ).equipe;
    expect(journal.issue).toBe("plafond");
    expect(journal.entrees.map((e) => e.role)).toEqual(["strateg", "gardien", "verificateur-a"]);
    expect(releaseKeywordLock).toHaveBeenCalledWith("ia pme");
  });

  it("arrêt du gardien : aucune écriture, verrou relâché, job annulé avec le journal", async () => {
    vi.mocked(decider).mockImplementationOnce(async () => {
      h.ordre.push("gardien");
      return { decision: "ecarter", raison: "doublon" };
    });
    await lancer();
    expect(h.ordre).toEqual(["strateg", "gardien"]);
    const maj = miseAJours().find((m) => m.data["status"] === "cancelled");
    expect(String(maj!.data["errorMessage"])).toContain("doublon");
    expect(releaseKeywordLock).toHaveBeenCalledWith("ia pme");
  });

  it("« réorienter » : l'angle proposé est transmis au rédacteur", async () => {
    vi.mocked(decider).mockImplementationOnce(async () => {
      h.ordre.push("gardien");
      return { decision: "reorienter", angle: "angle TPE du BTP", raison: "FAQ existante" };
    });
    const err = await lancerEtCapter();
    expect(err.entree?.improvementFeedback).toContain("angle TPE du BTP");
  });

  it("la garde du routeur refuse l'appel payant quand le plafond est atteint en cours d'écriture", async () => {
    // Lectures : stratège (1), phase A (2), écriture (3) → 0 $ ; garde du routeur (4) → 3,5 $.
    h.state.depasseDepuis = 4;
    await expect(lancer()).rejects.toThrow("STOP-TEST");
    expect(h.state.garde).toContain("refus : Plafond de 3.00 $ par job atteint");
    await expect(verifierPlafondJob("job-1")).resolves.toBeUndefined();
  });

  it("lecture de la carte des requêtes en échec : repli sur le chemin d'avant, pas de job planté", async () => {
    vi.mocked(chargerCarteRequetes).mockRejectedValueOnce(new Error("carte illisible"));
    const err = await lancerEtCapter();
    expect(err.message).toBe("STOP-TEST"); // on est arrivé jusqu'au générateur
    expect(produireBrief).not.toHaveBeenCalled();
    expect(decider).not.toHaveBeenCalled();
    expect(err.entree?.improvementFeedback).toBeUndefined();
  });
});

describe("worker content-gen : équipe éteinte = chemin d'avant", () => {
  it("n'appelle ni la carte, ni le stratège, ni le gardien ; le générateur est appelé sans consigne", async () => {
    delete process.env["CONTENT_EQUIPE_EDITORIALE"];
    const err = await lancerEtCapter();
    expect(err.message).toBe("STOP-TEST");
    expect(h.ordre).toEqual(["generateur"]);
    expect(h.state.garde).toBe("ok"); // aucune garde posée : l'appel n'est jamais refusé
    expect(chargerCarteRequetes).not.toHaveBeenCalled();
    expect(produireBrief).not.toHaveBeenCalled();
    expect(decider).not.toHaveBeenCalled();
    expect(err.entree?.improvementFeedback).toBeUndefined();
    expect(releaseKeywordLock).not.toHaveBeenCalled();
  });
});
