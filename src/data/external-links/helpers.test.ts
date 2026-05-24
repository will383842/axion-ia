/**
 * Tests helpers de sélection — pure (sans Prisma).
 */

import { describe, it, expect } from "vitest";
import type { ExternalLink } from "./types";
import { selectExternalLinksPure } from "./helpers-server-safe";

const NOW = Date.now();

function mkLink(
  overrides: Partial<ExternalLink> & { id: string; organization: string },
): ExternalLink {
  const { id, organization, ...rest } = overrides;
  return {
    id,
    url: `https://example-${id}.fr/`,
    title: `Title ${id}`,
    organization,
    category: "gov_fr",
    scope: "national",
    verticales: ["audits"],
    topics: ["rgpd"],
    language: "fr",
    authority: 5,
    verifiedAt: "2026-05-22",
    lastCheckedAt: "2026-05-22T00:00:00Z",
    status: "active",
    isCompetitor: false,
    paywall: false,
    indexable: true,
    isHttps: true,
    usageCount: 0,
    ...rest,
  } as ExternalLink;
}

describe("selectExternalLinksPure — filtres durs", () => {
  it("Filtre les liens status=404", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", status: "404" }),
      mkLink({ id: "b", organization: "B", status: "active" }),
    ];
    const result = selectExternalLinksPure(pool, { count: 2 });
    expect(result.map((l) => l.id)).toEqual(["b"]);
  });

  it("Filtre les liens isCompetitor=true", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", isCompetitor: true }),
      mkLink({ id: "b", organization: "B" }),
    ];
    const result = selectExternalLinksPure(pool, { count: 2 });
    expect(result.map((l) => l.id)).toEqual(["b"]);
  });

  it("Filtre les liens paywall=true", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", paywall: true }),
      mkLink({ id: "b", organization: "B" }),
    ];
    const result = selectExternalLinksPure(pool, { count: 2 });
    expect(result.map((l) => l.id)).toEqual(["b"]);
  });

  it("Filtre les liens non indexables (robots.txt Disallow)", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", indexable: false }),
      mkLink({ id: "b", organization: "B" }),
    ];
    const result = selectExternalLinksPure(pool, { count: 2 });
    expect(result.map((l) => l.id)).toEqual(["b"]);
  });

  it("Filtre les liens non HTTPS", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", isHttps: false }),
      mkLink({ id: "b", organization: "B" }),
    ];
    const result = selectExternalLinksPure(pool, { count: 2 });
    expect(result.map((l) => l.id)).toEqual(["b"]);
  });

  it("Filtre minAuthority", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", authority: 2 }),
      mkLink({ id: "b", organization: "B", authority: 5 }),
    ];
    const result = selectExternalLinksPure(pool, { count: 2, minAuthority: 3 });
    expect(result.map((l) => l.id)).toEqual(["b"]);
  });
});

describe("selectExternalLinksPure — filtres contexte & diversification", () => {
  it("Filtre par vertical", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", verticales: ["audits"] }),
      mkLink({ id: "b", organization: "B", verticales: ["implementations"] }),
    ];
    const result = selectExternalLinksPure(pool, { count: 2, vertical: "audits" });
    expect(result.map((l) => l.id)).toEqual(["a"]);
  });

  it("Filtre par topic", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", topics: ["rgpd"] }),
      mkLink({ id: "b", organization: "B", topics: ["seo"] }),
    ];
    const result = selectExternalLinksPure(pool, { count: 2, topic: "seo" });
    expect(result.map((l) => l.id)).toEqual(["b"]);
  });

  it("Diversification : 1 lien par organisation max", () => {
    const pool = [
      mkLink({ id: "a", organization: "INSEE" }),
      mkLink({ id: "b", organization: "INSEE" }),
      mkLink({ id: "c", organization: "CNIL" }),
    ];
    const result = selectExternalLinksPure(pool, { count: 3 });
    const orgs = result.map((l) => l.organization);
    expect(new Set(orgs).size).toBe(orgs.length);
    expect(orgs).toContain("INSEE");
    expect(orgs).toContain("CNIL");
  });

  it("excludeIds : exclusion explicite (session courante)", () => {
    const pool = [mkLink({ id: "a", organization: "A" }), mkLink({ id: "b", organization: "B" })];
    const result = selectExternalLinksPure(pool, { count: 2, excludeIds: ["a"] });
    expect(result.map((l) => l.id)).toEqual(["b"]);
  });
});

describe("selectExternalLinksPure — rotation équitable", () => {
  it("round_robin : privilégie liens peu utilisés", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", usageCount: 50 }),
      mkLink({ id: "b", organization: "B", usageCount: 0 }),
    ];
    const result = selectExternalLinksPure(pool, { count: 1, rotationMode: "round_robin" });
    expect(result[0]?.id).toBe("b");
  });

  it("weighted_authority : privilégie autorité pure", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", authority: 3, usageCount: 0 }),
      mkLink({ id: "b", organization: "B", authority: 5, usageCount: 1000 }),
    ];
    const result = selectExternalLinksPure(pool, { count: 1, rotationMode: "weighted_authority" });
    expect(result[0]?.id).toBe("b");
  });

  it("maxRecentUsageHours : exclut les liens utilisés trop récemment quand pool suffisant", () => {
    const recent = new Date(NOW - 1 * 3_600_000).toISOString(); // 1 h ago
    const old = new Date(NOW - 48 * 3_600_000).toISOString(); // 48 h ago
    const pool = [
      mkLink({ id: "a", organization: "A", lastUsedAt: recent }),
      mkLink({ id: "b", organization: "B", lastUsedAt: old }),
      mkLink({ id: "c", organization: "C", lastUsedAt: old }),
      mkLink({ id: "d", organization: "D" }),
    ];
    const result = selectExternalLinksPure(pool, {
      count: 1,
      rotationMode: "round_robin",
      maxRecentUsageHours: 24,
    });
    expect(result[0]?.id).not.toBe("a");
  });

  it("Relâche le filtre rotation si pool insuffisant", () => {
    const recent = new Date(NOW - 1 * 3_600_000).toISOString();
    const pool = [mkLink({ id: "a", organization: "A", lastUsedAt: recent })];
    const result = selectExternalLinksPure(pool, { count: 1, maxRecentUsageHours: 24 });
    expect(result.length).toBe(1);
    expect(result[0]?.id).toBe("a");
  });
});

describe("selectExternalLinksPure — scoring géo", () => {
  it("Boost lien city correspondant", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", cityIds: ["paris"], authority: 4 }),
      mkLink({ id: "b", organization: "B", authority: 4 }),
    ];
    const result = selectExternalLinksPure(pool, { count: 1, cityId: "paris" });
    expect(result[0]?.id).toBe("a");
  });

  it("Boost lien région correspondante", () => {
    const pool = [
      mkLink({
        id: "a",
        organization: "A",
        regionSlug: "ile-de-france",
        scope: "regional",
        authority: 4,
      }),
      mkLink({ id: "b", organization: "B", authority: 4 }),
    ];
    const result = selectExternalLinksPure(pool, { count: 1, regionSlug: "ile-de-france" });
    expect(result[0]?.id).toBe("a");
  });
});
