/** Gabarit Analyse (G1) — rendu serveur, règles communes du découpage (a, c, d, f, g, h). */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => {
  const lire = (f: string) =>
    JSON.parse(readFileSync(`src/messages/gabarits/${f}.fr.json`, "utf8"));
  const sources: Record<string, unknown> = {
    "articleGabarits.commun": lire("commun"),
    "articleGabarits.analyse": lire("analyse"),
  };
  const chercher = (ns: string, k: string): unknown => {
    const base = Object.keys(sources).find((b) => ns === b || ns.startsWith(`${b}.`));
    if (!base) return undefined;
    const reste = ns.slice(base.length).split(".").filter(Boolean);
    return [...reste, ...k.split(".")].reduce<unknown>(
      (o, c) => (o as Record<string, unknown> | undefined)?.[c],
      sources[base],
    );
  };
  const fabrique = (ns: string) =>
    Object.assign(
      (k: string, vars?: Record<string, unknown>) => {
        const v = chercher(ns, k);
        return typeof v === "string"
          ? v.replace(/\{(\w+)\}/g, (_, n) => String(vars?.[n] ?? ""))
          : k;
      },
      { raw: (k: string) => chercher(ns, k), rich: (k: string) => k },
    );
  return { useTranslations: (ns: string) => fabrique(ns ?? "") };
});
vi.mock("next/image", () => ({
  default: (p: { alt: string; src: string }) => <img alt={p.alt} src={p.src} />,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: (p: { href: string; className?: string; children: React.ReactNode }) => (
    <a href={p.href} className={p.className}>
      {p.children}
    </a>
  ),
}));
vi.mock("@/components/seo/ArticleTOC", () => ({
  ArticleTOC: ({ items }: { items: ReadonlyArray<{ anchor: string; title: string }> }) => (
    <nav className="sommaire">{items.map((i) => `${i.anchor}|${i.title}`).join(";")}</nav>
  ),
}));
vi.mock("@/components/article-v2/ColonneActionsConnectee", () => ({
  ColonneActionsConnectee: () => <aside aria-label="Passer à l’action" />,
}));
for (const m of [
  "@/components/nav/Breadcrumbs",
  "@/components/marketing/AnswerCard",
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
]) {
  vi.doMock(m, () => {
    const nom = m.split("/").pop()!;
    return { [nom]: () => null, aDesSourcesAffichables: () => false };
  });
}

import type { ArticleGabaritProps } from "@/components/article-v2/types";

const { ArticleGabarit } = await import("@/components/article-v2/ArticleGabarit");

const section = (n: number) => `<h2 id="s${n}">Section ${n}</h2><p>Texte ${n}</p>`;
const CORPS = [1, 2, 3, 4, 5].map(section).join("");

function props(surcharge: Partial<ArticleGabaritProps> = {}): ArticleGabaritProps {
  return {
    gabarit: "analyse",
    view: {
      slug: "projets-ia",
      title: "Pourquoi tant de projets d’IA s’arrêtent",
      category: "Stratégie",
      author: "Manon",
      publishedAt: "2026-01-02",
      updatedAt: "2026-02-03",
      readingTime: "6 min",
      featuredImage: "/photo.jpg",
      featuredImageAlt: "Photo",
      photographerName: null,
      photographerUrl: null,
      keyTakeaway: null,
      expertQuote: null,
      faqItems: [],
      citations: [],
    } as unknown as ArticleGabaritProps["view"],
    locale: "fr",
    html: CORPS,
    blocs: null,
    tocItems: [1, 2, 3, 4, 5].map((n) => ({ anchor: `s${n}`, title: `Section ${n}`, level: 2 })),
    pageUrl: "https://example.test/fr/blog/projets-ia",
    chapo: "Chapô",
    titre: { lead: "Pourquoi tant de projets", em: "s’arrêtent" },
    tldr: "Réponse courte.",
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
    jsonLd: [],
    ...surcharge,
  };
}
const rendre = (p: ArticleGabaritProps) => renderToStaticMarkup(<ArticleGabarit {...p} />);

describe("GabaritAnalyse", () => {
  it("règles communes : data-gabarit, un seul h1, ni <main> ni en-tête de site, héros terracotta", () => {
    const h = rendre(props());
    expect(h).toContain('data-gabarit="analyse"');
    expect(h.match(/<h1\b/g)).toHaveLength(1);
    expect(h).not.toContain("<main");
    expect(h).not.toContain("data-tone");
    expect(h).toContain("heros sur-terracotta");
    expect(h).toContain("4 sem.");
  });

  it("la photo est un <img> et jamais un <svg>", () => {
    const h = rendre(props());
    expect(h).toMatch(/visuel__cadre[^>]*>(?:(?!<\/div>).)*<img/s);
    expect(h).not.toMatch(/visuel__cadre[^>]*>(?:(?!<\/div>).)*<svg/s);
  });

  it("sans featuredImage : photo de repli, jamais de svg", () => {
    const h = rendre(
      props({
        view: { ...props().view, featuredImage: null, featuredImageAlt: null },
      }),
    );
    expect(h).toMatch(/visuel__cadre[^>]*>(?:(?!<\/div>).)*<img/s);
    expect(h).not.toMatch(/visuel__cadre[^>]*>(?:(?!<\/div>).)*<svg/s);
  });

  it("numérote les sections et garde les ids des H2", () => {
    const h = rendre(props());
    expect(h).toContain("01 / 05");
    expect(h).toContain("05 / 05");
    for (let n = 1; n <= 5; n++) expect(h).toContain(`id="s${n}"`);
  });

  it("place l'encart du milieu après la 3e section, avec le Diagnostic IA en bouton principal", () => {
    const h = rendre(props());
    const milieu = h.indexOf("cta-milieu");
    expect(milieu).toBeGreaterThan(h.indexOf('id="s3"'));
    expect(milieu).toBeLessThan(h.indexOf('id="s4"'));
    expect(h).toContain("Diagnostic IA, 45 min");
    expect(h).toContain("Journée IA");
  });

  it("corps court (2 sections) : l'encart du milieu reste rendu, après le corps", () => {
    const h = rendre(
      props({
        html: [1, 2].map(section).join(""),
        tocItems: [1, 2].map((n) => ({ anchor: `s${n}`, title: `S${n}`, level: 2 })),
      }),
    );
    expect(h.indexOf("cta-milieu")).toBeGreaterThan(h.indexOf('id="s2"'));
  });

  it("une relance « Dans la suite » et un sommaire cible « sommaire-article »", () => {
    const h = rendre(props());
    expect(h).toContain("Dans la suite");
    expect(h).toContain('id="sommaire-article"');
  });

  it("« Revenir au sommaire » seulement au-delà de 2 500 mots", () => {
    expect(rendre(props())).not.toContain("Revenir au sommaire");
    const long = CORPS.replace("Texte 1", Array(2600).fill("mot").join(" "));
    expect(rendre(props({ html: long }))).toContain("Revenir au sommaire");
  });

  it("article en fichier (html nul) : blocs rendus, encart du milieu présent", () => {
    const h = rendre(
      props({
        html: null,
        blocs: [
          { kind: "p", text: "Texte" },
          { kind: "ol", items: ["a", "b"] },
        ],
      }),
    );
    expect(h).toContain("<p>Texte</p>");
    expect(h).toContain("cta-milieu");
    expect(h).not.toContain("num-section");
  });

  it("sans FAQ, sans citation : rien n'est inventé (ni citation, ni schéma, ni chiffre clé)", () => {
    const h = rendre(props());
    expect(h).not.toContain('class="citation"');
    expect(h).not.toContain("chiffres__valeur");
    expect(h).not.toContain("schema-causes");
  });

  it("aucun mot interdit dans le HTML produit par le gabarit", () => {
    const h = rendre(props()).replace(/<img[^>]*>/g, "");
    for (const mot of [
      /Grenoble/i,
      /frais de déplacement/i,
      /témoignage/i,
      /avocat/i,
      /réserv/i,
      /<del\b/,
      /<s>/,
      /line-through/,
      /€/,
    ]) {
      expect(h).not.toMatch(mot);
    }
  });

  it('n\'ajoute aucun "use client"', () => {
    for (const f of [
      "src/components/article-v2/gabarits/GabaritAnalyse.tsx",
      "src/lib/blog/analyse.ts",
    ]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/["']use client["']/);
    }
  });
});
