/**
 * applySystemPromptOverride : le prompt modèle remplace celui du code,
 * mais reçoit le bloc de positionnement une seule fois.
 */
import { describe, it, expect } from "vitest";
import { applySystemPromptOverride } from "../template-resolver";
import { MARQUEUR_POSITIONNEMENT } from "../brand/positionnement";

function occurrences(texte: string, motif: string): number {
  return texte.split(motif).length - 1;
}

describe("applySystemPromptOverride et positionnement", () => {
  const override = {
    templateId: "tpl-1",
    systemPrompt: "Tu es un rédacteur expert. Rédige un article structuré et factuel.",
  };

  it("ajoute le bloc une seule fois", () => {
    const out = applySystemPromptOverride("prompt code", override, "blog_article");
    expect(occurrences(out, MARQUEUR_POSITIONNEMENT)).toBe(1);
  });

  it("est idempotent si le prompt modèle contient déjà le bloc", () => {
    const premier = applySystemPromptOverride("prompt code", override, "blog_article");
    const second = applySystemPromptOverride(
      "prompt code",
      { templateId: "tpl-2", systemPrompt: premier },
      "blog_article",
    );
    expect(occurrences(second, MARQUEUR_POSITIONNEMENT)).toBe(1);
  });

  it("qa_derived reçoit aussi le bloc dans ce chemin (hors chatbot)", () => {
    const out = applySystemPromptOverride("prompt code", override, "qa_derived");
    expect(occurrences(out, MARQUEUR_POSITIONNEMENT)).toBe(1);
  });

  it("sans override, renvoie le prompt code inchangé", () => {
    expect(applySystemPromptOverride("prompt code", undefined, "blog_article")).toBe("prompt code");
  });
});
