/**
 * B.5 P0-7 — Tests keyword-selector.ts
 *
 * Couvre :
 * 1. DB mode : $queryRaw atomique retourne un term → on l'utilise.
 * 2. DB mode vide pour la vertical → fallback in-memory.
 * 3. DB unavailable (throw) → fallback in-memory silencieux.
 * 4. Rotation in-memory round-robin (3 appels consecutifs = 3 keywords distincts).
 * 5. Mapping vertical → KeywordModule (audits → audit pool).
 * 6. Vertical inconnu → fallback transversal puis __all.
 * 7. validateKeywordInTitle : match exact + match partiel (>= 60%) + fail.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const queryRawMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRawMock(...args),
  },
}));

import {
  selectKeyword,
  selectKeywordRich,
  resolveEffectiveIntent,
  normalizeKeywordIntent,
  validateKeywordInTitle,
  __resetInMemoryCounters,
} from "../keyword-selector";

beforeEach(() => {
  queryRawMock.mockReset();
  __resetInMemoryCounters();
});

describe("selectKeyword — DB mode", () => {
  it("returns term when DB has a row for vertical", async () => {
    queryRawMock.mockResolvedValueOnce([{ term: "audit IA conformite RGPD" }]);
    const result = await selectKeyword({ vertical: "audits" });
    expect(result).toBe("audit IA conformite RGPD");
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to in-memory when DB returns empty for vertical", async () => {
    queryRawMock.mockResolvedValueOnce([]);
    const result = await selectKeyword({ vertical: "audits" });
    // Le fallback in-memory retourne un seed du pool 'audit'.
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("falls back to in-memory when DB throws (bootstrap/build mode)", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("ECONNREFUSED stub.invalid"));
    const result = await selectKeyword({ vertical: "audits" });
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });
});

describe("selectKeyword — fallback in-memory rotation", () => {
  beforeEach(() => {
    queryRawMock.mockRejectedValue(new Error("DB unavailable"));
  });

  it("rotates over the audit pool round-robin (3 calls = 3 distinct values)", async () => {
    const a = await selectKeyword({ vertical: "audits" });
    const b = await selectKeyword({ vertical: "audits" });
    const c = await selectKeyword({ vertical: "audits" });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(c).not.toBeNull();
    // 3 keywords distincts (rotation effective).
    const set = new Set([a, b, c]);
    expect(set.size).toBe(3);
  });

  it("maps interventions_formations to its module pool", async () => {
    const result = await selectKeyword({ vertical: "interventions_formations" });
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("falls back to __all when vertical is unknown", async () => {
    const result = await selectKeyword({ vertical: "vertical_inexistant" });
    // Le pool transversal peut etre vide → fallback __all retourne un seed quelconque.
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });
});

describe("selectKeywordRich — métadonnées intent + cluster", () => {
  it("retourne term + searchIntent + clusterId depuis la DB (rotation cluster-aware)", async () => {
    queryRawMock.mockResolvedValueOnce([
      {
        term: "comparatif integrateurs IA PME",
        search_intent: "commercial_investigation",
        cluster_id: "implementation-comparatifs",
      },
    ]);
    const r = await selectKeywordRich({ vertical: "implementations" });
    expect(r).toEqual({
      term: "comparatif integrateurs IA PME",
      searchIntent: "commercial_investigation",
      clusterId: "implementation-comparatifs",
    });
  });

  it("normalise search_intent/cluster_id absents en null", async () => {
    queryRawMock.mockResolvedValueOnce([
      { term: "audit IA RGPD", search_intent: null, cluster_id: null },
    ]);
    const r = await selectKeywordRich({ vertical: "audits" });
    expect(r).toEqual({ term: "audit IA RGPD", searchIntent: null, clusterId: null });
  });

  it("fallback in-memory → métadonnées null (seeds sans intent/cluster)", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("DB unavailable"));
    const r = await selectKeywordRich({ vertical: "audits" });
    expect(r).not.toBeNull();
    expect(typeof r?.term).toBe("string");
    expect(r?.searchIntent).toBeNull();
    expect(r?.clusterId).toBeNull();
  });

  it("selectKeyword reste rétro-compatible (string) en déléguant à rich", async () => {
    queryRawMock.mockResolvedValueOnce([
      { term: "formation IA Lyon", search_intent: "local", cluster_id: "c1" },
    ]);
    const r = await selectKeyword({ vertical: "interventions_formations" });
    expect(r).toBe("formation IA Lyon");
  });
});

describe("normalizeKeywordIntent — vocabulaire seed → enum", () => {
  it("mappe le vocabulaire FR/custom de la table keywords", () => {
    expect(normalizeKeywordIntent("transactionnel")).toBe("transactional");
    expect(normalizeKeywordIntent("informationnel")).toBe("informational");
    expect(normalizeKeywordIntent("comparatif")).toBe("commercial_investigation");
    expect(normalizeKeywordIntent("aeo")).toBe("ai_overview");
  });
  it("identité sur les valeurs déjà-enum", () => {
    expect(normalizeKeywordIntent("commercial_investigation")).toBe("commercial_investigation");
    expect(normalizeKeywordIntent("local")).toBe("local");
  });
  it("retourne null pour les angles de contenu (pas un intent) + valeurs inconnues", () => {
    for (const v of ["sectoriel", "benefice", "partenaire", "bogus", "", null]) {
      expect(normalizeKeywordIntent(v)).toBeNull();
    }
  });
});

describe("resolveEffectiveIntent — garde-fou intent (allow + safe-for-type)", () => {
  it("campagne a forcé un intent (allow=false) → intent campagne TOUJOURS (zéro régression)", () => {
    expect(resolveEffectiveIntent("informational", "comparatif", false, "comparison")).toBe(
      "informational",
    );
    expect(resolveEffectiveIntent("local", "transactionnel", false, "blog_article")).toBe("local");
  });

  it("comparatif + content-type à table (comparison) → commercial_investigation (gate <table> garanti)", () => {
    for (const ct of ["comparison", "vs_comparator", "alternative_to", "top_x_in_y"]) {
      expect(resolveEffectiveIntent("informational", "comparatif", true, ct)).toBe(
        "commercial_investigation",
      );
    }
  });

  it("comparatif + content-type SANS table (blog_article) → reste informational (anti-rétrogradation noindex)", () => {
    expect(resolveEffectiveIntent("informational", "comparatif", true, "blog_article")).toBe(
      "informational",
    );
  });

  it("aeo → ai_overview pour TOUT type (gate citations toujours satisfait)", () => {
    expect(resolveEffectiveIntent("informational", "aeo", true, "blog_article")).toBe(
      "ai_overview",
    );
  });

  it("transactionnel → JAMAIS d'override (gate CTA non garanti → risque noindex)", () => {
    expect(resolveEffectiveIntent("informational", "transactionnel", true, "comparison")).toBe(
      "informational",
    );
    expect(resolveEffectiveIntent("informational", "transactionnel", true, "blog_article")).toBe(
      "informational",
    );
  });

  it("local / featured_snippet / voice_search → pas d'override (gate structurel non garanti)", () => {
    expect(resolveEffectiveIntent("informational", "local", true, "blog_article")).toBe(
      "informational",
    );
    expect(resolveEffectiveIntent("informational", "featured_snippet", true, "blog_article")).toBe(
      "informational",
    );
  });

  it("angles de contenu (sectoriel/benefice) + null → garde l'intent du job", () => {
    expect(resolveEffectiveIntent("informational", "sectoriel", true, "comparison")).toBe(
      "informational",
    );
    expect(resolveEffectiveIntent("informational", null, true, "comparison")).toBe("informational");
  });
});

describe("validateKeywordInTitle", () => {
  it("matches exact substring (normalized lowercase + accents)", () => {
    expect(validateKeywordInTitle("Audit IA Conformité RGPD 2026", "audit ia conformite")).toBe(
      true,
    );
  });

  it("matches with accents stripped on both sides", () => {
    expect(validateKeywordInTitle("Évaluation IA conformité", "evaluation ia conformite")).toBe(
      true,
    );
  });

  it("matches partial (>= 60% of significant words) for 3+ word keywords", () => {
    // 4 mots significatifs, 3 dans le titre = 75%.
    expect(
      validateKeywordInTitle(
        "Comment optimiser votre conformité IA en 2026 (guide opérationnel)",
        "optimiser conformite RGPD operationnel",
      ),
    ).toBe(true);
  });

  it("fails when title misses the keyword entirely (short keyword)", () => {
    expect(
      validateKeywordInTitle("Article totalement different", "intelligence artificielle"),
    ).toBe(false);
  });

  it("fails when < 60% of words match (3+ word keywords)", () => {
    // 4 mots, 1 seul dans le titre = 25%.
    expect(validateKeywordInTitle("Article sur les voitures", "audit IA conformite RGPD")).toBe(
      false,
    );
  });

  it("returns true for exact long-tail match", () => {
    expect(
      validateKeywordInTitle(
        "Audit IA pour PME industrielle : checklist 2026",
        "Audit IA pour PME industrielle",
      ),
    ).toBe(true);
  });
});
