/**
 * @vitest-environment node
 *
 * Formule du Score IA TPE-PME : module pur, partagé navigateur / serveur.
 */
import { describe, it, expect } from "vitest";
import {
  calculerScore,
  tranche,
  POIDS,
  BAREMES,
  SCORE_VERSION,
  type ReponsesScore,
} from "../formule";
import { BAROMETER_QUESTIONS } from "@/content/observatoire/questions";

const MAX: ReponsesScore = {
  maturityLevel: "scaled",
  hasStrategy: "formalized",
  useCases: ["automation", "chatbot", "content"],
  teamTrained: "formal",
  timeSavedPerDay: "gt_3h",
  annualBudget: "gt_100k",
  tools: ["chatgpt", "claude"],
};
const MIN: ReponsesScore = {
  maturityLevel: "none",
  hasStrategy: "none",
  useCases: ["none"],
  teamTrained: "none",
  timeSavedPerDay: "none",
  annualBudget: "zero",
  tools: ["none"],
};

describe("calculerScore", () => {
  it("version figée", () => expect(SCORE_VERSION).toBe("score-ia-pme-v1"));
  it("les poids totalisent 100", () =>
    expect(Object.values(POIDS).reduce((a, b) => a + b, 0)).toBe(100));
  it("borne haute = 100, borne basse = 0", () => {
    expect(calculerScore(MAX).score).toBe(100);
    expect(calculerScore(MIN).score).toBe(0);
  });
  it("« Je ne sais pas » sur le budget renormalise sur 90", () => {
    const r = calculerScore({ ...MAX, annualBudget: "dont_know" });
    expect(r.score).toBe(100);
    expect(r.detail.find((d) => d.critere === "annualBudget")).toBeUndefined();
    // maturité seule à 100, le reste à 0 : 30 / 90 = 33,3 → 33
    const s = calculerScore({ ...MIN, maturityLevel: "scaled", annualBudget: "dont_know" });
    expect(s.score).toBe(33);
  });
  it("« none » est exclusif : ignoré dès qu'un autre usage / outil est coché", () => {
    const a = calculerScore({ ...MIN, useCases: ["none", "chatbot"], tools: ["none", "claude"] });
    const b = calculerScore({ ...MIN, useCases: ["chatbot"], tools: ["claude"] });
    expect(a.score).toBe(b.score);
  });
  it("arrondi demi vers le haut (x,5)", () => {
    // 30*25 = 750 /100 = 7,5 → 8
    expect(calculerScore({ ...MIN, maturityLevel: "exploration" }).score).toBe(8);
    // 15*50 = 750 → 7,5 → 8
    expect(calculerScore({ ...MIN, hasStrategy: "in_progress" }).score).toBe(8);
  });
  it("niveaux", () => {
    expect(calculerScore(MIN).niveau).toBe("Découverte");
    expect(calculerScore({ ...MIN, maturityLevel: "scaled" }).niveau).toBe("Premiers essais"); // 30
    expect(calculerScore({ ...MAX, maturityLevel: "poc" }).niveau).toBe("Structurée"); // 85
    expect(calculerScore(MAX).niveau).toBe("Structurée");
  });
  it("une entrée inconnue n'est jamais acceptée silencieusement", () => {
    expect(() => calculerScore({ ...MAX, maturityLevel: "inconnu" })).toThrow();
  });
});

describe("tranche", () => {
  it.each([
    [0, 0],
    [9, 0],
    [10, 1],
    [99, 9],
    [100, 9],
  ])("tranche(%i) = %i", (s, t) => expect(tranche(s)).toBe(t));
});

describe("barèmes couvrent chaque option de questions.ts", () => {
  const cles = [
    "maturityLevel",
    "hasStrategy",
    "teamTrained",
    "timeSavedPerDay",
    "annualBudget",
  ] as const;
  for (const id of cles) {
    it(`${id} : chaque valeur a un barème`, () => {
      const q = BAROMETER_QUESTIONS.find((x) => x.id === id)!;
      for (const v of q.options ?? []) {
        if (id === "annualBudget" && v === "dont_know") continue; // critère retiré
        expect(Object.keys(BAREMES[id])).toContain(v);
      }
    });
  }
  it("usages et outils : valeurs connues", () => {
    for (const id of ["useCases", "tools"] as const) {
      const q = BAROMETER_QUESTIONS.find((x) => x.id === id)!;
      expect(q.options!.length).toBeGreaterThan(0);
    }
  });
});
