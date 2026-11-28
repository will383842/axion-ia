import { describe, expect, it } from "vitest";

import { agregerPagesParIA, agregerSemainesParIA } from "../visites-ia";

const ligne = (dimensions: string[], visiteurs: number, visites: number) => ({
  dimensions,
  metrics: [visiteurs, visites],
});

describe("page d'arrivée × IA", () => {
  it("détaille chaque page par IA, ignore les sources non IA, trie par visiteurs", () => {
    const p = agregerPagesParIA([
      ligne(["/fr/a", "ChatGPT", ""], 5, 6),
      ligne(["/fr/a", "perplexity.ai", ""], 2, 2),
      ligne(["/fr/b", "claude.ai", ""], 9, 9),
      ligne(["/fr/c", "Google", "google.com"], 99, 99),
    ]);
    expect(p.map((x) => x.page)).toEqual(["/fr/b", "/fr/a"]);
    expect(p[1]).toEqual({
      page: "/fr/a",
      visiteurs: 7,
      visites: 8,
      parIA: [
        { id: "chatgpt", libelle: "ChatGPT", visiteurs: 5, visites: 6 },
        { id: "perplexity", libelle: "Perplexity", visiteurs: 2, visites: 2 },
      ],
    });
  });

  it("garde 10 pages au plus", () => {
    const rows = Array.from({ length: 14 }, (_, i) =>
      ligne([`/fr/p${i}`, "claude.ai", ""], 20 - i, 1),
    );
    expect(agregerPagesParIA(rows)).toHaveLength(10);
  });
});

describe("tendance sur 12 semaines, par IA", () => {
  it("une ligne par semaine, ordre chronologique, détail par IA", () => {
    const s = agregerSemainesParIA([
      ligne(["2026-11-09", "chatgpt.com", ""], 1, 1),
      ligne(["2026-11-02", "claude.ai", ""], 2, 2),
      ligne(["2026-11-02", "ChatGPT", ""], 4, 5),
      ligne(["2026-11-09", "Bing", ""], 50, 50),
    ]);
    expect(s.map((x) => x.debut)).toEqual(["2026-11-02", "2026-11-09"]);
    expect(s[0]).toMatchObject({ visiteurs: 6, visites: 7 });
    expect(s[0]?.parIA.map((x) => [x.id, x.visiteurs])).toEqual([
      ["chatgpt", 4],
      ["claude", 2],
    ]);
  });
});
