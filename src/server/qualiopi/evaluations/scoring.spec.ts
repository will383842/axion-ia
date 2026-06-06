/**
 * Tests — scoring.ts (T9, logique pure).
 *
 * Aucun mock nécessaire : module sans dépendances Prisma/next.
 */

import { describe, it, expect } from "vitest";
import { computeEvaluationScore, niveauFromScore, reussiteFromScore } from "./scoring";

// ────────────────────────────────────────────────────────────────
// computeEvaluationScore
// ────────────────────────────────────────────────────────────────

describe("computeEvaluationScore", () => {
  it("calcule correctement quand toutes les compétences sont notées", () => {
    const result = computeEvaluationScore([{ note: 3 }, { note: 2 }, { note: 1 }]);
    expect(result.scoreObtenu).toBe(6);
    expect(result.scoreMax).toBe(9);
    expect(result.scorePct).toBe(67); // round(6/9*100) = 67
  });

  it("retourne scoreMax = nb_compétences × 3 même avec notes absentes", () => {
    const result = computeEvaluationScore([{ note: 3 }, {}, { note: 2 }]);
    expect(result.scoreMax).toBe(9);
    expect(result.scoreObtenu).toBe(5); // 3 + 0 + 2
    expect(result.scorePct).toBe(56); // round(5/9*100)
  });

  it("retourne scorePct = 0 si scoreMax = 0 (liste vide)", () => {
    const result = computeEvaluationScore([]);
    expect(result.scoreObtenu).toBe(0);
    expect(result.scoreMax).toBe(0);
    expect(result.scorePct).toBe(0);
  });

  it("retourne 100 % quand toutes les notes sont 3", () => {
    const result = computeEvaluationScore([{ note: 3 }, { note: 3 }, { note: 3 }]);
    expect(result.scorePct).toBe(100);
  });

  it("retourne 0 % quand toutes les notes sont absentes", () => {
    const result = computeEvaluationScore([{}, {}, {}]);
    expect(result.scoreObtenu).toBe(0);
    expect(result.scoreMax).toBe(9);
    expect(result.scorePct).toBe(0);
  });

  it("arrondit correctement le pourcentage (round half-up)", () => {
    // 1 compétence notée 1 sur 3 : 1/3 * 100 = 33.33 → 33
    const result = computeEvaluationScore([{ note: 1 }]);
    expect(result.scorePct).toBe(33);
  });
});

// ────────────────────────────────────────────────────────────────
// niveauFromScore
// ────────────────────────────────────────────────────────────────

describe("niveauFromScore", () => {
  it("retourne 'non_acquis' si scorePct < 50", () => {
    expect(niveauFromScore(0)).toBe("non_acquis");
    expect(niveauFromScore(49)).toBe("non_acquis");
  });

  it("retourne 'partiellement_acquis' si scorePct entre 50 et 80 inclus", () => {
    expect(niveauFromScore(50)).toBe("partiellement_acquis");
    expect(niveauFromScore(70)).toBe("partiellement_acquis");
    expect(niveauFromScore(80)).toBe("partiellement_acquis");
  });

  it("retourne 'acquis' si scorePct > 80", () => {
    expect(niveauFromScore(81)).toBe("acquis");
    expect(niveauFromScore(100)).toBe("acquis");
  });
});

// ────────────────────────────────────────────────────────────────
// reussiteFromScore
// ────────────────────────────────────────────────────────────────

describe("reussiteFromScore", () => {
  it("retourne true si scorePct >= seuil", () => {
    expect(reussiteFromScore(70, 70)).toBe(true);
    expect(reussiteFromScore(100, 70)).toBe(true);
    expect(reussiteFromScore(71, 70)).toBe(true);
  });

  it("retourne false si scorePct < seuil", () => {
    expect(reussiteFromScore(69, 70)).toBe(false);
    expect(reussiteFromScore(0, 70)).toBe(false);
  });

  it("fonctionne avec des seuils personnalisés", () => {
    expect(reussiteFromScore(50, 50)).toBe(true);
    expect(reussiteFromScore(49, 50)).toBe(false);
    expect(reussiteFromScore(100, 100)).toBe(true);
    expect(reussiteFromScore(99, 100)).toBe(false);
  });
});
