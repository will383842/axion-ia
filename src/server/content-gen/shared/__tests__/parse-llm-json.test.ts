import { describe, expect, it } from "vitest";
import { parseLlmJson, parseLlmJsonSafe, stripMarkdownFences } from "../parse-llm-json";

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
});
