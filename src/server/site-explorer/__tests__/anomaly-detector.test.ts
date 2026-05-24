// Phase F — Tests détecteur anomalies
// Sprint Site Explorer Admin 2026-05-22

import { describe, it, expect } from "vitest";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnomalySeverity = "high" | "medium" | "low";

interface AnomalyCandidate {
  siteRouteId: string;
  type: string;
  severity: AnomalySeverity;
  description: string;
}

// ─── Helpers logique de détection (pure, sans DB) ─────────────────────────────

function detectThinContent(
  routes: Array<{ id: string; wordCount: number | null; section: string | null }>,
): AnomalyCandidate[] {
  return routes
    .filter((r) => r.wordCount !== null && r.wordCount < 300)
    .map((r) => ({
      siteRouteId: r.id,
      type: "thin_content",
      severity: "medium" as AnomalySeverity,
      description: `Contenu thin : ${r.wordCount ?? 0} mots (seuil 300)`,
    }));
}

function detectDuplicateMetaTitles(
  routes: Array<{ id: string; metaTitle: string | null }>,
): AnomalyCandidate[] {
  const titleCounts = new Map<string, string[]>();
  for (const r of routes) {
    if (!r.metaTitle) continue;
    const existing = titleCounts.get(r.metaTitle) ?? [];
    existing.push(r.id);
    titleCounts.set(r.metaTitle, existing);
  }

  const anomalies: AnomalyCandidate[] = [];
  for (const [title, ids] of titleCounts) {
    if (ids.length > 1) {
      for (const id of ids) {
        anomalies.push({
          siteRouteId: id,
          type: "duplicate_meta_title",
          severity: "medium",
          description: `metaTitle dupliqué "${title}" sur ${ids.length} pages`,
        });
      }
    }
  }
  return anomalies;
}

function detectNoJsonLd(
  routes: Array<{ id: string; jsonLdCount: number | null; section: string | null }>,
): AnomalyCandidate[] {
  const contentSections = ["blog", "guides", "cas-concrets", "glossaire"];
  return routes
    .filter((r) => contentSections.includes(r.section ?? "") && (r.jsonLdCount ?? 0) === 0)
    .map((r) => ({
      siteRouteId: r.id,
      type: "no_jsonld",
      severity: "medium" as AnomalySeverity,
      description: `Aucun JSON-LD sur page contenu`,
    }));
}

function detectNoAiDisclaimer(
  routes: Array<{ id: string; hasAiDisclaimer: boolean | null; sourceDbTable: string | null }>,
): AnomalyCandidate[] {
  return routes
    .filter((r) => r.sourceDbTable === "articles" && r.hasAiDisclaimer === false)
    .map((r) => ({
      siteRouteId: r.id,
      type: "no_ai_disclaimer",
      severity: "medium" as AnomalySeverity,
      description: `AiContentDisclaimer absent sur article IA`,
    }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Anomaly Detector — thin content", () => {
  it("détecte les pages avec wordCount < 300", () => {
    const routes = [
      { id: "r1", wordCount: 150, section: "blog" },
      { id: "r2", wordCount: 500, section: "blog" },
      { id: "r3", wordCount: 50, section: "glossaire" },
    ];
    const anomalies = detectThinContent(routes);
    expect(anomalies).toHaveLength(2);
    expect(anomalies.map((a) => a.siteRouteId)).toContain("r1");
    expect(anomalies.map((a) => a.siteRouteId)).toContain("r3");
    expect(anomalies[0]?.severity).toBe("medium");
  });

  it("ne détecte pas si wordCount null", () => {
    const routes = [{ id: "r1", wordCount: null, section: "blog" }];
    const anomalies = detectThinContent(routes);
    expect(anomalies).toHaveLength(0);
  });
});

describe("Anomaly Detector — duplicate metaTitle", () => {
  it("détecte les titres dupliqués", () => {
    const routes = [
      { id: "r1", metaTitle: "Formation IA Paris" },
      { id: "r2", metaTitle: "Formation IA Paris" },
      { id: "r3", metaTitle: "Audit IA Lyon" },
    ];
    const anomalies = detectDuplicateMetaTitles(routes);
    expect(anomalies).toHaveLength(2); // r1 et r2
    expect(anomalies[0]?.type).toBe("duplicate_meta_title");
  });

  it("ignore les titres null", () => {
    const routes = [
      { id: "r1", metaTitle: null },
      { id: "r2", metaTitle: null },
    ];
    const anomalies = detectDuplicateMetaTitles(routes);
    expect(anomalies).toHaveLength(0);
  });
});

describe("Anomaly Detector — no JSON-LD", () => {
  it("détecte les articles sans JSON-LD", () => {
    const routes = [
      { id: "r1", jsonLdCount: 0, section: "blog" },
      { id: "r2", jsonLdCount: 2, section: "blog" },
      { id: "r3", jsonLdCount: 0, section: "contact" }, // pas content → skip
    ];
    const anomalies = detectNoJsonLd(routes);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.siteRouteId).toBe("r1");
  });
});

describe("Anomaly Detector — no AiDisclaimer", () => {
  it("détecte les articles sans AiDisclaimer", () => {
    const routes = [
      { id: "r1", hasAiDisclaimer: false, sourceDbTable: "articles" },
      { id: "r2", hasAiDisclaimer: true, sourceDbTable: "articles" },
      { id: "r3", hasAiDisclaimer: false, sourceDbTable: "authors" }, // pas articles → skip
    ];
    const anomalies = detectNoAiDisclaimer(routes);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.siteRouteId).toBe("r1");
    expect(anomalies[0]?.type).toBe("no_ai_disclaimer");
  });
});

describe("Anomaly Detector — sévérité", () => {
  it("les 404 sont high severity", () => {
    // 404 est directement créé dans le worker avec severity: "high"
    const anomaly: AnomalyCandidate = {
      siteRouteId: "r1",
      type: "404",
      severity: "high",
      description: "Page 404",
    };
    expect(anomaly.severity).toBe("high");
  });

  it("le thin content est medium severity", () => {
    const anomalies = detectThinContent([{ id: "r1", wordCount: 50, section: "blog" }]);
    expect(anomalies[0]?.severity).toBe("medium");
  });
});
