/**
 * Tests — robots.ts
 *
 * Ce fichier n'avait AUCUN test, alors qu'il porte une doctrine explicite (« être cité
 * par les IA », option A, Williams 2026-11-09) et plusieurs invariants dont la
 * rupture est SILENCIEUSE : rien ne casse, rien n'échoue, et l'on découvre des mois
 * plus tard que Google ne fetche plus les images ou qu'un canal d'ingestion publié
 * est interdit. C'est exactement ce qui est arrivé à `/api/markdown/`.
 *
 * Ce que ces tests verrouillent :
 *
 *  1. **Les canaux publiés sont autorisés.** `/llms.txt` annonce
 *     `/api/markdown/{type}/{slug}` aux moteurs IA ; le bloquer publie une
 *     invitation qu'on interdit d'honorer.
 *  2. **Les robots d'IA ne sont PLUS bloqués** (option A « cité partout ») :
 *     aucun groupe `Disallow: /` ne les vise ; seuls Bytespider, omgili et
 *     Diffbot restent bloqués.
 *  3. **`/api/og` survit.** L'invariant documenté du fichier : l'oublier casse
 *     silencieusement TOUS les aperçus sociaux du site.
 *  4. **Les surfaces privées restent fermées** — admin, données personnelles.
 *  5. **Un `Allow` large ne rouvre pas `/api/`** : les routes d'authentification,
 *     d'administration et les webhooks doivent rester interdits.
 */

import { describe, it, expect, vi } from "vitest";

// L'URL du site vient de la configuration : la figer garde le test indépendant
// de l'environnement, sans quoi il passerait ou tomberait selon la machine.
vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));

import robots from "./robots";

type Regle = {
  userAgent?: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
};

const RESULTAT = robots();
const REGLES = RESULTAT.rules as Regle[];

function agentsNommes(): string[] {
  return REGLES.flatMap(agentsDe);
}

/** Les permissions d'un agent, normalisées en tableau. */
function permissions(agent: string): string[] {
  const regle = REGLES.find((r) => r.userAgent === agent);
  if (regle === undefined) return [];
  const a = regle.allow;
  return a === undefined ? [] : Array.isArray(a) ? a : [a];
}

function interdictions(agent: string): string[] {
  const regle = REGLES.find((r) => r.userAgent === agent);
  if (regle === undefined) return [];
  const d = regle.disallow;
  return d === undefined ? [] : Array.isArray(d) ? d : [d];
}

/** Rassemble tous les agents visés par au moins une règle. */
function agentsDe(regle: Regle): string[] {
  const u = regle.userAgent;
  return u === undefined ? [] : Array.isArray(u) ? u : [u];
}

/** Agents d'IA : ils héritent du groupe `*` (aucune règle propre). */
const AGENTS_IA = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot",
];

const AGENTS_BLOQUES = ["Bytespider", "omgili", "Diffbot"];

describe("robots.txt — canaux d'ingestion publiés", () => {
  it("autorise /api/markdown/ pour le générique et pour chaque bot de citation", () => {
    // 🔴 `/llms.txt` publie ce chemin comme canal d'ingestion LLM et la route
    // rend 200 text/markdown. Sans cet Allow, `Disallow: /api/` l'interdit dans
    // les 12 blocs : on invite à lire ce qu'on interdit de lire.
    expect(permissions("*")).toContain("/api/markdown/");
    for (const agent of AGENTS_IA) {
      expect(agentsNommes(), `${agent} hérite du groupe *`).not.toContain(agent);
    }
  });

  it("conserve /api/og — son oubli casse TOUS les aperçus sociaux", () => {
    expect(permissions("*")).toContain("/api/og");
    expect(permissions("*")).toContain("/api/avis/photo");
  });

  it("conserve /_next/image et /_next/static", () => {
    // Googlebot rend la page pour l'évaluer : sans CSS ni JS il la voit cassée.
    expect(permissions("*")).toContain("/_next/image");
    expect(permissions("*")).toContain("/_next/static");
  });
});

describe("robots.txt — option A « cité partout »", () => {
  it("ne bloque aucun robot d'IA : ils héritent tous du groupe *", () => {
    for (const regle of REGLES) {
      const bloque = ([] as string[]).concat(regle.disallow ?? []).includes("/");
      if (!bloque) continue;
      for (const agent of AGENTS_IA) {
        expect(
          agentsDe(regle),
          `${agent} ne doit figurer dans aucun groupe Disallow: /`,
        ).not.toContain(agent);
      }
    }
    for (const agent of AGENTS_IA) {
      expect(agentsNommes(), `${agent} ne doit pas avoir de groupe propre`).not.toContain(agent);
    }
  });

  it("bloque uniquement les scrapers sans valeur retour", () => {
    const groupesBloques = REGLES.filter((r) =>
      ([] as string[]).concat(r.disallow ?? []).includes("/"),
    );
    const bloques = groupesBloques.flatMap(agentsDe).sort();
    expect(bloques).toEqual([...AGENTS_BLOQUES].sort());
  });

  it("n'a ni groupe Bingbot, ni crawl-delay, ni directive Host", () => {
    expect(agentsNommes()).not.toContain("Bingbot");
    expect(REGLES.some((r) => "crawlDelay" in r)).toBe(false);
    expect(RESULTAT.host).toBeUndefined();
  });
});

describe("robots.txt — surfaces privées", () => {
  it("garde /api/ interdit : un Allow ciblé ne rouvre pas les routes sensibles", () => {
    // Longest-match : `/api/markdown/` est autorisé, `/api/` reste interdit —
    // donc /api/auth, /api/admin et les webhooks restent fermés.
    expect(interdictions("*")).toContain("/api/");
    expect(permissions("*")).not.toContain("/api/");
    expect(permissions("*")).not.toContain("/api/auth");
  });

  it("garde l'admin et les données personnelles interdits, dans les deux locales", () => {
    const d = interdictions("*");
    for (const chemin of ["/admin/", "/fr/admin/", "/en/admin/", "/mes-donnees/", "/en/my-data/"]) {
      expect(d, `${chemin} doit rester interdit`).toContain(chemin);
    }
  });

  it("ne bloque PAS /en/ — les 301 vers FR doivent rester crawlables", () => {
    // Un `Disallow: /en/` empêcherait Googlebot de suivre le 301 et laisserait
    // les anciennes URLs EN en index « bloquées robots » au lieu d'être purgées.
    expect(interdictions("*")).not.toContain("/en/");
  });
});

describe("robots.txt — découvrabilité", () => {
  it("déclare le sitemap-index", () => {
    expect(RESULTAT.sitemap).toBe("https://axion-ia.com/sitemap-index.xml");
  });
});
