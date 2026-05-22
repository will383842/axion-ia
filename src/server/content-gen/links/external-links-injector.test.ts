/**
 * Tests external-links-injector — couche d'adaptation generators ↔ catalogue.
 */

import { describe, it, expect } from "vitest";
import { injectExternalLinks } from "./external-links-injector";
import type { GeneratorBaseInput } from "../generators/types";

function mkInput(overrides: Partial<GeneratorBaseInput> = {}): GeneratorBaseInput {
  return {
    jobId: "test-job-1",
    contentType: "blog_article",
    targetSearchIntent: "informational",
    ...overrides,
  } as GeneratorBaseInput;
}

describe("injectExternalLinks", () => {
  it("Retourne ≥ 1 lien depuis bootstrap (catalogue ~94 entrées)", () => {
    const input = mkInput({ templateVariant: "audits" });
    const result = injectExternalLinks(input, { count: 3, minAuthority: 4 });
    expect(result.links.length).toBeGreaterThanOrEqual(1);
    expect(result.links.length).toBeLessThanOrEqual(3);
  });

  it("Markdown section non vide si liens sélectionnés", () => {
    const input = mkInput({ templateVariant: "audits" });
    const result = injectExternalLinks(input, { count: 3, minAuthority: 4 });
    expect(result.markdownSection).toContain("## SOURCES D'AUTORITÉ");
    expect(result.markdownSection).toContain("Utiliser ces URLs EXACTES");
  });

  it("IDs alignés avec links retournés", () => {
    const input = mkInput({ templateVariant: "audits" });
    const result = injectExternalLinks(input, { count: 4, minAuthority: 4 });
    expect(result.ids.length).toBe(result.links.length);
    for (let i = 0; i < result.ids.length; i++) {
      expect(result.ids[i]).toBe(result.links[i]?.id);
    }
  });

  it("Diversification : organisations uniques dans la sélection", () => {
    const input = mkInput({ templateVariant: "audits" });
    const result = injectExternalLinks(input, { count: 5, minAuthority: 4 });
    const orgs = result.links.map((l) => l.organization);
    expect(new Set(orgs).size).toBe(orgs.length);
  });

  it("Mapping templateVariant audits → vertical audits (filtre actif)", () => {
    const input = mkInput({ templateVariant: "audits" });
    const result = injectExternalLinks(input, { count: 5, minAuthority: 4 });
    // Au moins 1 lien doit cibler la verticale "audits"
    const hasAuditsLink = result.links.some((l) => l.verticales.includes("audits"));
    expect(hasAuditsLink).toBe(true);
  });

  it("Mapping templateVariant formations → vertical interventions_formations", () => {
    const input = mkInput({ templateVariant: "interventions_formations" });
    const result = injectExternalLinks(input, { count: 5, minAuthority: 4 });
    const hasFormationLink = result.links.some((l) =>
      l.verticales.includes("interventions_formations"),
    );
    expect(hasFormationLink).toBe(true);
  });

  it("Cohérence cross-articles : excludeIds réduit doublons session", () => {
    const input = mkInput({ templateVariant: "audits" });
    const first = injectExternalLinks(input, { count: 3, minAuthority: 4 });
    const second = injectExternalLinks(input, {
      count: 3,
      minAuthority: 4,
      excludeIds: first.ids,
    });
    // Les IDs de 1 et 2 ne doivent pas s'overlap
    for (const id of second.ids) {
      expect(first.ids).not.toContain(id);
    }
  });

  it("Pas de lien concurrent dans la sélection (filtre dur)", () => {
    const input = mkInput({ templateVariant: "audits" });
    const result = injectExternalLinks(input, { count: 10, minAuthority: 3 });
    for (const link of result.links) {
      expect(link.isCompetitor).toBe(false);
    }
  });
});
