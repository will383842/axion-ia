import { describe, expect, it } from "vitest";
import {
  parseLlmJson,
  parseLlmJsonSafe,
  stripMarkdownFences,
  extractFirstJsonBlock,
} from "../parse-llm-json";

describe("parseLlmJson", () => {
  it("parses raw JSON sans markdown", () => {
    const out = parseLlmJson<{ a: number }>('{"a":1}');
    expect(out.a).toBe(1);
  });

  it("strip ```json fence début + ``` fin", () => {
    const wrapped = '```json\n{"a":1}\n```';
    expect(parseLlmJson<{ a: number }>(wrapped)).toEqual({ a: 1 });
  });

  it("strip ``` simple sans json language tag", () => {
    const wrapped = '```\n{"a":2}\n```';
    expect(parseLlmJson<{ a: number }>(wrapped)).toEqual({ a: 2 });
  });

  it("strip ```JSON majuscule", () => {
    const wrapped = '```JSON\n{"a":3}\n```';
    expect(parseLlmJson<{ a: number }>(wrapped)).toEqual({ a: 3 });
  });

  it("strip whitespace excédentaire avant/après", () => {
    const wrapped = '   ```json\n{"a":4}\n```   ';
    expect(parseLlmJson<{ a: number }>(wrapped)).toEqual({ a: 4 });
  });

  it("throw SyntaxError si JSON invalide post-strip", () => {
    expect(() => parseLlmJson("```json\nnot valid\n```")).toThrow(SyntaxError);
  });

  it("safe variant retourne null sur parse fail", () => {
    expect(parseLlmJsonSafe("```json\nnot valid\n```")).toBeNull();
  });

  it("safe variant retourne objet sur succès", () => {
    expect(parseLlmJsonSafe<{ a: number }>('{"a":5}')).toEqual({ a: 5 });
  });

  it("stripMarkdownFences est idempotent (no-op si pas de fence)", () => {
    expect(stripMarkdownFences('{"a":1}')).toBe('{"a":1}');
  });

  // ─── Tolérance à la prose autour du JSON (fallback 2026-07-01) ───────────────

  it("parse un objet entouré de prose (Voici le plan : {…}. Fin.)", () => {
    const raw = 'Voici le plan : {"a":6,"b":"x"}. J\'espère que ça convient.';
    expect(parseLlmJson<{ a: number; b: string }>(raw)).toEqual({ a: 6, b: "x" });
  });

  it("parse un objet imbriqué entouré de prose", () => {
    const raw = 'Réponse: {"outer":{"inner":[1,2,3]}} — voilà.';
    expect(parseLlmJson<{ outer: { inner: number[] } }>(raw)).toEqual({
      outer: { inner: [1, 2, 3] },
    });
  });

  it("parse un tableau entouré de prose", () => {
    const raw = 'Sections : [ {"h2":"A"}, {"h2":"B"} ] fin.';
    expect(parseLlmJson<Array<{ h2: string }>>(raw)).toEqual([{ h2: "A" }, { h2: "B" }]);
  });

  it("prose + fence markdown combinés", () => {
    const raw = 'Voici :\n```json\n{"a":7}\n```\nMerci.';
    expect(parseLlmJson<{ a: number }>(raw)).toEqual({ a: 7 });
  });

  it("throw SyntaxError si aucun bloc JSON extractible", () => {
    expect(() => parseLlmJson("désolé, je ne peux pas répondre")).toThrow(SyntaxError);
  });

  it("safe variant retourne null si prose sans JSON", () => {
    expect(parseLlmJsonSafe("aucun json ici")).toBeNull();
  });

  describe("extractFirstJsonBlock", () => {
    it("retourne le bloc objet même entouré de texte", () => {
      expect(extractFirstJsonBlock('x {"a":1} y')).toBe('{"a":1}');
    });
    it("retourne le bloc tableau si l'ouvrant tableau vient en premier", () => {
      expect(extractFirstJsonBlock("z [1,2] z")).toBe("[1,2]");
    });
    it("préfère l'objet quand { vient avant [", () => {
      expect(extractFirstJsonBlock('{"a":[1]} extra')).toBe('{"a":[1]}');
    });
    it("retourne null si aucun délimiteur ouvrant", () => {
      expect(extractFirstJsonBlock("rien du tout")).toBeNull();
    });
  });
});
