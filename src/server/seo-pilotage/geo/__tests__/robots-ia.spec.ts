import { describe, expect, it } from "vitest";

import {
  agregerRobots,
  classerUserAgent,
  familleDeChemin,
  FAMILLES_ROBOT,
  ROBOTS_IA,
} from "../robots-ia";

describe("classement des robots d'IA par famille", () => {
  it.each([
    [
      "Mozilla/5.0 AppleWebKit/537.36; compatible; GPTBot/1.2; +https://openai.com/gptbot",
      "gptbot",
      "entrainement",
    ],
    ["Mozilla/5.0; compatible; OAI-SearchBot/1.0", "oai-searchbot", "recherche"],
    ["Mozilla/5.0; compatible; ChatGPT-User/1.0", "chatgpt-user", "utilisateur"],
    ["Mozilla/5.0; compatible; ClaudeBot/1.0", "claudebot", "entrainement"],
    ["Claude-SearchBot/1.0", "claude-searchbot", "recherche"],
    ["Claude-User/1.0", "claude-user", "utilisateur"],
    ["Mozilla/5.0 (compatible; PerplexityBot/1.0)", "perplexitybot", "recherche"],
    ["Mozilla/5.0 (compatible; Perplexity-User/1.0)", "perplexity-user", "utilisateur"],
    ["CCBot/2.0 (https://commoncrawl.org/faq/)", "ccbot", "entrainement"],
  ])("%s → %s (%s)", (ua, robot, famille) => {
    expect(classerUserAgent(ua)).toEqual({ robot, famille });
  });

  it("insensible à la casse ; un navigateur ou un robot classique n'est pas un robot d'IA", () => {
    expect(classerUserAgent("gptbot")?.robot).toBe("gptbot");
    expect(classerUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/120")).toBeNull();
    expect(classerUserAgent("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBeNull();
    expect(classerUserAgent("")).toBeNull();
  });

  it("le jeton le plus précis gagne (ClaudeBot ≠ Claude-User)", () => {
    expect(classerUserAgent("Claude-User ClaudeBot")?.robot).toBe("claude-user");
  });

  it("chaque robot a une famille connue et un jeton unique", () => {
    const jetons = ROBOTS_IA.map((r) => r.jeton.toLowerCase());
    expect(new Set(jetons).size).toBe(jetons.length);
    for (const r of ROBOTS_IA) expect(FAMILLES_ROBOT).toContain(r.famille);
  });
});

describe("famille de chemin", () => {
  it.each([
    ["/fr/blog/un-article", "article"],
    ["/fr/implantations/lyon", "ville"],
    ["/fr/faq", "faq"],
    ["/robots.txt", "technique"],
    ["/sitemap-index.xml", "technique"],
    ["/llms.txt", "technique"],
    ["/", "offre"],
    ["", "autre"],
    ["/fr/inconnu-total", "autre"],
  ])("%s → %s", (chemin, famille) => {
    expect(familleDeChemin(chemin)).toBe(famille);
  });
});

describe("agrégat : jamais d'IP, jamais de user-agent brut", () => {
  const lignes = [
    {
      date: "2026-11-26",
      userAgent: "Mozilla/5.0; compatible; GPTBot/1.2",
      chemin: "/fr/blog/a",
      nombre: 4,
    },
    {
      date: "2026-11-26",
      userAgent: "GPTBot/1.1 (autre version)",
      chemin: "/fr/blog/b",
      nombre: 3,
    },
    { date: "2026-11-26", userAgent: "Mozilla/5.0 Chrome", chemin: "/fr/blog/a", nombre: 99 },
    { date: "2026-11-27", userAgent: "ClaudeBot/1.0", chemin: "/robots.txt", nombre: 2 },
    { date: "2026-11-27", userAgent: "ClaudeBot/1.0", chemin: "/robots.txt", nombre: -5 },
  ];

  it("regroupe par jour, robot et famille de chemin ; ignore le non-IA et les comptes invalides", () => {
    expect(agregerRobots(lignes)).toEqual([
      {
        date: "2026-11-26",
        robot: "gptbot",
        famille: "entrainement",
        familleChemin: "article",
        nombre: 7,
      },
      {
        date: "2026-11-27",
        robot: "claudebot",
        famille: "entrainement",
        familleChemin: "technique",
        nombre: 2,
      },
    ]);
  });

  it("la sortie ne contient que des champs de l'agrégat", () => {
    const sortie = JSON.stringify(agregerRobots(lignes));
    expect(sortie).not.toMatch(/Mozilla|compatible|\d+\.\d+\.\d+\.\d+|userAgent|ip/i);
    for (const l of agregerRobots(lignes))
      expect(Object.keys(l).sort()).toEqual([
        "date",
        "famille",
        "familleChemin",
        "nombre",
        "robot",
      ]);
  });

  it("tolère des lignes malformées", () => {
    expect(agregerRobots([null, {}, { date: 3 }] as never)).toEqual([]);
    expect(agregerRobots(undefined as never)).toEqual([]);
  });
});
