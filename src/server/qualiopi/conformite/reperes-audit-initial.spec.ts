/**
 * Le régime de l'audit initial : UNE constante, recopiée de sa source
 * (`_AUDIT/AUDIT-QUALIOPI-CERTIFICATION-2026-07/phase1-sources/
 * 06-deroulement-audit-initial.md`, § 7) et vérifiée ici à l'identique.
 */
import { describe, expect, it } from "vitest";

import {
  INDICATEURS_AUDIT_INITIAL_PROCESSUS,
  MENTION_AUDIT_INITIAL,
  PRECISION_INDICATEUR_12,
  reperesDeLecture,
} from "./reperes-audit-initial";
import { INDICATEURS_RNQ } from "./indicateurs-registre";

describe("régime de l'audit initial (arrêté du 6 juin 2019, art. 1)", () => {
  it("la constante est la liste du texte, à l'identique — 11 indicateurs", () => {
    expect([...INDICATEURS_AUDIT_INITIAL_PROCESSUS]).toEqual([
      2, 3, 11, 13, 14, 19, 22, 24, 25, 26, 32,
    ]);
  });

  it("chaque numéro existe au registre RNQ", () => {
    const numeros = INDICATEURS_RNQ.map((i) => i.numero);
    for (const n of INDICATEURS_AUDIT_INITIAL_PROCESSUS) expect(numeros).toContain(n);
  });

  it("la mention est sobre et dit les deux temps", () => {
    expect(MENTION_AUDIT_INITIAL).toBe(
      "À l'audit initial, l'auditeur vérifie que le processus est défini et formalisé ; la mise en œuvre est vérifiée à l'audit de surveillance.",
    );
  });

  it("un indicateur NON APPLICABLE ne porte aucun repère, même cité par le texte", () => {
    for (const n of [3, 13, 14]) expect(reperesDeLecture(n, "non_applicable")).toEqual([]);
  });

  it("les applicables cités portent la mention ; les autres non", () => {
    for (const n of [2, 11, 19, 22, 24, 25, 26, 32]) {
      expect(reperesDeLecture(n, "a_completer")).toEqual([MENTION_AUDIT_INITIAL]);
      expect(reperesDeLecture(n, "couvert")).toEqual([MENTION_AUDIT_INITIAL]);
    }
    for (const n of [1, 4, 9, 10, 21, 30, 31])
      expect(reperesDeLecture(n, "a_completer")).toEqual([]);
  });

  it("indicateur 12 : la précision du guide de lecture, sans régime d'audit initial", () => {
    expect(reperesDeLecture(12, "a_completer")).toEqual([PRECISION_INDICATEUR_12]);
    expect(PRECISION_INDICATEUR_12).toMatch(/plus de deux jours/);
  });
});
