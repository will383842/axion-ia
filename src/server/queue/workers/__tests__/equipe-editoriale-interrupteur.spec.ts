/**
 * PR 12 — l'équipe éditoriale n'existe dans le worker que derrière CONTENT_EQUIPE_EDITORIALE.
 * Éteint = chemin d'avant : aucun rôle de l'équipe n'est construit, et les blocs d'avant
 * (fact-check, fidélité par Claude) ne sont sautés que lorsque l'équipe tourne.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { equipeEditorialeActive } from "@/server/content-gen/fact-check/equipe-editoriale-drapeau";

const SOURCE = readFileSync(join(__dirname, "..", "content-gen-worker.ts"), "utf8");

describe("worker content-gen : interrupteur de l'équipe éditoriale", () => {
  it("l'interrupteur n'est actif que pour la valeur exacte « true »", () => {
    expect(equipeEditorialeActive({})).toBe(false);
    expect(equipeEditorialeActive({ CONTENT_EQUIPE_EDITORIALE: "1" })).toBe(false);
    expect(equipeEditorialeActive({ CONTENT_EQUIPE_EDITORIALE: "TRUE" })).toBe(false);
    expect(equipeEditorialeActive({ CONTENT_EQUIPE_EDITORIALE: "true" })).toBe(true);
  });

  it("le suivi de l'équipe n'est construit que derrière l'interrupteur", () => {
    expect(SOURCE).toMatch(
      /const equipeOrchestree =\s*equipeEditorialeActive\(\) && interrupteurBlogClaude\(\) && typeClaudeAutorise\(contentType\);/,
    );
    expect(SOURCE).toMatch(
      /const suiviEquipe =\s*equipeOrchestree && !carteEchec\s*\? new SuiviEquipe\(/,
    );
    expect(SOURCE).toMatch(/if \(suiviEquipe && briefEquipe\) \{/);
  });

  it("les blocs d'avant ne sont sautés que si l'équipe tourne", () => {
    expect(SOURCE).toContain("if (controleFideliteLlmActif() && !suiviEquipe) {");
    expect(SOURCE).toContain("if (factCheckClaudeActif(contentType) && !suiviEquipe) {");
    // Éteint, la phase A d'avant est appelée comme avant.
    expect(SOURCE).toMatch(
      /else if \(equipeEditorialeActive\(\) && factCheckClaudeActif\(contentType\)\) \{\s*await constituerPhaseA\(\);/,
    );
  });

  it("le journal n'est écrit que s'il existe (clé absente éteint)", () => {
    expect(SOURCE).toContain("...(journalEquipe");
    expect(SOURCE).toContain(
      "equipe: {\n              ...journalEquipe,\n              brief: briefEquipe,",
    );
    // Éteint : le coût du job reste la somme d'avant.
    expect(SOURCE).toContain(": depenseDeclareeUsd;");
  });

  it("le worker de rafraîchissement n'est pas touché par cette PR", () => {
    expect(SOURCE).not.toContain("content-refresh-worker");
  });
});
