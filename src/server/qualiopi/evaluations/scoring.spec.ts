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

  // 🔴 F22 — une compétence non notée SORT du calcul.
  //
  // Elle valait auparavant 0 tout en comptant dans `scoreMax`, donc MOINS qu'un
  // « non acquis » (1) : un oubli de saisie pesait plus lourd qu'un échec
  // déclaré. Elle est désormais reportée séparément sur l'attestation, sous
  // « Non évalués » — visible, donc corrigeable.
  it("F22 : exclut du score les compétences non notées", () => {
    const result = computeEvaluationScore([{ note: 3 }, {}, { note: 2 }]);
    expect(result.scoreMax).toBe(6); // 2 compétences notées × 3
    expect(result.scoreObtenu).toBe(5); // 3 + 2
    expect(result.scorePct).toBe(83); // round(5/6*100)
  });

  it("F22 : un oubli de saisie ne fabrique plus un échec", () => {
    // 3 objectifs « acquis » sur 5, 2 cases sautées. Ancien calcul : 9/15 = 60 %,
    // sous le seuil de 70 % → échec attribué au stagiaire pour une omission du
    // formateur. Nouveau calcul : les 3 notés valent 100 %.
    const result = computeEvaluationScore([{ note: 3 }, { note: 3 }, { note: 3 }, {}, {}]);
    expect(result.scorePct).toBe(100);
    expect(reussiteFromScore(result.scorePct, 70)).toBe(true);
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

  it("retourne 0 % quand aucune compétence n'est notée", () => {
    // `scoreMax` à 0 : aucune évaluation n'a eu lieu. Le distinguer d'un vrai 0 %
    // est le rôle de l'attestation, qui porte alors « Évaluation des acquis non
    // réalisée » plutôt qu'un score.
    const result = computeEvaluationScore([{}, {}, {}]);
    expect(result.scoreObtenu).toBe(0);
    expect(result.scoreMax).toBe(0);
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
