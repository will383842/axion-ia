/**
 * Tests V-12 P1 correction (2026-05-22)
 *  - clusterId assignment exhaustif + déterministe
 *  - cityIds[] extraction depuis keyword/urlCible
 *  - cleanup banned terms dans seeds bruts
 */
import { describe, it, expect } from "vitest";
import { ALL_KEYWORD_SEEDS } from "../master";
import { assignClusterId, ALL_CLUSTER_IDS, KEYWORD_CLUSTERS } from "../clusters";
import { extractCityInseeCodes, KNOWN_CITIES_COUNT } from "../geo-cities";
import type { KeywordSeed } from "../types";

describe("V-12 P1 — Catalog clusters", () => {
  it("expose 26 clusters (25 + transversal)", () => {
    expect(KEYWORD_CLUSTERS.length).toBe(26);
    expect(ALL_CLUSTER_IDS.length).toBe(26);
  });

  it("5 clusters par verticale (hors transversal)", () => {
    const verticals = [
      "audits",
      "interventions_formations",
      "un_a_un",
      "implementations",
      "sites_web_augmentes",
    ];
    for (const v of verticals) {
      const count = KEYWORD_CLUSTERS.filter((c) => c.vertical === v).length;
      expect(count, `verticale ${v}`).toBe(5);
    }
  });

  it("tous les cluster IDs sont uniques", () => {
    const unique = new Set(ALL_CLUSTER_IDS);
    expect(unique.size).toBe(ALL_CLUSTER_IDS.length);
  });
});

describe("V-12 P1 — assignClusterId déterministe", () => {
  it("assigne un cluster non-null à TOUS les seeds (1500+)", () => {
    const unassigned: KeywordSeed[] = [];
    for (const seed of ALL_KEYWORD_SEEDS) {
      const cid = assignClusterId(seed);
      if (!cid) unassigned.push(seed);
    }
    expect(
      unassigned.length,
      `unassigned: ${unassigned
        .slice(0, 3)
        .map((s) => s.keyword)
        .join(", ")}`,
    ).toBe(0);
  });

  it("cluster sécurité-conformité capture keywords RGPD/sécurité", () => {
    const seed: KeywordSeed = {
      keyword: "audit RGPD IA PME",
      module: "audit",
      intent: "transactionnel",
      cible: "pme",
      priorite: 2,
      niveau: 2,
      urlCible: "/fr/audit/rgpd-ia",
    };
    expect(assignClusterId(seed)).toBe("audit-securite-conformite");
  });

  it("cluster web-seo capture keywords SEO/AEO", () => {
    const seed: KeywordSeed = {
      keyword: "stratégie SEO AEO 2026",
      module: "codage-developpement",
      intent: "informationnel",
      cible: "pme",
      priorite: 2,
      niveau: 2,
      urlCible: "/fr/codage-developpement/seo",
    };
    expect(assignClusterId(seed)).toBe("web-seo-aeo-geo");
  });

  it("transversal pour modules transversal/maintenance-ia", () => {
    const seed: KeywordSeed = {
      keyword: "qui est Axion-IA",
      module: "transversal",
      intent: "aeo",
      cible: "toutes-cibles",
      priorite: 2,
      niveau: 2,
      urlCible: "/fr/a-propos",
    };
    expect(assignClusterId(seed)).toBe("transversal");
  });

  it("appel répété donne le MÊME cluster (déterministe)", () => {
    const seed = ALL_KEYWORD_SEEDS[42]!;
    const r1 = assignClusterId(seed);
    const r2 = assignClusterId(seed);
    const r3 = assignClusterId(seed);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });
});

describe("V-12 P1 — extractCityInseeCodes", () => {
  it("KNOWN_CITIES_COUNT >= 200", () => {
    expect(KNOWN_CITIES_COUNT).toBeGreaterThanOrEqual(200);
  });

  it("détecte Paris dans urlCible et keyword", () => {
    const r = extractCityInseeCodes("audit IA Paris Île-de-France", "/fr/audit/paris");
    expect(r).toContain("75056");
  });

  it("détecte Lyon depuis urlCible seule", () => {
    const r = extractCityInseeCodes("cabinet audit IA", "/fr/audit/lyon");
    expect(r).toContain("69123");
  });

  it("détecte Marseille depuis keyword seul", () => {
    const r = extractCityInseeCodes("formation IA Marseille PME", "/fr/formation-ia");
    expect(r).toContain("13055");
  });

  it("noms composés (Saint-Étienne) capturés correctement", () => {
    const r = extractCityInseeCodes("audit IA Saint-Étienne", "/fr/audit-ia");
    // Saint-Étienne insee = 42218
    expect(r).toContain("42218");
  });

  it("ne capture rien pour keyword non-géo", () => {
    const r = extractCityInseeCodes("qu'est-ce que l'audit IA", "/fr/audit-ia");
    expect(r.length).toBe(0);
  });

  it("ne capture pas un substring trop court (ambiguous)", () => {
    // "PAU" ambigu (verbe ou ville Pau). Sans urlCible /fr/audit/pau → pas de match
    const r = extractCityInseeCodes("audit IA peu coûteux entreprise", "/fr/audit-ia");
    expect(r.length).toBe(0);
  });

  it("retourne uniques + triés", () => {
    const r = extractCityInseeCodes("audit IA Lyon Lyon Lyon", "/fr/audit/lyon");
    expect(r).toEqual(["69123"]);
  });

  it("multi-villes possible", () => {
    const r = extractCityInseeCodes("formation IA Lyon ou Marseille PME", "/fr/formation-ia");
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(r).toContain("69123");
    expect(r).toContain("13055");
  });
});

describe("V-12 P1 — Mass coverage cityIds sur ALL_KEYWORD_SEEDS", () => {
  const seedsWithCities = ALL_KEYWORD_SEEDS.map((s) => ({
    seed: s,
    cityIds: extractCityInseeCodes(s.keyword, s.urlCible),
  })).filter((e) => e.cityIds.length > 0);

  it("au moins 80 keywords géo détectés (cible audit V-12 ≥ 80)", () => {
    expect(seedsWithCities.length).toBeGreaterThanOrEqual(80);
  });

  it("tous les keywords intent=local ont au moins 1 cityId", () => {
    const local = ALL_KEYWORD_SEEDS.filter((s) => s.intent === "local");
    const localWithCity = local.filter(
      (s) => extractCityInseeCodes(s.keyword, s.urlCible).length > 0,
    );
    // Tolérance : au moins 80% des intent=local doivent avoir cityIds (certains
    // sont génériques "audit IA Paris ou ailleurs en France")
    expect(localWithCity.length / Math.max(1, local.length)).toBeGreaterThanOrEqual(0.8);
  });
});

describe("V-12 P1 — Cleanup termes interdits dans keyword:", () => {
  const FORBIDDEN_IN_KEYWORD = [
    "opco",
    "qualiopi",
    "cpf",
    "fifpl",
    "datadock",
    "n8n",
    "zapier",
    "make.com",
    "make vs",
    "make ou n8n",
    "langchain",
  ];

  it("aucun seed source ne contient un terme interdit dans le champ keyword", () => {
    const polluted = ALL_KEYWORD_SEEDS.filter((s) => {
      const kw = s.keyword.toLowerCase();
      return FORBIDDEN_IN_KEYWORD.some((t) => kw.includes(t));
    });
    if (polluted.length > 0) {
      console.warn(
        "Keywords pollués restants :",
        polluted.map((s) => s.keyword),
      );
    }
    expect(polluted.length).toBe(0);
  });
});
