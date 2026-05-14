/**
 * KB V4 (Sprint KB-16) — Tests templates + snippets éditeur.
 */

import { describe, expect, it } from "vitest";
import { getAllTemplates, getTemplateForType, type EditorTemplate } from "./editor-templates";
import { EDITOR_SNIPPETS, findSnippetByTrigger } from "./editor-snippets";
import { KB_TYPES } from "./types";
import type { KbType } from "../../../prisma/generated/client";

describe("editor templates", () => {
  it("template par type couvre les principaux V1 + V4", () => {
    const all = getAllTemplates();
    expect(all.length).toBeGreaterThanOrEqual(16);
  });

  it("getTemplateForType retourne fallback pour type inconnu", () => {
    const r = getTemplateForType("__bogus__" as KbType);
    expect(r.html).toContain("<h2>");
  });

  it("chaque template contient au moins un <h2>", () => {
    for (const tpl of getAllTemplates()) {
      expect(tpl.html).toMatch(/<h2/i);
    }
  });

  it("template type=faq a un minWordCount court (≤100)", () => {
    const t = getTemplateForType("faq" as KbType);
    expect(t.minWordCount).toBeLessThanOrEqual(100);
  });

  it("tous les types KB ont au moins le fallback", () => {
    for (const type of KB_TYPES) {
      const t: EditorTemplate = getTemplateForType(type as KbType);
      expect(t.html.length).toBeGreaterThan(0);
    }
  });
});

describe("editor snippets", () => {
  it("au moins 8 snippets disponibles", () => {
    expect(EDITOR_SNIPPETS.length).toBeGreaterThanOrEqual(8);
  });

  it("triggers commencent par /", () => {
    for (const s of EDITOR_SNIPPETS) {
      expect(s.trigger.startsWith("/")).toBe(true);
    }
  });

  it("findSnippetByTrigger retourne le bon snippet", () => {
    expect(findSnippetByTrigger("/callout-info")?.id).toBe("callout-info");
    expect(findSnippetByTrigger("/inexistant")).toBeUndefined();
  });

  it("html des snippets contient au moins un tag fermé", () => {
    for (const s of EDITOR_SNIPPETS) {
      expect(s.html).toMatch(/<\/[a-z]+>/);
    }
  });
});
