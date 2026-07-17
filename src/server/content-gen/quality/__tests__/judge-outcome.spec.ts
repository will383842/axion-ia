/**
 * Fix 2026-07-17 — routage du verdict du LLM-judge.
 *
 * Bug corrigé : le verdict `publish` tombait dans le `: "needs_review"` final et
 * n'était JAMAIS re-soumis à la décision d'auto-publication → un article validé
 * par le juge dormait indéfiniment dans la file des rejets. Même classe de bug que
 * celui corrigé pour les news le 2026-07-03, resté ouvert pour les autres types.
 */

import { describe, expect, it } from "vitest";
import {
  resolveJudgeOutcome,
  type JudgeOutcomeInput,
} from "@/server/content-gen/quality/judge-outcome";

const base: JudgeOutcomeInput = {
  verdict: "publish",
  judgeRan: true,
  reachedCap: false,
  doctrineCheckPassed: true,
  isRss: false,
  policies: {},
};

describe("resolveJudgeOutcome — le verdict publish n'est plus jeté", () => {
  it("publish → approved (le coeur du fix)", () => {
    expect(resolveJudgeOutcome(base)).toBe("approved");
  });

  it("publish → approved même quand le cap d'itérations est atteint", () => {
    // Le cap ne concerne que la re-génération : un article validé se publie.
    expect(resolveJudgeOutcome({ ...base, reachedCap: true })).toBe("approved");
  });

  it("publish sur une news → approved (toggle newsAutoPublish par défaut ON)", () => {
    expect(resolveJudgeOutcome({ ...base, isRss: true })).toBe("approved");
  });
});

describe("resolveJudgeOutcome — garde-fous conservés", () => {
  it("blockingFail (doctrineCheckPassed=false) → needs_review malgré publish", () => {
    // doctrineCheckPassed persiste `!blockingFail` : dedup sémantique, benefit-gate,
    // plagiat, intent. Un doublon ne doit JAMAIS s'auto-publier.
    expect(resolveJudgeOutcome({ ...base, doctrineCheckPassed: false })).toBe("needs_review");
  });

  it("juge absent (API down) → jamais d'auto-publication", () => {
    expect(resolveJudgeOutcome({ ...base, judgeRan: false })).toBe("needs_review");
  });

  it("factoryAutoPublishAllBlogTypes=false → needs_review", () => {
    expect(
      resolveJudgeOutcome({ ...base, policies: { factoryAutoPublishAllBlogTypes: false } }),
    ).toBe("needs_review");
  });

  it("newsAutoPublish=false → une news validée reste en needs_review", () => {
    expect(
      resolveJudgeOutcome({ ...base, isRss: true, policies: { newsAutoPublish: false } }),
    ).toBe("needs_review");
  });

  it("le toggle blog ne gouverne PAS les news", () => {
    // Une news suit newsAutoPublish, pas factoryAutoPublishAllBlogTypes.
    expect(
      resolveJudgeOutcome({
        ...base,
        isRss: true,
        policies: { factoryAutoPublishAllBlogTypes: false },
      }),
    ).toBe("approved");
  });
});

describe("resolveJudgeOutcome — comportements existants inchangés", () => {
  it("reject → quarantined_critical (priorité sur tout le reste)", () => {
    expect(resolveJudgeOutcome({ ...base, verdict: "reject", doctrineCheckPassed: false })).toBe(
      "quarantined_critical",
    );
  });

  it("improve sous le cap → quality_improving", () => {
    expect(resolveJudgeOutcome({ ...base, verdict: "improve" })).toBe("quality_improving");
  });

  it("improve avec cap atteint → needs_review", () => {
    expect(resolveJudgeOutcome({ ...base, verdict: "improve", reachedCap: true })).toBe(
      "needs_review",
    );
  });

  it("improve sans juge → needs_review (pas de re-génération à l'aveugle)", () => {
    // judge=null ⇒ verdict défaut "improve". Sans le garde `judgeRan`, on
    // re-générerait en boucle sans aucun feedback.
    expect(resolveJudgeOutcome({ ...base, verdict: "improve", judgeRan: false })).toBe(
      "needs_review",
    );
  });

  it("doctrineCheckPassed=null (job ancien) ne bloque pas l'auto-publication", () => {
    expect(resolveJudgeOutcome({ ...base, doctrineCheckPassed: null })).toBe("approved");
  });
});
