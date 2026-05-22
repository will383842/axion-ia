/**
 * Tests Sprint Keywords Perfection 2026-05-22
 * Phases 1+2+3+4 : audit qualité + clusters + équilibrage + intents 2026
 */
import { describe, it, expect } from "vitest";
import { ALL_KEYWORD_SEEDS } from "../master";
import { validateAllSeeds } from "../validate";
import { KW_AUDIT_CLUSTERS } from "../g1c-audit-clusters";
import { KW_FORMATIONS_CLUSTERS } from "../g2c-formations-clusters";
import { KW_COACHING_CLUSTERS } from "../g6c-coaching-clusters";
import { KW_IMPLEMENTATIONS_CLUSTERS } from "../g3e-implementations-clusters";
import { KW_WEB_AUGMENTE_CLUSTERS } from "../g3f-web-augmente-clusters";

const MODULE_TO_VERTICAL: Record<string, string> = {
  audit: "audits",
  "interventions-formations": "interventions_formations",
  implementation: "implementations",
  "coaching-1-to-1": "un_a_un",
  "codage-developpement": "sites_web_augmentes",
  "maintenance-ia": "transversal",
  transversal: "transversal",
};

function countByVertical(seeds: typeof ALL_KEYWORD_SEEDS) {
  const counts: Record<string, number> = {};
  for (const s of seeds) {
    const v = MODULE_TO_VERTICAL[s.module] ?? "transversal";
    counts[v] = (counts[v] ?? 0) + 1;
  }
  return counts;
}

describe("Phase 1 — Audit qualité seeds existants", () => {
  it("total seeds >= 1500", () => {
    expect(ALL_KEYWORD_SEEDS.length).toBeGreaterThanOrEqual(1500);
  });

  it("tous les seeds ont une urlCible commençant par /fr/", () => {
    const invalid = ALL_KEYWORD_SEEDS.filter((s) => !s.urlCible.startsWith("/fr/"));
    expect(invalid.length).toBe(0);
  });

  it("voice_search seeds (nouveaux) se terminent par '?'", () => {
    // Seuls les nouveaux seeds Phase 2 utilisent voice_search — ils doivent tous finir par ?
    const voiceSeeds = ALL_KEYWORD_SEEDS.filter((s) => s.intent === "voice_search");
    const invalid = voiceSeeds.filter((s) => !s.keyword.trim().endsWith("?"));
    // Log pour débug si non-vide
    if (invalid.length > 0) {
      console.warn("voice_search sans ? :", invalid.map((s) => s.keyword).slice(0, 5));
    }
    expect(invalid.length).toBe(0);
  });

  it("les seeds de niveau=1 + priorite=1 sont absents (règle R5)", () => {
    const forbidden = ALL_KEYWORD_SEEDS.filter((s) => s.niveau === 1 && s.priorite === 1);
    expect(forbidden.length).toBe(0);
  });
});

describe("Phase 2 — Couverture sémantique clusters", () => {
  it("g1c-audit-clusters : >= 100 seeds", () => {
    expect(KW_AUDIT_CLUSTERS.length).toBeGreaterThanOrEqual(100);
  });

  it("g2c-formations-clusters : >= 75 seeds", () => {
    expect(KW_FORMATIONS_CLUSTERS.length).toBeGreaterThanOrEqual(75);
  });

  it("g6c-coaching-clusters : >= 50 seeds", () => {
    expect(KW_COACHING_CLUSTERS.length).toBeGreaterThanOrEqual(50);
  });

  it("g3e-implementations-clusters : >= 75 seeds", () => {
    expect(KW_IMPLEMENTATIONS_CLUSTERS.length).toBeGreaterThanOrEqual(75);
  });

  it("g3f-web-augmente-clusters : >= 60 seeds", () => {
    expect(KW_WEB_AUGMENTE_CLUSTERS.length).toBeGreaterThanOrEqual(60);
  });

  it("cluster audits contient des clusters sécurité et RGPD", () => {
    const securityKws = KW_AUDIT_CLUSTERS.filter(
      (s) =>
        s.urlCible.includes("securite") ||
        s.urlCible.includes("rgpd") ||
        s.urlCible.includes("ai-act"),
    );
    expect(securityKws.length).toBeGreaterThan(5);
  });
});

describe("Phase 3 — Équilibrage ≥250 par verticale", () => {
  const byVertical = countByVertical(ALL_KEYWORD_SEEDS);

  it("verticale audits >= 250", () => {
    expect(byVertical["audits"] ?? 0).toBeGreaterThanOrEqual(250);
  });

  it("verticale interventions_formations >= 250", () => {
    expect(byVertical["interventions_formations"] ?? 0).toBeGreaterThanOrEqual(250);
  });

  it("verticale implementations >= 250", () => {
    expect(byVertical["implementations"] ?? 0).toBeGreaterThanOrEqual(250);
  });

  it("verticale un_a_un >= 250", () => {
    expect(byVertical["un_a_un"] ?? 0).toBeGreaterThanOrEqual(250);
  });

  it("verticale sites_web_augmentes >= 250", () => {
    expect(byVertical["sites_web_augmentes"] ?? 0).toBeGreaterThanOrEqual(250);
  });
});

describe("Phase 4 — Diversité intentionnelle 2026", () => {
  it("voice_search : >= 80 seeds", () => {
    const count = ALL_KEYWORD_SEEDS.filter((s) => s.intent === "voice_search").length;
    expect(count).toBeGreaterThanOrEqual(80);
  });

  it("ai_overview : >= 30 seeds", () => {
    const count = ALL_KEYWORD_SEEDS.filter((s) => s.intent === "ai_overview").length;
    expect(count).toBeGreaterThanOrEqual(30);
  });

  it("featured_snippet : >= 25 seeds", () => {
    const count = ALL_KEYWORD_SEEDS.filter((s) => s.intent === "featured_snippet").length;
    expect(count).toBeGreaterThanOrEqual(25);
  });

  it("commercial_investigation : >= 20 seeds", () => {
    const count = ALL_KEYWORD_SEEDS.filter((s) => s.intent === "commercial_investigation").length;
    expect(count).toBeGreaterThanOrEqual(20);
  });

  it("les 7 intents sont tous représentés", () => {
    const intents = new Set(ALL_KEYWORD_SEEDS.map((s) => s.intent));
    expect(intents.has("voice_search")).toBe(true);
    expect(intents.has("ai_overview")).toBe(true);
    expect(intents.has("featured_snippet")).toBe(true);
    expect(intents.has("commercial_investigation")).toBe(true);
    expect(intents.has("transactionnel")).toBe(true);
    expect(intents.has("informationnel")).toBe(true);
    expect(intents.has("benefice")).toBe(true);
  });
});
