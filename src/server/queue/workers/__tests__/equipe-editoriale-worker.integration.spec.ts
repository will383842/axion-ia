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
    /** « stop » : le générateur lève STOP-TEST ; « ok » : il rend un article. */
    generateur: "stop" as "stop" | "ok",
    /** Registre : fait échouer la lecture à partir du N-ième appel. */
    echecCoutDepuis: Infinity,
    /** Décision du rédacteur en chef simulé. */
    decisionChef: { type: "publier" } as Record<string, unknown>,
    depensesBoucle: [] as number[],
  };
  const prisma = {
    contentGenJob: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
    reviewQueue: {
      create: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
      findUnique: vi.fn(async () => null),
    },
    coverageCampaign: { findUnique: vi.fn(async () => null) },
  };
  /** Tout ce que le worker lit en plus (articles voisins, config…) : vide par défaut. */
  const defauts = new Proxy(prisma as Record<string, unknown>, {
    get(cible, nom: string) {
      if (nom in cible) return cible[nom];
      return new Proxy(
        {},
        {
          get: (_t, methode: string) => async () =>
            methode === "count" ? 0 : methode.startsWith("findMany") ? [] : null,
        },
      );
    },
  });
  const articleTest = {
    title: "Titre de test",
    metaTitle: "Méta titre",
    metaDescription: "Méta description",
    slug: "titre-de-test",
    directAnswer: "Réponse directe. ".repeat(12),
    bodyHtml: "<h2>Un</h2><p>Corps de test.</p>",
    bodyText: "Corps de test.",
    faq: [],
    tags: [],
    indexationTier: "tier_2",
    qualityScore: 90,
    seoScore: 90,
    readabilityScore: 90,
    wordCount: 900,
    readingTimeMinutes: 4,
    totalTokens: 100,
    totalCostUsd: 0.5,
    citations: [],
  };
  return { ordre, state, prisma: defauts as unknown as typeof prisma, articleTest };
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
    if (h.state.appelsCout >= h.state.echecCoutDepuis) throw new Error("registre muet");
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
        if (h.state.generateur === "ok") return { ...h.articleTest };
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
vi.mock("./../content-quality-improver-worker", () => ({
  addQualityLoopSpend: vi.fn(async (usd: number) => {
    h.state.depensesBoucle.push(usd);
  }),
}));
// Circuit complet : adaptateurs des rôles simulés (leur propre logique est testée ailleurs).
vi.mock("@/server/content-gen/equipe/circuit-article", () => ({
  mailler: vi.fn(async (o: unknown) => {
    h.ordre.push("mailleur");
    return { output: o, decision: "maillé", liens: [] };
  }),
  editerSeoSortie: vi.fn(async (_j: string, o: unknown) => {
    h.ordre.push("editeur-seo");
    return { output: o, decision: "édité" };
  }),
  conformiteSortie: vi.fn(async () => {
    h.ordre.push("conformite");
    return { decision: "conforme", constats: [], coutUsd: 0 };
  }),
  enChefSortie: vi.fn(async () => {
    h.ordre.push("redacteur-en-chef");
    return { decision: h.state.decisionChef, coutJugeUsd: 0.1 };
  }),
  consigneRenvoi: () => "consigne de renvoi",
}));
vi.mock("@/server/content-gen/fact-check/verificateur-deux-phases", () => ({
  constituerDossierPreuves: vi.fn(async () => null),
  PLAFOND_RECHERCHES_PHASE_A: 6,
}));
vi.mock("@/server/content-gen/images/select-hero-image", () => ({
  selectHeroImage: vi.fn(async () => null),
}));
vi.mock("@/server/content-gen/shared/ensure-direct-answer", () => ({
  ensureDirectAnswer: vi.fn(async () => ({ repaired: false, directAnswer: "", costUsd: 0 })),
}));

import { addQualityLoopSpend } from "../content-quality-improver-worker";
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
  h.state.generateur = "stop";
  h.state.echecCoutDepuis = Infinity;
  h.state.decisionChef = { type: "publier" };
  h.state.depensesBoucle = [];
  vi.mocked(addQualityLoopSpend).mockClear();
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
    expect(releaseKeywordLock).toHaveBeenCalledWith("ia pme", "job-1");
  });

  it("reprise de la boucle qualité arrêtée par le plafond avant l'écriture : relecture, article gardé, verrou gardé", async () => {
    const base = await h.prisma.contentGenJob.findUnique();
    h.prisma.contentGenJob.findUnique.mockResolvedValue({
      ...base,
      outputJsonRaw: { judgeIssues: "à étoffer", titre: "article existant" },
    });
    h.state.depasseDepuis = 4; // reprise : début (1), stratège (2), phase A (3) → 0 $ ; écriture (4) → 3,5 $
    await lancer();
    const maj = miseAJours().find((m) => m.data["status"] === "needs_review");
    expect(maj).toBeDefined();
    expect((maj!.data["outputJsonRaw"] as { titre?: string }).titre).toBe("article existant");
    expect(h.prisma.reviewQueue.create).toHaveBeenCalled();
    expect(releaseKeywordLock).not.toHaveBeenCalled();
    expect(h.ordre).not.toContain("generateur");
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
    expect(releaseKeywordLock).toHaveBeenCalledWith("ia pme", "job-1");
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

const jobEnReprise = async (equipe?: Record<string, unknown>) => {
  const base = await h.prisma.contentGenJob.findUnique();
  h.prisma.contentGenJob.findUnique.mockResolvedValue({
    ...base,
    outputJsonRaw: { judgeIssues: "à étoffer", titre: "article existant", equipe },
  });
};
const sortiePersistee = (statut: string) => {
  const maj = miseAJours().find((m) => m.data["status"] === statut);
  expect(maj).toBeDefined();
  return maj!.data;
};

describe("worker content-gen : restes de la relecture (3e passe)", () => {
  it("1. l'angle du gardien persisté est réutilisé à la reprise de la boucle qualité", async () => {
    await jobEnReprise({
      brief: { motCle: "ia pme", entites: [], questions: [] },
      angle: "angle TPE",
    });
    const err = await lancerEtCapter();
    expect(err.entree?.improvementFeedback).toContain("angle TPE");
    expect(decider).not.toHaveBeenCalled(); // le gardien n'est pas rejoué
  });

  it("1. l'angle (et le brief) survivent à un arrêt de reprise : journal conservé pour la reprise suivante", async () => {
    await jobEnReprise({
      brief: { motCle: "ia pme", entites: [], questions: [] },
      angle: "angle TPE",
    });
    h.state.depasseDepuis = 4;
    await lancer();
    const equipe = (
      sortiePersistee("needs_review")["outputJsonRaw"] as {
        equipe: { angle?: string; brief?: unknown; issue: string };
      }
    ).equipe;
    expect(equipe.issue).toBe("plafond");
    expect(equipe.angle).toBe("angle TPE");
    expect(equipe.brief).toBeDefined();
  });

  it("4. un arrêt anticipé en reprise compte la dépense de la boucle qualité", async () => {
    await jobEnReprise();
    h.state.depasseDepuis = 4;
    await lancer();
    expect(addQualityLoopSpend).toHaveBeenCalledTimes(1);
    expect(h.state.depensesBoucle[0]).toBeGreaterThan(0); // brief du stratège compté, au moins
  });

  it("4. hors reprise, un arrêt anticipé ne touche pas au compteur de la boucle qualité", async () => {
    h.state.depasseDepuis = 3;
    await lancer();
    expect(addQualityLoopSpend).not.toHaveBeenCalled();
  });

  it("6. erreur transitoire du stratège : relancée telle quelle (BullMQ réessaie), rien d'écrit, journal gardé", async () => {
    vi.mocked(produireBrief).mockRejectedValueOnce(new Error("réseau coupé"));
    const err = await lancerEtCapter();
    expect(err.name).toBe("ErreurEquipeTransitoire");
    expect(err.message).toContain("réseau coupé");
    expect(h.ordre).toEqual([]); // ni gardien ni rédaction
    expect(miseAJours().some((m) => m.data["status"] === "cancelled")).toBe(false);
    const equipe = (
      miseAJours().find((m) => m.data["outputJsonRaw"])!.data["outputJsonRaw"] as {
        equipe: { entrees: Array<{ role: string; decision: string }> };
      }
    ).equipe;
    expect(equipe.entrees[0]).toMatchObject({ role: "strateg", decision: "erreur" });
  });

  it("6. erreur transitoire du gardien : relancée, aucune écriture", async () => {
    vi.mocked(decider).mockRejectedValueOnce(new Error("délai dépassé"));
    const err = await lancerEtCapter();
    expect(err.name).toBe("ErreurEquipeTransitoire");
    expect(h.ordre).not.toContain("generateur");
  });

  it("7. lecture du registre en échec dans la garde du routeur : journal d'équipe rempli avant l'échec", async () => {
    // Lectures : stratège (1), phase A (2), écriture (3) ; garde du routeur (4) → échec.
    h.state.echecCoutDepuis = 4;
    await expect(lancer()).rejects.toThrow("STOP-TEST");
    expect(h.state.garde).toContain("refus : registre muet");
    const avecJournal = miseAJours().find((m) => m.data["outputJsonRaw"]);
    expect(avecJournal).toBeDefined();
    const equipe = (
      avecJournal!.data["outputJsonRaw"] as {
        equipe: { entrees: Array<{ role: string }> };
      }
    ).equipe;
    expect(equipe.entrees.map((e) => e.role)).toEqual([
      "strateg",
      "gardien",
      "verificateur-a",
      "plan-redaction",
    ]);
    // L'échec du job vient APRÈS l'écriture du journal.
    const ordreMaj = miseAJours().map((m) =>
      m.data["outputJsonRaw"] ? "journal" : m.data["status"],
    );
    expect(ordreMaj.indexOf("journal")).toBeLessThan(ordreMaj.lastIndexOf("failed"));
  });
});

describe("worker content-gen : circuit complet (équipe allumée)", () => {
  beforeEach(() => {
    h.state.generateur = "ok";
  });

  it("publication : tous les rôles dans l'ordre, journal et brief persistés, barrière absente", async () => {
    await lancer();
    expect(h.ordre).toEqual([
      "strateg",
      "gardien",
      "generateur",
      "mailleur",
      "editeur-seo",
      "conformite",
      "redacteur-en-chef",
    ]);
    const sortie = miseAJours().find((m) => m.data["outputJsonRaw"] && m.data["qualityScore"]);
    expect(sortie).toBeDefined();
    const brut = sortie!.data["outputJsonRaw"] as {
      equipe: { issue: string; entrees: Array<{ role: string }>; brief?: unknown };
    };
    expect(brut.equipe.issue).toBe("publier");
    expect(brut.equipe.brief).toBeDefined();
    expect(brut.equipe.entrees.map((e) => e.role)).toEqual([
      "strateg",
      "gardien",
      "verificateur-a",
      "plan-redaction",
      "verificateur-b",
      "mailleur",
      "editeur-seo",
      "conformite",
      "redacteur-en-chef",
    ]);
    expect(JSON.stringify(brut)).not.toContain("equipe-editoriale");
  });

  it("abandon du rédacteur en chef après écriture : barrière en relecture, journal persisté, verrou GARDÉ", async () => {
    h.state.decisionChef = { type: "arret", blockCauses: ["hors sujet"] };
    await lancer();
    const sortie = miseAJours().find((m) => m.data["outputJsonRaw"] && m.data["qualityScore"]);
    expect(sortie).toBeDefined();
    expect(sortie!.data["status"]).toBe("needs_review");
    const texte = JSON.stringify(sortie!.data["outputJsonRaw"]);
    expect(texte).toContain("equipe-editoriale");
    expect(texte).toContain("hors sujet");
    expect((sortie!.data["outputJsonRaw"] as { equipe: { issue: string } }).equipe.issue).toBe(
      "ecarte",
    );
    expect(releaseKeywordLock).not.toHaveBeenCalled();
  });

  it("5. costUsd = max(somme déclarée, registre de l'exécution), jamais les deux additionnés", async () => {
    h.state.cout = 1.2; // registre : 1,2 $ ; somme déclarée : 0,02 + 0,5 + 0,1
    await lancer();
    const sortie = miseAJours().find((m) => m.data["outputJsonRaw"] && m.data["qualityScore"]);
    expect(sortie!.data["costUsd"]).toBe(1.2);
  });

  it("5. reprise : le registre des passes précédentes n'est pas recompté dans costUsd", async () => {
    await jobEnReprise({ brief: { motCle: "ia pme", entites: [], questions: [] } });
    h.state.cout = 2.0; // registre déjà à 2 $ au début de l'exécution (passes d'avant)
    await lancer();
    const sortie = miseAJours().find((m) => m.data["outputJsonRaw"] && m.data["qualityScore"]);
    expect(sortie!.data["costUsd"] as number).toBeLessThan(1);
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
