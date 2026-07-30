/**
 * Tests — robots.ts
 *
 * Ce fichier n'avait AUCUN test, alors qu'il porte une doctrine explicite (« bloquer
 * training, garder citation », Will 2026-06-22) et plusieurs invariants dont la
 * rupture est SILENCIEUSE : rien ne casse, rien n'échoue, et l'on découvre des mois
 * plus tard que Google ne fetche plus les images ou qu'un canal d'ingestion publié
 * est interdit. C'est exactement ce qui est arrivé à `/api/markdown/`.
 *
 * Ce que ces tests verrouillent :
 *
 *  1. **Les canaux publiés sont autorisés.** `/llms.txt` annonce
 *     `/api/markdown/{type}/{slug}` aux moteurs IA ; le bloquer publie une
 *     invitation qu'on interdit d'honorer.
 *  2. **Les bots d'ENTRAÎNEMENT restent bloqués.** Ajouter une permission au
 *     tronc commun ne doit JAMAIS leur en donner une. C'est le test qui rend le
 *     correctif `/api/markdown/` sûr, et non seulement plausible.
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

/** Agents de citation : ils doivent recevoir le tronc commun d'autorisations. */
const AGENTS_CITATION = [
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "Bingbot",
  "Googlebot-Image",
];

/** Agents d'entraînement : ils ne doivent recevoir AUCUNE autorisation. */
const AGENTS_ENTRAINEMENT = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
];

describe("robots.txt — canaux d'ingestion publiés", () => {
  it("autorise /api/markdown/ pour le générique et pour chaque bot de citation", () => {
    // 🔴 `/llms.txt` publie ce chemin comme canal d'ingestion LLM et la route
    // rend 200 text/markdown. Sans cet Allow, `Disallow: /api/` l'interdit dans
    // les 12 blocs : on invite à lire ce qu'on interdit de lire.
    expect(permissions("*")).toContain("/api/markdown/");
    for (const agent of AGENTS_CITATION) {
      expect(permissions(agent), `${agent} doit pouvoir lire /api/markdown/`).toContain(
        "/api/markdown/",
      );
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

describe("robots.txt — doctrine « bloquer training, garder citation »", () => {
  it("n'accorde AUCUNE autorisation aux bots d'entraînement", () => {
    // C'est CE test qui rend sûr tout ajout au tronc commun : une permission
    // ajoutée pour les moteurs de citation ne doit jamais fuiter vers eux.
    for (const agent of AGENTS_ENTRAINEMENT) {
      expect(permissions(agent), `${agent} ne doit avoir aucune autorisation`).toEqual([]);
      expect(interdictions(agent), `${agent} doit être bloqué à la racine`).toEqual(["/"]);
    }
  });

  it("bloque les scrapers sans valeur retour", () => {
    for (const agent of ["CCBot", "Bytespider", "omgili", "Diffbot"]) {
      expect(interdictions(agent), `${agent} doit être bloqué à la racine`).toEqual(["/"]);
    }
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
  it("déclare le sitemap-index et l'hôte", () => {
    expect(RESULTAT.sitemap).toBe("https://axion-ia.com/sitemap-index.xml");
    expect(RESULTAT.host).toBe("https://axion-ia.com");
  });
});
