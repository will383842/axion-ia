/** Gabarit Comparatif (M-G3) — rendu serveur, règles communes du découpage (a, c, d, f, g, h). */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => {
  const lire = (f: string) =>
    JSON.parse(readFileSync(`src/messages/gabarits/${f}.fr.json`, "utf8"));
  const sources: Record<string, unknown> = {
    "articleGabarits.commun": lire("commun"),
    "articleGabarits.comparatif": lire("comparatif"),
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

const T1 =
  '<table><thead><tr><th>Critère</th><th>A</th><th>B</th></tr></thead><tbody><tr><th scope="row">Données</th><td>Oui</td><td>Partiel</td></tr></tbody></table>';
const T2 = "<table><tbody><tr><td>SECOND-TABLEAU</td></tr></tbody></table>";
const CORPS = `<h2 id="un">Un</h2><p>Corps</p>${T1}<h2 id="deux">Deux</h2>${T2}`;

function props(surcharge: Partial<ArticleGabaritProps> = {}): ArticleGabaritProps {
  return {
    gabarit: "comparatif",
    view: {
      slug: "a-ou-b",
      title: "ChatGPT ou Copilot : lequel choisir ?",
      category: "Outils",
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
    tocItems: [
      { anchor: "un", title: "Un", level: 2 },
      { anchor: "deux", title: "Deux", level: 2 },
    ],
    pageUrl: "https://example.test/fr/blog/a-ou-b",
    chapo: "Chapô",
    titre: { lead: "ChatGPT ou Copilot", em: "lequel choisir ?" },
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

describe("GabaritComparatif", () => {
  it("rend data-gabarit, un seul h1, ni <main> ni en-tête de site, aucun svg dans la photo", () => {
    const h = rendre(props());
    expect(h).toContain('data-gabarit="comparatif"');
    expect(h.match(/<h1\b/g)).toHaveLength(1);
    expect(h).not.toContain("<main");
    expect(h).not.toContain("data-tone");
    expect(h).not.toMatch(/visuel__cadre">(?:(?!<\/div>).)*<svg/s);
  });

  it("porte la phrase de neutralité avant le face-à-face", () => {
    const h = rendre(props());
    expect(h).toContain('class="neutralite" data-aeo="neutrality"');
    expect(h.indexOf("neutralite")).toBeLessThan(h.indexOf('class="duel"'));
  });

  it("rend le face-à-face A / ou / B tiré du titre, sans gagnant ni note", () => {
    const h = rendre(props());
    expect(h).toContain('class="duel" role="group"');
    expect(h).toContain("ChatGPT");
    expect(h).toContain("Copilot");
    expect(h).toContain('class="duel__ou" aria-hidden="true"');
    const duel = h.slice(h.indexOf('class="duel"'), h.indexOf("</section>"));
    expect(duel).not.toMatch(/gagnant|meilleur|note\s*:/i);
  });

  it("sans « A ou B » dans le titre : pas de face-à-face", () => {
    const h = rendre(props({ view: { ...props().view, title: "Quel outil choisir ?" } }));
    expect(h).not.toContain('class="duel"');
  });

  it("remonte le premier tableau une seule fois, garde le second dans le corps", () => {
    const h = rendre(props());
    expect(h.match(/<table/g)).toHaveLength(2);
    expect(h.match(/Données/g)).toHaveLength(1);
    expect(h.indexOf('id="tableau-recapitulatif"')).toBeLessThan(h.indexOf("Corps"));
    expect(h.indexOf("SECOND-TABLEAU")).toBeGreaterThan(h.indexOf("Corps"));
    expect(h).toContain('role="region" tabindex="0"');
  });

  it("marque les cellules Oui / Partiel en gardant le texte", () => {
    const h = rendre(props());
    expect(h).toContain('<td class="cellule cellule--oui">Oui</td>');
    expect(h).toContain('<td class="cellule cellule--partiel">Partiel</td>');
  });

  it("ajoute « Tableau récapitulatif » en tête du sommaire", () => {
    const h = rendre(props());
    expect(h).toContain("tableau-recapitulatif|Tableau récapitulatif;un|Un;deux|Deux");
  });

  it("sans tableau : ni bloc récapitulatif ni entrée de sommaire, corps intact", () => {
    const h = rendre(props({ html: '<h2 id="un">Un</h2><p>Corps</p>' }));
    expect(h).not.toContain("tableau-recapitulatif");
    expect(h).not.toContain("comparo");
    expect(h).toContain("<p>Corps</p>");
  });

  it("article en fichier (sans HTML) : rend sans erreur, sans tableau", () => {
    const h = rendre(props({ html: null, blocs: [{ kind: "p", text: "Texte" }] }));
    expect(h).toContain("<p>Texte</p>");
    expect(h).not.toContain("tableau-recapitulatif");
  });

  it("CtaMilieu : bouton Diagnostic IA 45 min, lien « Écrire un message »", () => {
    const h = rendre(props());
    const milieu = h.slice(h.indexOf('class="cta-milieu"'));
    expect(milieu).toMatch(/class="btn btn--terracotta"[^>]*data-cta="diagnostic"/);
    expect(milieu).toMatch(/data-cta="message"/);
    expect(milieu).toContain("Écrire un message");
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
