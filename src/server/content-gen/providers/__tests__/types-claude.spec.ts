import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BLOG_TYPES,
  lireTypesClaude,
  tousLesTypes,
  typeClaudeAutorise,
  typesClaudeAutorises,
} from "../types-claude";

afterEach(() => vi.unstubAllEnvs());

describe("lireTypesClaude", () => {
  it.each([[undefined], [""], ["  "], ["blog"], ["BLOG"]])(
    "valeur %j : les 4 types blog (comportement d'avant)",
    (v) => {
      expect([...lireTypesClaude(v)].sort()).toEqual([...BLOG_TYPES].sort());
    },
  );

  it("`tous` : toute l'énumération, y compris qa_derived", () => {
    const t = lireTypesClaude("tous");
    expect(t.size).toBe(tousLesTypes().size);
    expect(t.has("qa_derived")).toBe(true);
    expect(t.has("landing_ville")).toBe(true);
  });

  it("liste : types connus retenus, type inconnu ignoré avec avertissement", () => {
    const avertir = vi.fn();
    const t = lireTypesClaude("landing_ville, nimporte_quoi ,glossary_term", avertir);
    expect([...t].sort()).toEqual(["glossary_term", "landing_ville"]);
    expect(avertir).toHaveBeenCalledTimes(1);
    expect(avertir.mock.calls[0]![0]).toContain("nimporte_quoi");
  });

  it("liste mêlant `blog` et un type : les deux", () => {
    const t = lireTypesClaude("blog,landing_ville");
    expect(t.has("blog_article")).toBe(true);
    expect(t.has("landing_ville")).toBe(true);
    expect(t.has("qa_derived")).toBe(false);
  });

  it("liste sans aucun type connu : ensemble VIDE (jamais « tous »)", () => {
    const t = lireTypesClaude("faux1,faux2", vi.fn());
    expect(t.size).toBe(0);
  });
});

describe("lecture de l'environnement", () => {
  it("variable absente = blog ; relue à chaque appel", () => {
    expect(typeClaudeAutorise("blog_article")).toBe(true);
    expect(typeClaudeAutorise("landing_ville")).toBe(false);
    vi.stubEnv("CONTENT_GEN_CLAUDE_TYPES", "tous");
    expect(typeClaudeAutorise("landing_ville")).toBe(true);
    expect(typesClaudeAutorises().size).toBe(tousLesTypes().size);
  });
});
