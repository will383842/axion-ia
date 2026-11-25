/**
 * Branchement du fact-check par Claude : drapeau éteint par défaut, fail-closed.
 * Client simulé, aucun appel réseau.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));

import { decisionFactCheckClaude, factCheckClaudeActif } from "../fact-check-claude";
import type { ResultatFactCheck } from "../../clients/claude-search";

const ON = {
  CONTENT_GEN_FACTCHECK_CLAUDE: "true",
  CONTENT_GEN_BLOG_CLAUDE: "true",
};

describe("factCheckClaudeActif", () => {
  it("éteint par défaut et pour toute valeur autre que « true »", () => {
    expect(factCheckClaudeActif("blog_article", {})).toBe(false);
    for (const v of ["", "1", "TRUE", "yes", "dry-run", " true"]) {
      expect(factCheckClaudeActif("blog_article", { ...ON, CONTENT_GEN_FACTCHECK_CLAUDE: v })).toBe(
        false,
      );
    }
  });
  it("exige l'interrupteur général ET un type autorisé", () => {
    expect(factCheckClaudeActif("blog_article", ON)).toBe(true);
    expect(
      factCheckClaudeActif("blog_article", { ...ON, CONTENT_GEN_BLOG_CLAUDE: undefined }),
    ).toBe(false);
    expect(factCheckClaudeActif("landing_ville", ON)).toBe(false); // défaut = types blog
    expect(
      factCheckClaudeActif("landing_ville", { ...ON, CONTENT_GEN_CLAUDE_TYPES: "landing_ville" }),
    ).toBe(true);
    // liste invalide = rien (jamais « tous »)
    expect(
      factCheckClaudeActif("blog_article", { ...ON, CONTENT_GEN_CLAUDE_TYPES: "nimporte" }),
    ).toBe(false);
  });
});

const resultat = (statuts: Array<"verifiee" | "refutee" | "non-verifiee">): ResultatFactCheck => ({
  verdicts: statuts.map((statut, i) => ({
    affirmation: `Affirmation ${i}`,
    statut,
    sources: statut === "verifiee" ? ["https://www.insee.fr/x"] : [],
    note: "",
  })),
  sources: [{ url: "https://www.insee.fr/x", title: "INSEE" }],
  recherches: 1,
  coutUsd: 0.05,
});
const base = { jobId: "j", contentType: "blog_article" };
const TEXTE = "Le taux atteint 12 % en 2025. Le marché pèse 3 millions d'euros.";

describe("decisionFactCheckClaude", () => {
  it("aucune affirmation chiffrée : aucun appel, pas de barrière", async () => {
    const verifier = vi.fn();
    const d = await decisionFactCheckClaude({ ...base, texte: "Un texte sans chiffre." }, verifier);
    expect(d.barriere).toBeNull();
    expect(verifier).not.toHaveBeenCalled();
  });

  it("tout vérifié : pas de barrière, sources gardées", async () => {
    const verifier = vi.fn(async (a: { affirmations: ReadonlyArray<string> }) =>
      resultat(a.affirmations.map(() => "verifiee" as const)),
    );
    const d = await decisionFactCheckClaude({ ...base, texte: TEXTE }, verifier);
    expect(d.barriere).toBeNull();
    expect(d.sources).toHaveLength(1);
  });

  it("une affirmation non vérifiée : barrière de relecture (article NON publié)", async () => {
    const verifier = vi.fn(async (a: { affirmations: ReadonlyArray<string> }) =>
      resultat(a.affirmations.map((_, i) => (i === 0 ? "non-verifiee" : "verifiee"))),
    );
    const d = await decisionFactCheckClaude({ ...base, texte: TEXTE }, verifier);
    expect(d.barriere?.code).toBe("fact-check-claude");
    expect(d.barriere?.detail?.["non_verifiees"]).toBe(1);
  });

  it("une affirmation contredite : barrière", async () => {
    const verifier = vi.fn(async (a: { affirmations: ReadonlyArray<string> }) =>
      resultat(a.affirmations.map(() => "refutee" as const)),
    );
    const d = await decisionFactCheckClaude({ ...base, texte: TEXTE }, verifier);
    expect(d.barriere?.code).toBe("fact-check-claude");
    expect(d.barriere?.detail?.["contredites"]).toBeGreaterThan(0);
  });

  it("verdicts manquants = non vérifiés (barrière)", async () => {
    const verifier = vi.fn(async () => resultat([]));
    const d = await decisionFactCheckClaude({ ...base, texte: TEXTE }, verifier);
    expect(d.barriere?.code).toBe("fact-check-claude");
  });

  it("erreur / plafond / recherche indisponible : barrière, ne lève jamais, aucun repli", async () => {
    const verifier = vi.fn(async () => Promise.reject(new Error("Plafond du jour atteint")));
    const d = await decisionFactCheckClaude({ ...base, texte: TEXTE }, verifier);
    expect(d.barriere?.code).toBe("fact-check-claude");
    expect(d.barriere?.libelle).toContain("NON vérifié");
    expect(verifier).toHaveBeenCalledTimes(1); // pas de second essai ailleurs
  });
});

import { factCheckClaudePasse, MARQUEUR_FACT_CHECK_CLAUDE } from "../fact-check-claude";
import {
  MAX_RECHERCHES,
  fraisFixesMaxUsd,
  JETONS_ENTREE_PAR_RECHERCHE,
} from "../../clients/claude-search";

describe("preuve de vérification et réservation", () => {
  it("le marqueur n'est reconnu que s'il vaut exactement true", () => {
    expect(factCheckClaudePasse({ [MARQUEUR_FACT_CHECK_CLAUDE]: true })).toBe(true);
    for (const v of [null, undefined, {}, { [MARQUEUR_FACT_CHECK_CLAUDE]: "true" }, "x"]) {
      expect(factCheckClaudePasse(v)).toBe(false);
    }
  });
  it("la réservation couvre l'entrée cumulée (quadratique), pas linéaire", () => {
    const lineaire = MAX_RECHERCHES * JETONS_ENTREE_PAR_RECHERCHE * (2 / 1e6);
    expect(fraisFixesMaxUsd()).toBeGreaterThan(2 * lineaire);
  });
  it("phrases dupliquées : envoyées une seule fois", async () => {
    const verifier = vi.fn(async (a: { affirmations: ReadonlyArray<string> }) =>
      resultat(a.affirmations.map(() => "verifiee" as const)),
    );
    await decisionFactCheckClaude(
      { ...base, texte: "Le taux atteint 12 % et 3 millions d'euros en 2025." },
      verifier,
    );
    const envoyees = (verifier.mock.calls[0] as unknown as [{ affirmations: string[] }])[0]
      .affirmations;
    expect(new Set(envoyees).size).toBe(envoyees.length);
  });
});
