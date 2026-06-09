// Tests indexabilité LIVE — onglet « Toutes les URLs » (2026-06-08).
// Vérifie que computeIndexability reflète la logique réelle de rendu.

import { describe, it, expect } from "vitest";
import { computeIndexability } from "../indexability";

const FUTURE = new Date("2030-01-01T00:00:00Z"); // cohorte drip maximale

describe("computeIndexability — articles (tier)", () => {
  it("tier_1_indexable → indexable", () => {
    const r = computeIndexability({
      pathRendered: "/fr/blog/mon-article",
      pathPattern: "/fr/blog/[slug]",
      section: "blog",
      articleTier: "tier_1_indexable",
    });
    expect(r.indexable).toBe(true);
  });

  it("tier_2_noindex_follow → noindex avec raison", () => {
    const r = computeIndexability({
      pathRendered: "/fr/blog/brouillon",
      pathPattern: "/fr/blog/[slug]",
      section: "blog",
      articleTier: "tier_2_noindex_follow",
    });
    expect(r.indexable).toBe(false);
    expect(r.reason).toMatch(/tier-2/i);
  });

  it("tier_3_noindex_nofollow → noindex", () => {
    const r = computeIndexability({
      pathRendered: "/fr/blog/x",
      pathPattern: "/fr/blog/[slug]",
      section: "blog",
      articleTier: "tier_3_noindex_nofollow",
    });
    expect(r.indexable).toBe(false);
  });
});

describe("computeIndexability — pages statiques", () => {
  it("page commerciale standard → indexable", () => {
    const r = computeIndexability({
      pathRendered: "/fr/audit",
      pathPattern: "/fr/audit",
      section: "audit",
    });
    expect(r.indexable).toBe(true);
  });

  it("page technique exclue (/reserver) → noindex", () => {
    const r = computeIndexability({
      pathRendered: "/fr/reserver",
      pathPattern: "/fr/reserver",
      section: "reserver",
    });
    expect(r.indexable).toBe(false);
  });
});

describe("computeIndexability — villes (drip temporel)", () => {
  it("ville premium (paris) indexable dans le futur", () => {
    const r = computeIndexability(
      {
        pathRendered: "/fr/implantations/ile-de-france/paris",
        pathPattern: "/fr/implantations/[region]/[ville]",
        section: "implantations",
      },
      FUTURE,
    );
    expect(r.indexable).toBe(true);
  });

  it("slug ville inexistant → noindex", () => {
    const r = computeIndexability(
      {
        pathRendered: "/fr/implantations/ile-de-france/zzz-ville-fantome",
        pathPattern: "/fr/implantations/[region]/[ville]",
        section: "implantations",
      },
      FUTURE,
    );
    expect(r.indexable).toBe(false);
  });

  it("page ville×service d'une ville premium (lyon) → indexable au futur", () => {
    const r = computeIndexability(
      {
        pathRendered: "/fr/audit/par-ville/lyon",
        pathPattern: "/fr/audit/par-ville/[ville]",
        section: "audit",
      },
      FUTURE,
    );
    expect(r.indexable).toBe(true);
  });

  it("page ville×service d'un slug inexistant → noindex (hors cohorte)", () => {
    const r = computeIndexability(
      {
        pathRendered: "/fr/audit/par-ville/zzz-ville-fantome",
        pathPattern: "/fr/audit/par-ville/[ville]",
        section: "audit",
      },
      FUTURE,
    );
    expect(r.indexable).toBe(false);
    expect(r.reason).toMatch(/drip|cohorte/i);
  });
});
