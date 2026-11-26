/**
 * Script ponctuel d'un article d'essai Claude en brouillon : il ne doit JAMAIS
 * pouvoir publier. On prouve : refus sans drapeau, aucune file, aucune publication,
 * statut du job non publiable, et estimation sous le plafond de 3 $.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { jobCreate, jobUpdate, bullQueueCtor, revalidatePath, reviewCreate, articleCreate } =
  vi.hoisted(() => ({
    jobCreate: vi.fn(),
    jobUpdate: vi.fn(),
    bullQueueCtor: vi.fn(),
    revalidatePath: vi.fn(),
    reviewCreate: vi.fn(),
    articleCreate: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentGenJob: { create: jobCreate, update: jobUpdate },
    reviewQueue: { create: reviewCreate, upsert: reviewCreate },
    article: { create: articleCreate },
    costLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { costUsd: 0.2 } }) },
    $disconnect: vi.fn(),
  },
}));
vi.mock("bullmq", () => ({
  Queue: bullQueueCtor,
  Worker: bullQueueCtor,
  UnrecoverableError: class extends Error {},
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/server/content-gen/generators/blog-from-title", () => ({
  blogFromTitleGenerator: { generate: vi.fn() },
}));

import {
  lancerEssai,
  estimerCoutMaxUsd,
  PLAFOND_ESTIMATION_USD,
  PREFIXE_CLE,
  STATUT_FINAL,
  RETRY_MAXIMUM,
  type DepsEssai,
} from "../../../../scripts/content-gen/essai-blog-claude-brouillon";

const TITRE = "Comment un dirigeant de PME cadre un premier projet d'IA";

function sortie() {
  return {
    title: TITRE,
    metaDescription: "m",
    directAnswer: "d",
    bodyHtml: "<h2>x</h2><p>corps</p>",
    faq: [{ question: "q", answer: "a" }],
    wordCount: 900,
    qualityScore: 80,
    totalCostUsd: 0.2,
  };
}

function deps(over: Partial<DepsEssai> = {}): DepsEssai {
  return {
    creerJob: vi.fn().mockResolvedValue("job1"),
    generer: vi.fn().mockResolvedValue(sortie()),
    enregistrer: vi.fn().mockResolvedValue(undefined),
    marquerEchec: vi.fn().mockResolvedValue(undefined),
    coutReel: vi.fn().mockResolvedValue(0.2),
    ecrireFichier: vi.fn(),
    ...over,
  } as DepsEssai;
}

const ENV_OK = { CONTENT_GEN_BLOG_CLAUDE: "true" } as unknown as NodeJS.ProcessEnv;

beforeEach(() => {
  vi.clearAllMocks();
  process.env["CONTENT_GEN_BLOG_CLAUDE"] = "true";
  delete process.env["CONTENT_GEN_CLAUDE_TYPES"];
});

describe("essai blog Claude en brouillon", () => {
  it("refuse sans drapeau : rien n'est créé ni généré", async () => {
    const d = deps();
    await expect(lancerEssai(TITRE, d, {} as unknown as NodeJS.ProcessEnv)).rejects.toThrow(
      /CONTENT_GEN_BLOG_CLAUDE/,
    );
    await expect(
      lancerEssai(TITRE, d, { CONTENT_GEN_BLOG_CLAUDE: "1" } as unknown as NodeJS.ProcessEnv),
    ).rejects.toThrow();
    expect(d.creerJob).not.toHaveBeenCalled();
    expect(d.generer).not.toHaveBeenCalled();
  });

  it("refuse sans titre", async () => {
    const d = deps();
    await expect(lancerEssai(undefined, d, ENV_OK)).rejects.toThrow(/titre/);
    await expect(lancerEssai("court", d, ENV_OK)).rejects.toThrow(/titre/);
    expect(d.creerJob).not.toHaveBeenCalled();
  });

  it("refuse si le type n'est pas autorisé via Claude (sinon OpenAI écrirait en silence)", async () => {
    process.env["CONTENT_GEN_CLAUDE_TYPES"] = "faq_standalone";
    const d = deps();
    await expect(lancerEssai(TITRE, d, ENV_OK)).rejects.toThrow(/non autorisé|n'est pas autorisé/);
    expect(d.generer).not.toHaveBeenCalled();
  });

  it("l'estimation du pire cas reste sous 3 $", () => {
    expect(estimerCoutMaxUsd()).toBeLessThanOrEqual(PLAFOND_ESTIMATION_USD);
  });

  it("chemin nominal : aucune file, aucune publication, statut final non publiable", async () => {
    const d = deps();
    const r = await lancerEssai(TITRE, d, ENV_OK);
    expect(r.jobId).toBe("job1");
    expect(r.mots).toBe(900);
    expect(r.coutReelUsd).toBe(0.2);
    expect(d.creerJob).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(new RegExp(`^${PREFIXE_CLE}`)),
      }),
    );
    expect(d.enregistrer).toHaveBeenCalledTimes(1);
    expect(d.ecrireFichier).toHaveBeenCalledWith(
      "/tmp/essai-job1.html",
      expect.stringContaining("noindex"),
    );
    expect(bullQueueCtor).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(reviewCreate).not.toHaveBeenCalled();
    expect(articleCreate).not.toHaveBeenCalled();
    expect(["cancelled", "failed"]).toContain(STATUT_FINAL);
    expect(STATUT_FINAL).toBe("cancelled");
    expect(RETRY_MAXIMUM).toBeGreaterThanOrEqual(10);
  });

  it("échec de génération : job marqué, jamais publiable, erreur remontée", async () => {
    const d = deps({ generer: vi.fn().mockRejectedValue(new Error("plafond_jour")) });
    await expect(lancerEssai(TITRE, d, ENV_OK)).rejects.toThrow(/génération échouée/);
    expect(d.marquerEchec).toHaveBeenCalledTimes(1);
    expect(d.enregistrer).not.toHaveBeenCalled();
  });

  it("les écritures réelles ne changent jamais le statut au-delà de cancelled", async () => {
    // Les deps réelles passent par prisma (mocké) : on les exerce via un import dynamique du module.
    const mod = await import("../../../../scripts/content-gen/essai-blog-claude-brouillon");
    expect(mod.STATUT_FINAL).toBe("cancelled");
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("scripts/content-gen/essai-blog-claude-brouillon.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // Aucune écriture de statut hors de la création, aucun import de file / publication.
    expect(src).not.toMatch(/status:\s*"(approved|needs_review|published|queued|publishing)"/);
    expect(src).not.toMatch(/from "bullmq"|revalidatePath|indexnow|reviewQueue|enqueue/i);
    expect((src.match(/status:/g) ?? []).length).toBe(1);
  });
});

describe("garde-fous contre le rejeu et plafond par job", () => {
  it("estJobEssaiClaude reconnaît la clé et le marqueur", async () => {
    const { estJobEssaiClaude } = await import("@/server/content-gen/essai-claude");
    expect(estJobEssaiClaude({ idempotencyKey: "essai-claude-1" })).toBe(true);
    expect(estJobEssaiClaude({ inputPayload: { essaiClaude: true } })).toBe(true);
    expect(estJobEssaiClaude({ idempotencyKey: "autre", inputPayload: { a: 1 } })).toBe(false);
  });

  it("requeueContentGenJob refuse un job d'essai sans toucher file ni base", async () => {
    const { requeueContentGenJob } = await import("@/server/content-gen/recovery/backlog-recovery");
    const queue = { getJob: vi.fn(), add: vi.fn() };
    const ok = await requeueContentGenJob(queue as never, {
      id: "j",
      contentType: "blog_from_title",
      targetSearchIntent: "informational",
      inputPayload: { essaiClaude: true },
      retryCount: 99,
    });
    expect(ok).toBe(false);
    expect(queue.getJob).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(jobUpdate).not.toHaveBeenCalled();
  });

  it("le job créé porte plafondJobUsd = 3 et statut cancelled ; les update n'écrivent aucun statut", async () => {
    jobCreate.mockResolvedValue({ id: "jx" });
    jobUpdate.mockResolvedValue({});
    const mod = await import("../../../../scripts/content-gen/essai-blog-claude-brouillon");
    const reel = (mod as unknown as { depsReelles: DepsEssai }).depsReelles;
    await reel.creerJob({ idempotencyKey: "essai-claude-x", titre: TITRE });
    const data = jobCreate.mock.calls[0]![0].data;
    expect(data.status).toBe("cancelled");
    expect(data.retryCount).toBe(99);
    expect(data.inputPayload).toMatchObject({ essaiClaude: true, plafondJobUsd: 3 });
    await reel.enregistrer("jx", sortie(), 0.2);
    await reel.marquerEchec("jx", "m");
    for (const c of jobUpdate.mock.calls) expect(c[0].data).not.toHaveProperty("status");
  });
});
