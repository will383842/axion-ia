import { describe, it, expect } from "vitest";
import { resolveArticleRoute } from "../resolve-article-route";

describe("resolveArticleRoute", () => {
  it("route les news vers /actualites (prioritaire)", () => {
    expect(resolveArticleRoute({ isNews: true })).toBe("actualites");
    // isNews l'emporte même sur un slug guide.
    expect(resolveArticleRoute({ isNews: true, slug: "guide-ia-pme" })).toBe("actualites");
  });

  it("route les guides via la convention de slug (guide- / guide_)", () => {
    // Cas réel campagne : templateVariant = templateId (jamais "guide"), seul le
    // slug porte le signal. Avant le fix, ces guides étaient routés vers /blog.
    expect(resolveArticleRoute({ slug: "guide-complet-ia-grenoble" })).toBe("guides");
    expect(resolveArticleRoute({ slug: "guide_legacy_prefix" })).toBe("guides");
    expect(
      resolveArticleRoute({ slug: "guide-ia", templateVariant: "cmqx_some_template_id" }),
    ).toBe("guides");
  });

  it("route les guides via templateVariant contenant 'guide'", () => {
    expect(resolveArticleRoute({ templateVariant: "guide_pilier" })).toBe("guides");
    expect(resolveArticleRoute({ templateVariant: "GUIDE-CLUSTER" })).toBe("guides");
  });

  it("route tout le reste vers /blog", () => {
    expect(resolveArticleRoute({ slug: "formation-ia-grenoble-pme" })).toBe("blog");
    expect(resolveArticleRoute({})).toBe("blog");
    expect(resolveArticleRoute({ isNews: false, templateVariant: null, slug: null })).toBe("blog");
    // Un slug contenant "guide" sans être un préfixe ne déclenche pas /guides.
    expect(resolveArticleRoute({ slug: "le-guide-du-debutant" })).toBe("blog");
  });
});
