/** Gabarit Questions-réponses (G7) — rendu serveur, règles communes du découpage (a, c, d, f, g, h). */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => {
  const lire = (f: string) =>
    JSON.parse(readFileSync(`src/messages/gabarits/${f}.fr.json`, "utf8"));
  const sources: Record<string, unknown> = {
    "articleGabarits.commun": lire("commun"),
    "articleGabarits.faq": lire("faq"),
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

const QUESTIONS = Array.from({ length: 6 }, (_, i) => ({
  question: `Question numéro ${i + 1} ?`,
  answer: `<p>Réponse numéro ${i + 1}.</p>`,
}));

function props(surcharge: Partial<ArticleGabaritProps> = {}): ArticleGabaritProps {
  return {
    gabarit: "faq",
    view: {
      slug: "faq-ia",
      title: "IA et données : les questions des dirigeants",
      category: "Données",
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
      faqItems: QUESTIONS,
      citations: [],
    } as unknown as ArticleGabaritProps["view"],
    locale: "fr",
    html: '<h2 id="contexte">Contexte</h2><p>Corps</p>',
    blocs: null,
    tocItems: [{ anchor: "contexte", title: "Contexte", level: 2 }],
    pageUrl: "https://example.test/fr/blog/faq-ia",
    chapo: "Chapô",
    titre: { lead: "IA et données", em: "les questions des dirigeants" },
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

describe("GabaritFaq", () => {
  it("rend data-gabarit, un seul h1, ni <main> ni en-tête de site, aucun svg dans la photo", () => {
    const h = rendre(props());
    expect(h).toContain('data-gabarit="faq"');
    expect(h.match(/<h1\b/g)).toHaveLength(1);
    expect(h).not.toContain("<main");
    expect(h).not.toContain("data-tone");
    expect(h).not.toMatch(/visuel__cadre">(?:(?!<\/div>).)*<svg/s);
    expect(h).toMatch(/visuel__cadre">(?:(?!<\/div>).)*<img/s);
  });

  it("n'ajoute aucun JavaScript client : <details> natifs, aucun script hors JSON-LD", () => {
    const h = rendre(props());
    expect(h).toContain("<details");
    expect(h.match(/<script(?![^>]*application\/ld\+json)/g) ?? []).toHaveLength(0);
  });

  it("la FAQ vient juste après la réponse directe, avant le corps, première question ouverte", () => {
    const h = rendre(props());
    expect(h.indexOf('class="faq"')).toBeGreaterThan(-1);
    expect(h.indexOf('class="faq"')).toBeLessThan(h.indexOf("<p>Corps</p>"));
    expect(h.match(/<details[^>]*\sopen=""/g)).toHaveLength(1);
    expect(h).toMatch(/<details id="q-1" open="">/);
    expect(h).not.toContain('<details id="q-2" open');
  });

  it("chaque question a une ancre q-N, et la grille en renvoie une par question, hors <nav>", () => {
    const h = rendre(props());
    for (let i = 1; i <= 6; i++) {
      expect(h).toContain(`id="q-${i}"`);
      expect(h).toContain(`href="#q-${i}"`);
    }
    const grille = h.slice(h.indexOf('class="grille-q'));
    expect(grille).toContain("Les 6 questions,");
    expect(h.match(/<nav\b/g)).toHaveLength(1); // le sommaire seul
  });

  it("le sommaire liste les questions (même ancres que la grille)", () => {
    const h = rendre(props());
    expect(h).toContain("q-1|Question numéro 1 ?");
    expect(h).toContain("q-6|Question numéro 6 ?");
  });

  it("chaque question rendue porte data-faq-q, et une seule FAQPage est émise", () => {
    const h = rendre(props());
    expect(h.match(/data-faq-q="true"/g)).toHaveLength(6);
    for (const q of QUESTIONS) expect(h).toContain(`data-faq-q="true">${q.question}`);
    expect(h.match(/"@type":"FAQPage"/g)).toHaveLength(1);
  });

  it("l'encart « Votre question n'est pas là ? » vient après la 4e question, bouton Écrire un message", () => {
    const h = rendre(props());
    const encart = h.indexOf("Votre question n’est pas là ?");
    expect(encart).toBeGreaterThan(h.indexOf('id="q-4"'));
    expect(encart).toBeLessThan(h.indexOf('id="q-5"'));
    const bloc = h.slice(h.indexOf("cta-milieu"), h.indexOf("</aside>", h.indexOf("cta-milieu")));
    expect(bloc).toMatch(/class="btn btn--contour"[^>]*data-cta="message"/);
    expect(bloc).toMatch(/data-cta="diagnostic"/);
    expect(bloc).toContain("Diagnostic IA, 45 min");
  });

  it("moins de 4 questions : l'encart suit la dernière question", () => {
    const h = rendre(props({ view: { ...props().view, faqItems: QUESTIONS.slice(0, 2) } }));
    expect(h.indexOf("Votre question n’est pas là ?")).toBeGreaterThan(h.indexOf('id="q-2"'));
  });

  it("réponses vides écartées : la grille ne compte que les questions rendues", () => {
    const items = [...QUESTIONS.slice(0, 2), { question: "Vide ?", answer: "" }];
    const h = rendre(props({ view: { ...props().view, faqItems: items } }));
    expect(h).toContain("Les 2 questions,");
    expect(h).not.toContain('id="q-3"');
  });

  it("sans question : mise en page Analyse, ni grille ni encart", () => {
    const h = rendre(props({ view: { ...props().view, faqItems: [] } }));
    expect(h).not.toContain("grille-q");
    expect(h).not.toContain("Votre question n’est pas là ?");
    expect(h).toContain("<p>Corps</p>");
  });

  it("qa_derived : H1 du corps abaissé en h2, aucun JSON-LD dans le corps, une seule FAQPage", () => {
    const corps =
      '<h1>Titre du corps</h1><p>Texte</p><script type="application/ld+json">{"@type":"FAQPage","mainEntity":[]}</script>';
    const h = rendre(props({ html: corps, tocItems: [] }));
    expect(h.match(/<h1\b/g)).toHaveLength(1);
    expect(h).toContain("<h2>Titre du corps</h2>");
    expect(h.match(/"@type":"FAQPage"/g)).toHaveLength(1);
    expect(h).not.toContain('"mainEntity":[]');
  });

  it("article en fichier (sans HTML) : rend sans erreur", () => {
    const h = rendre(props({ html: null, blocs: [{ kind: "p", text: "Texte" }] }));
    expect(h).toContain("<p>Texte</p>");
    expect(h).toContain('id="q-1"');
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

describe("GabaritFaq — cas limites de relecture", () => {
  it("qa_derived réel : la section « questions associées » du corps n'est pas rendue une seconde fois", () => {
    const corps =
      '<p class="tldr-answer">Réponse directe.</p><section class="related-qa" data-aeo="related-faq"><h2>Questions fréquentes associées</h2><div class="faq-item"><h3 class="faq-question">Question numéro 1 ?</h3><div class="faq-answer"><p>Réponse numéro 1.</p></div></div></section><p>Suite</p>';
    const h = rendre(props({ html: corps, tocItems: [] }));
    expect(h).not.toContain("related-qa");
    expect(h).not.toContain("faq-question");
    expect(h.match(/data-faq-q="true">Question numéro 1/g)).toHaveLength(1);
    expect(h).toContain("<p>Suite</p>");
  });

  it("une seule question : titre au singulier, pas de sommaire", () => {
    const h = rendre(props({ view: { ...props().view, faqItems: QUESTIONS.slice(0, 1) } }));
    expect(h).toContain("La question,");
    expect(h).not.toContain("Les 1 questions");
    expect(h).not.toContain('class="sommaire"');
  });

  it("espace fine insécable (U+202F) avant le « ? » de l'encart", () => {
    expect(rendre(props())).toContain("Votre question n’est pas là ?");
  });

  it("ArticleFaq sans `ancres` ne pose aucun id q-N (rétro-compatibilité)", async () => {
    const { ArticleFaq } = await import("@/components/content-gen/ArticleFaq");
    const h = renderToStaticMarkup(
      <ArticleFaq items={QUESTIONS} locale="fr" variante="v2" premiereOuverte />,
    );
    expect(h).not.toContain('id="q-');
    expect(h.match(/<details/g)).toHaveLength(6);
  });
});
