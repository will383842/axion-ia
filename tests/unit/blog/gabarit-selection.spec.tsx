/** Gabarit Sélection (M-G4) — rendu serveur, règles communes du découpage (a, c, d, f, g, h). */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => {
  const lire = (f: string) =>
    JSON.parse(readFileSync(`src/messages/gabarits/${f}.fr.json`, "utf8"));
  const sources: Record<string, unknown> = {
    "articleGabarits.commun": lire("commun"),
    "articleGabarits.selection": lire("selection"),
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

const opt = (t: string, id: string) => `<h2 id="${id}">${t}</h2><p>Texte ${t}</p>`;
const dix = Array.from({ length: 10 }, (_, i) =>
  opt(`Outil ${String.fromCharCode(65 + i)}`, `outil-${String.fromCharCode(97 + i)}`),
).join("");
const TAB =
  '<table><thead><tr><th>Outil</th><th>Usage</th></tr></thead><tbody><tr><th scope="row">SYNTHESE-LIGNE</th><td>Oui</td></tr></tbody></table>';

function props(surcharge: Partial<ArticleGabaritProps> = {}): ArticleGabaritProps {
  return {
    gabarit: "selection",
    view: {
      slug: "top-10",
      title: "10 outils d’IA pour une PME",
      category: "Outils",
      author: "Manon",
      publishedAt: "2026-01-02",
      updatedAt: "2026-02-03",
      readingTime: "8 min",
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
    html: dix,
    blocs: null,
    tocItems: [
      { anchor: "outil-a", title: "Outil A", level: 2 },
      { anchor: "outil-b", title: "Outil B", level: 2 },
    ],
    pageUrl: "https://example.test/fr/blog/top-10",
    chapo: "Chapô",
    titre: { lead: "10 outils d’IA", em: "pour une PME" },
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

describe("GabaritSelection", () => {
  it("rend data-gabarit, un seul h1, ni <main> ni en-tête de site", () => {
    const h = rendre(props());
    expect(h).toContain('data-gabarit="selection"');
    expect(h.match(/<h1\b/g)).toHaveLength(1);
    expect(h).not.toContain("<main");
    expect(h).not.toContain("data-tone");
  });

  it("porte la phrase de neutralité (sans note ni classement)", () => {
    const h = rendre(props());
    const i = h.indexOf('class="neutralite"');
    expect(h.slice(i, h.indexOf("</p>", i))).toContain("financée");
    expect(h).toContain('class="neutralite" data-aeo="neutrality"');
  });

  it("10 options : chacune marquée, total posé en variable CSS, bandeau une fois à mi-liste", () => {
    const h = rendre(props());
    expect(h.match(/data-option="auto"/g)).toHaveLength(10);
    expect(h).toContain("--total-options:10");
    expect(h.match(/class="par-ou"/g)).toHaveLength(1);
    expect(h.indexOf('class="par-ou"')).toBeGreaterThan(h.indexOf('id="outil-e"'));
    expect(h.indexOf('class="par-ou"')).toBeLessThan(h.indexOf('id="outil-f"'));
    expect(h).toContain("Par où commencer");
    expect(h).not.toMatch(/<h2[^>]*par-ou/);
  });

  it("3 options : marquées, pas de bandeau", () => {
    const h = rendre(props({ html: dix.split("</p>").slice(0, 3).join("</p>") + "</p>" }));
    expect(h.match(/data-option="auto"/g)).toHaveLength(3);
    expect(h).toContain("--total-options:3");
    expect(h).not.toContain('class="par-ou"');
  });

  it("le compteur ne vise pas FAQ ni Sources, et ne double pas un numéro du titre", () => {
    const html = `${opt("1. Zapier", "z")}${opt("2. Make", "m")}${opt("Questions fréquentes", "faq")}${opt("Sources et méthode", "src")}`;
    const h = rendre(props({ html }));
    expect(h.match(/data-option="texte"/g)).toHaveLength(2);
    expect(h).not.toContain('data-option="auto"');
    expect(h).not.toMatch(/<h2 id="faq"[^>]*data-option/);
  });

  it("tableau de synthèse remonté après les options, une seule fois, sans note inventée", () => {
    const h = rendre(props({ html: `${dix}${TAB}` }));
    expect(h.match(/SYNTHESE-LIGNE/g)).toHaveLength(1);
    expect(h.indexOf('id="tableau-de-synthese"')).toBeGreaterThan(h.indexOf('id="outil-j"'));
    expect(h).toContain("tableau-de-synthese|Tableau de synthèse");
    expect(h).toMatch(/role="region" tabindex="0" aria-labelledby="tableau-de-synthese-titre"/);
    expect(h).not.toMatch(/\/\s?5|★|étoile|note de/i);
  });

  it("sans tableau : pas de bloc de synthèse ; article en fichier : rend sans erreur", () => {
    expect(rendre(props())).not.toContain("tableau-de-synthese");
    const h = rendre(props({ html: null, blocs: [{ kind: "p", text: "Texte" }] }));
    expect(h).toContain("<p>Texte</p>");
    expect(h).not.toContain("data-option");
  });

  it("CtaMilieu : bouton principal Journée IA (terracotta), lien Diagnostic IA 45 min", () => {
    const h = rendre(props());
    const m = h.slice(h.indexOf('class="cta-milieu"'));
    expect(m).toMatch(/class="btn btn--terracotta"[^>]*data-cta="journee"/);
    expect(m).toMatch(/class="lien-fleche"[^>]*data-cta="diagnostic"/);
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
