/**
 * Tests — adversarial-critique.ts
 *
 * Stratégie : mocker `@/server/content-gen/providers/anthropic` pour ne pas
 * faire de vrais appels IA.
 *
 * Vérifie :
 * - scoreGlobal = moyenne arrondie des 5 angles
 * - verdict OK/ATTENTION/CRITIQUE selon scoreGlobal
 * - cas parse fail → verdict CRITIQUE + score 0
 * - cas erreur provider → verdict CRITIQUE + score 0
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock anthropicProvider ────────────────────────────────────────────────────
// vi.mock est hoisted — ne PAS référencer une variable externe dans la factory.

vi.mock("@/server/content-gen/providers/anthropic", () => ({
  anthropicProvider: {
    key: "anthropic",
    supportedRoles: ["text"],
    generate: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
  },
}));

// Import APRÈS le mock (hoisting assure que le mock est en place avant l'import)
import { runAdversarialCritique } from "./adversarial-critique";
import { anthropicProvider } from "@/server/content-gen/providers/anthropic";

// Référence typée vers le mock (résolu après hoisting)
const mockGenerate = vi.mocked(anthropicProvider.generate);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAnthropicResponse(anglesScores: Record<string, number>) {
  const body = {
    engagement: { score: anglesScores["engagement"] ?? 7, critique: "Correct.", risques: [] },
    transferabilite: {
      score: anglesScores["transferabilite"] ?? 7,
      critique: "Transférable.",
      risques: ["Risque A"],
    },
    memorisation: {
      score: anglesScores["memorisation"] ?? 7,
      critique: "Mémorisation ok.",
      risques: [],
    },
    adequation_public: {
      score: anglesScores["adequation_public"] ?? 7,
      critique: "Public adapté.",
      risques: [],
    },
    realisme_exercices: {
      score: anglesScores["realisme_exercices"] ?? 7,
      critique: "Exercices réalistes.",
      risques: [],
    },
    points_forts: ["Structure claire", "Objectifs précis"],
    axes_amelioration: ["Ajouter synthèses intermédiaires"],
  };

  return {
    provider: "anthropic" as const,
    model: "claude-sonnet-4-6",
    output: JSON.stringify(body),
    tokensInput: 500,
    tokensOutput: 300,
    costUsd: 0.005,
    durationMs: 1200,
  };
}

const BASE_INPUT = {
  formationId: "test-formation-001",
  structure: "Module 1 : Introduction (20 min)\nModule 2 : Pratique (40 min)",
  persona: { niveau: "débutant", secteur: "IT" },
  backwardDesign: { objectifs: ["Comprendre les bases"], evaluations: ["QCM final"] },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runAdversarialCritique — scoreGlobal + verdict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scoreGlobal = moyenne arrondie des 5 angles", async () => {
    // Scores : 8, 6, 7, 9, 5 → moyenne = 35/5 = 7 → ATTENTION
    mockGenerate.mockResolvedValueOnce(
      makeAnthropicResponse({
        engagement: 8,
        transferabilite: 6,
        memorisation: 7,
        adequation_public: 9,
        realisme_exercices: 5,
      }),
    );

    const result = await runAdversarialCritique(BASE_INPUT);
    expect(result.scoreGlobal).toBe(7);
    expect(result.verdict).toBe("ATTENTION");
  });

  it("scoreGlobal >= 8 → verdict OK", async () => {
    // Scores : 8, 8, 9, 8, 8 → moyenne = 41/5 = 8.2 → arrondi = 8 → OK
    mockGenerate.mockResolvedValueOnce(
      makeAnthropicResponse({
        engagement: 8,
        transferabilite: 8,
        memorisation: 9,
        adequation_public: 8,
        realisme_exercices: 8,
      }),
    );

    const result = await runAdversarialCritique(BASE_INPUT);
    expect(result.scoreGlobal).toBeGreaterThanOrEqual(8);
    expect(result.verdict).toBe("OK");
  });

  it("scoreGlobal < 6 → verdict CRITIQUE", async () => {
    // Scores : 3, 4, 2, 5, 4 → moyenne = 18/5 = 3.6 → arrondi = 4 → CRITIQUE
    mockGenerate.mockResolvedValueOnce(
      makeAnthropicResponse({
        engagement: 3,
        transferabilite: 4,
        memorisation: 2,
        adequation_public: 5,
        realisme_exercices: 4,
      }),
    );

    const result = await runAdversarialCritique(BASE_INPUT);
    expect(result.scoreGlobal).toBeLessThan(6);
    expect(result.verdict).toBe("CRITIQUE");
  });

  it("scoreGlobal = 6 (limite inférieure ATTENTION) → verdict ATTENTION", async () => {
    // Scores : 6, 6, 6, 6, 6 → moyenne = 6 → ATTENTION
    mockGenerate.mockResolvedValueOnce(
      makeAnthropicResponse({
        engagement: 6,
        transferabilite: 6,
        memorisation: 6,
        adequation_public: 6,
        realisme_exercices: 6,
      }),
    );

    const result = await runAdversarialCritique(BASE_INPUT);
    expect(result.scoreGlobal).toBe(6);
    expect(result.verdict).toBe("ATTENTION");
  });

  it("retourne pointsForts et axesAmelioration extraits", async () => {
    mockGenerate.mockResolvedValueOnce(
      makeAnthropicResponse({
        engagement: 8,
        transferabilite: 8,
        memorisation: 8,
        adequation_public: 8,
        realisme_exercices: 8,
      }),
    );

    const result = await runAdversarialCritique(BASE_INPUT);
    expect(result.pointsForts).toContain("Structure claire");
    expect(result.axesAmelioration).toContain("Ajouter synthèses intermédiaires");
  });

  it("angles contiennent score, critique, risques", async () => {
    mockGenerate.mockResolvedValueOnce(
      makeAnthropicResponse({
        engagement: 7,
        transferabilite: 7,
        memorisation: 7,
        adequation_public: 7,
        realisme_exercices: 7,
      }),
    );

    const result = await runAdversarialCritique(BASE_INPUT);
    expect(result.angles.engagement.score).toBe(7);
    expect(typeof result.angles.engagement.critique).toBe("string");
    expect(Array.isArray(result.angles.engagement.risques)).toBe(true);
    expect(Array.isArray(result.angles.transferabilite.risques)).toBe(true);
  });

  it("score clampé à [0, 10] si IA renvoie hors limites", async () => {
    const body = {
      engagement: { score: 15, critique: "Sur-noté.", risques: [] },
      transferabilite: { score: -3, critique: "Sous-noté.", risques: [] },
      memorisation: { score: 7, critique: "Ok.", risques: [] },
      adequation_public: { score: 7, critique: "Ok.", risques: [] },
      realisme_exercices: { score: 7, critique: "Ok.", risques: [] },
      points_forts: [],
      axes_amelioration: [],
    };
    mockGenerate.mockResolvedValueOnce({
      provider: "anthropic" as const,
      model: "claude-sonnet-4-6",
      output: JSON.stringify(body),
      tokensInput: 100,
      tokensOutput: 100,
      costUsd: 0.001,
      durationMs: 500,
    });

    const result = await runAdversarialCritique(BASE_INPUT);
    expect(result.angles.engagement.score).toBe(10);
    expect(result.angles.transferabilite.score).toBe(0);
  });
});

// ── Tests dégradé ─────────────────────────────────────────────────────────────

describe("runAdversarialCritique — cas dégradés", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parse fail (JSON invalide) → verdict CRITIQUE, score 0", async () => {
    mockGenerate.mockResolvedValueOnce({
      provider: "anthropic" as const,
      model: "claude-sonnet-4-6",
      output: "Ce n'est pas du JSON valide { broken",
      tokensInput: 100,
      tokensOutput: 50,
      costUsd: 0.001,
      durationMs: 500,
    });

    const result = await runAdversarialCritique(BASE_INPUT);
    expect(result.verdict).toBe("CRITIQUE");
    expect(result.scoreGlobal).toBe(0);
  });

  it("parse fail (JSON array) → verdict CRITIQUE, score 0", async () => {
    mockGenerate.mockResolvedValueOnce({
      provider: "anthropic" as const,
      model: "claude-sonnet-4-6",
      output: JSON.stringify([1, 2, 3]),
      tokensInput: 100,
      tokensOutput: 50,
      costUsd: 0.001,
      durationMs: 500,
    });

    const result = await runAdversarialCritique(BASE_INPUT);
    expect(result.verdict).toBe("CRITIQUE");
    expect(result.scoreGlobal).toBe(0);
  });

  it("parse fail avec markdown wrapper → strip et retry réussi", async () => {
    // Le markdown est strippé avant parse
    const body = {
      engagement: { score: 8, critique: "Ok.", risques: [] },
      transferabilite: { score: 8, critique: "Ok.", risques: [] },
      memorisation: { score: 8, critique: "Ok.", risques: [] },
      adequation_public: { score: 8, critique: "Ok.", risques: [] },
      realisme_exercices: { score: 8, critique: "Ok.", risques: [] },
      points_forts: [],
      axes_amelioration: [],
    };
    mockGenerate.mockResolvedValueOnce({
      provider: "anthropic" as const,
      model: "claude-sonnet-4-6",
      output: "```json\n" + JSON.stringify(body) + "\n```",
      tokensInput: 100,
      tokensOutput: 100,
      costUsd: 0.001,
      durationMs: 500,
    });

    const result = await runAdversarialCritique(BASE_INPUT);
    expect(result.verdict).toBe("OK");
    expect(result.scoreGlobal).toBe(8);
  });

  it("erreur provider (throw) → verdict CRITIQUE, score 0, meta model=unknown", async () => {
    mockGenerate.mockRejectedValueOnce(new Error("Anthropic API timeout"));

    const result = await runAdversarialCritique(BASE_INPUT);
    expect(result.verdict).toBe("CRITIQUE");
    expect(result.scoreGlobal).toBe(0);
    expect(result.meta.model).toBe("unknown");
    expect(result.meta.costUsd).toBe(0);
  });

  it("méta contient les champs model/tokensInput/tokensOutput/costUsd", async () => {
    mockGenerate.mockResolvedValueOnce(
      makeAnthropicResponse({
        engagement: 7,
        transferabilite: 7,
        memorisation: 7,
        adequation_public: 7,
        realisme_exercices: 7,
      }),
    );

    const result = await runAdversarialCritique(BASE_INPUT);
    expect(result.meta.model).toBe("claude-sonnet-4-6");
    expect(result.meta.tokensInput).toBe(500);
    expect(result.meta.tokensOutput).toBe(300);
    expect(result.meta.costUsd).toBe(0.005);
  });
});
