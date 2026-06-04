/**
 * T-06 — Fusion RRF du retrieval hybride (partie pure).
 *
 * Le ranking sur fixture réelle + l'isolation tenant (R-TENANT) + le caractère
 * paramétré des $queryRaw sont vérifiés par le smoke runtime contre la dev DB
 * (cf. journal T-06). Ici : la fusion RRF déterministe.
 */

import { describe, it, expect } from "vitest";
import { reciprocalRankFusion } from "@/server/chatbot/retrieval/hybrid-search";

const mk = (ids: string[]) => ids.map((id) => ({ id }));

describe("T-06 reciprocalRankFusion", () => {
  it("un item bien classé dans les DEUX listes remonte en tête", () => {
    const vector = mk(["a", "b", "c"]);
    const fts = mk(["b", "d", "a"]);
    const fused = reciprocalRankFusion([vector, fts]);
    // 'a' (rang 0 + rang 2) et 'b' (rang 1 + rang 0) sont dans les 2 → devant 'c'/'d'.
    expect(fused[0]!.item.id === "a" || fused[0]!.item.id === "b").toBe(true);
    const top2 = fused
      .slice(0, 2)
      .map((f) => f.item.id)
      .sort();
    expect(top2).toEqual(["a", "b"]);
  });

  it("respecte topK", () => {
    const fused = reciprocalRankFusion([mk(["a", "b", "c", "d"])], { topK: 2 });
    expect(fused).toHaveLength(2);
  });

  it("liste unique → ordre préservé par rang", () => {
    const fused = reciprocalRankFusion([mk(["x", "y", "z"])]);
    expect(fused.map((f) => f.item.id)).toEqual(["x", "y", "z"]);
  });

  it("score décroissant", () => {
    const fused = reciprocalRankFusion([mk(["a", "b"]), mk(["a", "c"])]);
    for (let i = 1; i < fused.length; i++) {
      expect(fused[i - 1]!.score).toBeGreaterThanOrEqual(fused[i]!.score);
    }
  });
});
