/** Gabarit Définition (G6) — rendu serveur, règles communes du découpage (a, c, d, f, g, h). */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => {
  const lire = (f: string) =>
    JSON.parse(readFileSync(`src/messages/gabarits/${f}.fr.json`, "utf8"));
  const sources: Record<string, unknown> = {
    "articleGabarits.commun": lire("commun"),
    "articleGabarits.definition": lire("definition"),
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
  Link: (p: {
    href: string;
    className?: string;
    children: React.ReactNode;
    "data-cta"?: string;
  }) => (
    <a href={p.href} className={p.className} data-cta={p["data-cta"]}>
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

const CORPS = '<h2 id="un">Un</h2><p>Corps 12 jours</p><h2 id="deux">Deux</h2><p>Suite</p>';

function props(surcharge: Partial<ArticleGabaritProps> = {}): ArticleGabaritProps {
  return {
    gabarit: "definition",
    view: {
      slug: "rag",
      title: "Qu’est-ce que le RAG ?",
      category: "Cas d’usage",
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
      tags: ["rag", "inconnu-du-glossaire"],
    } as unknown as ArticleGabaritProps["view"],
    locale: "fr",
    html: CORPS,
    blocs: null,
    tocItems: [
      { anchor: "un", title: "Un", level: 2 },
      { anchor: "deux", title: "Deux", level: 2 },
    ],
    pageUrl: "https://example.test/fr/blog/rag",
    chapo: "Chapô",
    titre: { lead: "Qu’est-ce que le RAG", em: "?" },
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

const TOC5 = ["a", "b", "c", "d", "e"].map((x) => ({
  anchor: x,
  title: `T${x}`,
  level: 2 as const,
}));
const corps5 = TOC5.map((t) => `<h2 id="${t.anchor}">${t.title}</h2>`).join("") + "<p>Corps</p>";

describe("GabaritDefinition", () => {
  it("rend data-gabarit, un seul h1, ni <main> ni en-tête de site, aucun svg dans la photo", () => {
    const h = rendre(props());
    expect(h).toContain('data-gabarit="definition"');
    expect(h.match(/<h1\b/g)).toHaveLength(1);
    expect(h).not.toContain("<main");
    expect(h).not.toContain("data-tone");
    expect(h).not.toMatch(/visuel__cadre">(?:(?!<\/div>).)*<svg/s);
  });

  it("sommaire masqué sous 4 entrées (2 entrées)", () => {
    expect(rendre(props())).not.toContain('class="sommaire"');
  });

  it("sommaire gardé avec 5 entrées", () => {
    const h = rendre(props({ tocItems: TOC5, html: corps5 }));
    expect(h).toContain('class="sommaire"');
  });

  it("termes liés : pastilles pour les étiquettes présentes au glossaire seulement", () => {
    const h = rendre(props());
    expect(h).toContain('class="termes-lies"');
    expect(h).toContain('href="/glossaire/rag"');
    expect(h).not.toContain("inconnu-du-glossaire");
  });

  it("sans termes liés : aucun bloc, mais le lien vers le glossaire reste dans l'encart", () => {
    const h = rendre(props({ view: { ...props().view, tags: ["inconnu"] } as never }));
    expect(h).not.toContain('class="termes-lies"');
    expect(h).toContain('href="/glossaire"');
  });

  it("aucune prononciation ni sigle inventés", () => {
    const h = rendre(props());
    expect(h).not.toMatch(/prononc|sigle/i);
  });

  it("CtaMilieu : bouton Diagnostic IA 45 min, lien « Le glossaire complet »", () => {
    const h = rendre(props());
    const milieu = h.slice(h.indexOf('class="cta-milieu"'));
    expect(milieu).toMatch(/class="btn btn--terracotta"[^>]*data-cta="diagnostic"/);
    expect(milieu).toMatch(/href="\/glossaire"[^>]*data-cta="glossaire"/);
    expect(milieu).toContain("Le glossaire complet");
  });

  it("article en fichier (sans HTML) : rend sans erreur", () => {
    const h = rendre(props({ html: null, blocs: [{ kind: "p", text: "Texte" }] }));
    expect(h).toContain("<p>Texte</p>");
  });

  it("aucun mot interdit dans le balisage produit par le gabarit", () => {
    const h = rendre(props({ html: "<p>Corps</p>" })).toLowerCase();
    for (const mot of [
      "grenoble",
      "prix",
      "frais de déplacement",
      "témoignage",
      "avocat",
      "réserv",
      "<del",
      "<s>",
      "line-through",
    ])
      expect(h, mot).not.toContain(mot);
  });
});
