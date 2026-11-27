/** PR S1 — le squelette ArticleGabarit rend `data-gabarit`, un seul h1, sans marqueurs V1. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => Object.assign((k: string) => k, { raw: () => [] }),
}));
vi.mock("next/image", () => ({
  default: (p: { alt: string }) => <img alt={p.alt} />,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: (p: { href: string; children: React.ReactNode }) => <a href={p.href}>{p.children}</a>,
}));
// Composants lourds / asynchrones : hors sujet pour le squelette.
for (const m of [
  "@/components/nav/Breadcrumbs",
  "@/components/seo/ArticleTOC",
  "@/components/knowledge/public/AuthorByline",
  "@/components/qualiopi/QualiopiContentBadge",
  "@/components/content-gen/ArticleFaq",
  "@/components/content-gen/ArticleSources",
  "@/components/content-gen/ArticleKeyTakeaway",
  "@/components/content-gen/ArticleExpertQuote",
  "@/components/content-gen/ArticleShareBar",
  "@/components/content-gen/ArticleTransparencyBlock",
  "@/components/content-gen/ArticlePrevNext",
  "@/components/content-gen/ArticlePeopleAlsoAsk",
  "@/components/content-gen/ArticleNewsletterInline",
  "@/components/videos/EncartEnVideo",
  "@/components/suggested/SuggestedContent",
  "@/components/marketing/AiContentDisclaimer",
  "@/components/media/UnsplashCredit",
  "@/components/article-v2/ColonneActionsConnectee",
]) {
  vi.doMock(m, () => {
    const nom = m.split("/").pop()!;
    const stub = () => null;
    return { [nom]: stub, aDesSourcesAffichables: () => false };
  });
}

import type { ArticleGabaritProps } from "@/components/article-v2/ArticleGabarit";

const { ArticleGabarit } = await import("@/components/article-v2/ArticleGabarit");

const view = {
  slug: "mon-article",
  title: "Mon article",
  category: "Cas d'usage",
  author: "Manon",
  publishedAt: "2026-01-02",
  updatedAt: "2026-02-03",
  readingTime: "4 min",
  featuredImage: null,
  featuredImageAlt: null,
  photographerName: null,
  photographerUrl: null,
  keyTakeaway: null,
  expertQuote: null,
  faqItems: [],
  citations: [],
} as unknown as ArticleGabaritProps["view"];

const props: ArticleGabaritProps = {
  gabarit: "guide",
  view,
  locale: "fr",
  html: "<h2 id='a'>Un</h2><p>Corps</p>",
  blocs: null,
  tocItems: [{ anchor: "a", title: "Un", level: 2 }],
  pageUrl: "https://example.test/fr/blog/mon-article",
  chapo: "Chapô",
  titre: { lead: "Mon article" },
  tldr: null,
  filAriane: [{ href: "/blog", label: "Blog" }],
  auteurHref: "/equipe/manon",
  bylineManon: null,
  emettreJsonLdAuteur: false,
  sourcesVerifiees: null,
  villeAncree: null,
  precedentSuivant: { prev: null, next: null },
  questionsAssociees: [],
  suggestions: [],
  themeEncart: null,
  jsonLd: [{ "@type": "BlogPosting" }],
};

describe("ArticleGabarit (squelette S1)", () => {
  it("rend data-gabarit, un seul h1, le corps et le JSON-LD", () => {
    const html = renderToStaticMarkup(<ArticleGabarit {...props} />);
    expect(html).toContain('data-gabarit="guide"');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("<p>Corps</p>");
    expect(html).toContain("BlogPosting");
  });

  it("ne porte aucun marqueur V1 (largeur 52rem du bandeau, bandeau « Mis à jour »)", () => {
    const html = renderToStaticMarkup(<ArticleGabarit {...props} />);
    expect(html).not.toContain("Mis à jour le ");
    expect(html).not.toContain("bg-sand-50");
  });

  it("article en fichier : rend les blocs", () => {
    const html = renderToStaticMarkup(
      <ArticleGabarit
        {...props}
        html={null}
        blocs={[
          { kind: "p", text: "Texte" },
          { kind: "ol", items: ["a", "b"] },
        ]}
      />,
    );
    expect(html).toContain("<p>Texte</p>");
    expect(html).toContain("<li");
  });
});
