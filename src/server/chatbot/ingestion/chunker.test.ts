/**
 * T-05 — Chunker RAG (tailles 300-600 tokens, overlap ~15 %, contextualisation).
 */

import { describe, it, expect } from "vitest";
import { chunkText, estimateTokens } from "@/server/chatbot/ingestion/chunker";

describe("T-05 chunker", () => {
  it("texte vide → aucun chunk", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("texte court → 1 seul chunk + contextualisation attachée", () => {
    const chunks = chunkText("Une formation Claude d'une journée.", {
      contextLabel: "FAQ — c'est quoi ?",
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.contenu).toContain("formation Claude");
    expect(chunks[0]!.contexte).toBe("FAQ — c'est quoi ?");
    expect(chunks[0]!.index).toBe(0);
  });

  it("texte long → plusieurs chunks de ~300-600 tokens", () => {
    const long = Array.from({ length: 2000 }, (_, i) => `mot${i}`).join(" "); // ~ beaucoup de tokens
    const chunks = chunkText(long, { contextLabel: "doc", maxTokens: 600, minTokens: 300 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(estimateTokens(c.contenu)).toBeLessThanOrEqual(700); // marge overlap
      expect(c.contexte).toBe("doc");
    }
  });

  it("overlap : 2 chunks consécutifs partagent des mots", () => {
    const long = Array.from({ length: 2000 }, (_, i) => `w${i}`).join(" ");
    const chunks = chunkText(long, { maxTokens: 400, overlapRatio: 0.15 });
    const a = new Set(chunks[0]!.contenu.split(" "));
    const b = chunks[1]!.contenu.split(" ");
    const shared = b.filter((w) => a.has(w));
    expect(shared.length).toBeGreaterThan(0);
  });

  it("estimateTokens ≈ chars/4", () => {
    expect(estimateTokens("abcdefgh")).toBe(2);
  });
});
