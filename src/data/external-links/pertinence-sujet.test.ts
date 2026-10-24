/**
 * Sources choisies selon le sujet (audit blog 24/10/2026) + invariants du
 * catalogue lu en code (aucun appel réseau).
 */

import { describe, it, expect } from "vitest";
import type { ExternalLink } from "./types";
import { isCompetitorDomain } from "./types";
import { ALL_EXTERNAL_LINKS } from "./master";
import { selectExternalLinksPure } from "./helpers-server-safe";
import { bonusSujet, departageStable, jetonsSujet, malusGeo } from "./pertinence-sujet";

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
    topics: ["autre"],
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

describe("jetonsSujet", () => {
  it("retire accents, pluriels simples, mots vides et années", () => {
    const j = jetonsSujet("Conformité RGPD des chatbots pour PME en 2026");
    expect(j.has("conformite")).toBe(true);
    expect(j.has("rgpd")).toBe(true);
    expect(j.has("chatbot")).toBe(true);
    expect(j.has("pme")).toBe(false);
    expect(j.has("2026")).toBe(false);
  });

  it("rend un ensemble vide pour un texte vide", () => {
    expect(jetonsSujet(undefined).size).toBe(0);
    expect(jetonsSujet("  ").size).toBe(0);
  });
});

describe("malusGeo", () => {
  it("pénalise une source locale hors contexte, pas celle de la bonne ville", () => {
    const nantes = mkLink({ id: "n", organization: "N", scope: "local", cityIds: ["nantes"] });
    expect(malusGeo(nantes)).toBeGreaterThan(0);
    expect(malusGeo(nantes, "lyon")).toBeGreaterThan(0);
    expect(malusGeo(nantes, "nantes")).toBe(0);
  });

  it("pénalise une source régionale hors région, pas les nationales", () => {
    const reg = mkLink({ id: "r", organization: "R", scope: "regional", regionSlug: "bretagne" });
    expect(malusGeo(reg, undefined, "bretagne")).toBe(0);
    expect(malusGeo(reg, undefined, "occitanie")).toBeGreaterThan(0);
    expect(malusGeo(mkLink({ id: "x", organization: "X" }))).toBe(0);
  });
});

describe("departageStable", () => {
  it("est déterministe et borné", () => {
    const a = departageStable("rgpd chatbot", "id-1");
    expect(a).toBe(departageStable("rgpd chatbot", "id-1"));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(15);
  });
});

describe("selectExternalLinksPure — sujet", () => {
  it("classe en tête la source dont les thèmes recoupent le sujet", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", topics: ["seo", "referencement"] }),
      mkLink({ id: "b", organization: "B", topics: ["rgpd", "chatbot"] }),
    ];
    const r = selectExternalLinksPure(pool, { count: 1, subject: "chatbot RGPD pour PME" });
    expect(r[0]?.id).toBe("b");
    expect(bonusSujet(pool[1] as ExternalLink, jetonsSujet("chatbot RGPD"))).toBeGreaterThan(0);
  });

  it("deux sujets différents ne donnent pas le même classement", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", topics: ["seo"] }),
      mkLink({ id: "b", organization: "B", topics: ["rgpd"] }),
    ];
    const seo = selectExternalLinksPure(pool, { count: 1, subject: "stratégie SEO local" });
    const rgpd = selectExternalLinksPure(pool, { count: 1, subject: "mise en conformité RGPD" });
    expect(seo[0]?.id).toBe("a");
    expect(rgpd[0]?.id).toBe("b");
  });

  it("n'avantage pas une mairie hors contexte sur une source nationale", () => {
    const pool = [
      mkLink({
        id: "mairie",
        organization: "Mairie",
        scope: "local",
        cityIds: ["nantes"],
        authority: 5,
      }),
      mkLink({ id: "nat", organization: "Nat", authority: 5 }),
    ];
    const r = selectExternalLinksPure(pool, { count: 1, subject: "automatiser ses devis" });
    expect(r[0]?.id).toBe("nat");
  });

  it("sans sujet, le classement historique est inchangé", () => {
    const pool = [
      mkLink({ id: "a", organization: "A", usageCount: 10 }),
      mkLink({ id: "b", organization: "B", usageCount: 0 }),
    ];
    expect(selectExternalLinksPure(pool, { count: 1 })[0]?.id).toBe("b");
  });
});

describe("catalogue de sources — invariants lus en code", () => {
  const eligibles = ALL_EXTERNAL_LINKS.filter(
    (l) =>
      (l.status === "active" || l.status === "redirect_acceptable") &&
      !l.isCompetitor &&
      !l.paywall &&
      l.indexable &&
      l.isHttps,
  );

  it("les identifiants sont uniques", () => {
    const ids = ALL_EXTERNAL_LINKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque source sélectionnable a une URL https valide, hors domaine concurrent", () => {
    for (const l of eligibles) {
      const u = new URL(l.url);
      expect(u.protocol, l.id).toBe("https:");
      expect(isCompetitorDomain(u.hostname), l.id).toBe(false);
    }
  });

  it("deux sources sélectionnables ne partagent pas la même URL", () => {
    const urls = eligibles.map((l) => l.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("aucune source non vérifiée (pending_verify) n'est sélectionnable", () => {
    const pool = ALL_EXTERNAL_LINKS.map((l) => ({ ...l }));
    const r = selectExternalLinksPure(pool, { count: 50, minAuthority: 1 });
    for (const l of r) expect(["active", "redirect_acceptable"]).toContain(l.status);
  });
});
