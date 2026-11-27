/** PR S2 — rendu serveur de chaque composant commun, des huit gabarits et des variantes V2. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => {
  const t = Object.assign((k: string) => k, {
    rich: (k: string, v: Record<string, unknown>) => {
      const balise = v.dateBalise as (m: string) => unknown;
      return [k, " ", balise(String(v.date))];
    },
  });
  return { useTranslations: () => t };
});
vi.mock("next/image", () => ({
  default: (p: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={String(p.alt)}
      src={String(p.src)}
      loading={p.loading as "eager"}
      sizes={String(p.sizes)}
      data-fetchpriority={String(p.fetchPriority)}
      data-priority={String(p.priority)}
    />
  ),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: (p: { href: string; className?: string; children: React.ReactNode }) => (
    <a href={p.href} className={p.className}>
      {p.children}
    </a>
  ),
}));
vi.mock("@/components/marketing/JsonLd", () => ({
  JsonLd: ({ data }: { data: unknown }) => (
    <script type="application/ld+json">{JSON.stringify(data)}</script>
  ),
}));
vi.mock("@/lib/seo", () => ({ buildFaqJsonLd: () => ({ "@type": "FAQPage" }) }));
vi.mock("@/server/content-gen/shared/faq-sanitizer", () => ({
  sanitizeFaqAnswer: (a: string) => ({ html: a, skip: false }),
}));
for (const m of [
  "@/components/nav/Breadcrumbs",
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
]) {
  vi.doMock(m, () => {
    const nom = m.split("/").pop()!;
    return { [nom]: () => null, aDesSourcesAffichables: () => false };
  });
}

import { GABARITS_ARTICLE } from "@/server/content-gen/blog/gabarits";
import type { ArticleGabaritProps } from "@/components/article-v2/types";

const { ArticleGabarit } = await import("@/components/article-v2/ArticleGabarit");
const { EnteteArticle } = await import("@/components/article-v2/EnteteArticle");
const { HeroImageArticle } = await import("@/components/article-v2/HeroImageArticle");
const { MiseEnPageLecture } = await import("@/components/article-v2/MiseEnPageLecture");
const { CorpsArticle } = await import("@/components/article-v2/CorpsArticle");
const { TableauDefilant } = await import("@/components/article-v2/TableauDefilant");
const { ArticleEtapes } = await import("@/components/article-v2/ArticleEtapes");
const { EncadreArticle } = await import("@/components/article-v2/EncadreArticle");
const { FicheContexte } = await import("@/components/article-v2/FicheContexte");
const { BlocDefinition } = await import("@/components/article-v2/BlocDefinition");
const { BandeauDonnees } = await import("@/components/article-v2/BandeauDonnees");
const { PiedArticle } = await import("@/components/article-v2/PiedArticle");
const { CtaGabarit } = await import("@/components/article-v2/CtaGabarit");
const { ArticleTOC } = await import("@/components/seo/ArticleTOC");
const { ArticleFaq } = await import("@/components/content-gen/ArticleFaq");
const { AnswerCard } = await import("@/components/marketing/AnswerCard");

const rendre = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("composants communs (S2)", () => {
  it("EnteteArticle : un h1, une ligne de méta, « mis à jour » seulement si différent", () => {
    const base = {
      surtitre: "Analyse · Cat",
      titre: { lead: "Titre", em: "accent" },
      chapo: "Chapô",
      auteur: "Manon",
      auteurHref: "/equipe/manon",
      publieLe: "2026-01-02",
      tempsLecture: "4 min",
    };
    const diff = rendre(<EnteteArticle {...base} misAJourLe="2026-02-03" />);
    expect(diff.match(/<h1\b/g)).toHaveLength(1);
    expect(diff).toContain("<em>accent</em>");
    expect(diff).toContain('<time datetime="2026-01-02">');
    expect(diff).toContain('<time datetime="2026-02-03">');
    expect(diff.match(/<ul class="art-meta">/g)).toHaveLength(1);
    const meme = rendre(<EnteteArticle {...base} misAJourLe="2026-01-02" />);
    expect(meme).not.toContain("updatedOn");
    const aucun = rendre(<EnteteArticle {...base} misAJourLe={null} chapo={null} />);
    expect(aucun).not.toContain("art-chapo");
    expect(aucun).not.toContain("art-avec-image");
  });

  it("EnteteArticle : l'image place l'en-tête sur deux colonnes", () => {
    const html = rendre(
      <EnteteArticle
        surtitre="s"
        titre={{ lead: "T" }}
        chapo={null}
        auteur="A"
        auteurHref="/a"
        publieLe="2026-01-02"
        misAJourLe={null}
        tempsLecture="1 min"
        media={<span>IMG</span>}
      />,
    );
    expect(html).toContain("art-avec-image");
    expect(html).toContain("IMG");
  });

  it("HeroImageArticle : eager, fetchPriority high, sizes imposé, pas de priority", () => {
    const html = rendre(
      <HeroImageArticle src="/x.jpg" alt="Alt" photographerName={null} photographerUrl={null} />,
    );
    expect(html).toContain('loading="eager"');
    expect(html).toContain('data-fetchpriority="high"');
    expect(html).toContain('data-priority="undefined"');
    expect(html).toContain(
      'sizes="(min-width: 1366px) 565px, (min-width: 1024px) 45vw, calc(100vw - 2rem)"',
    );
    expect(html).toContain('alt="Alt"');
  });

  it("HeroImageArticle : le crédit Unsplash est conservé", () => {
    const html = rendre(
      <HeroImageArticle
        src="/x.jpg"
        alt="Alt"
        photographerName="Jeanne Photo"
        photographerUrl="https://unsplash.com/@jeanne"
      />,
    );
    expect(html).toContain("Jeanne Photo");
    expect(html).toContain("utm_source=axion-ia");
  });

  it("MiseEnPageLecture : avec et sans sommaire", () => {
    const avec = rendre(<MiseEnPageLecture sommaire={<nav>S</nav>}>corps</MiseEnPageLecture>);
    expect(avec).toContain("<nav>S</nav>");
    expect(avec).not.toContain("art-sans-sommaire");
    const sans = rendre(<MiseEnPageLecture>corps</MiseEnPageLecture>);
    expect(sans).toContain("art-sans-sommaire");
  });

  it("CorpsArticle : HTML tel quel, ou blocs d'un article en fichier", () => {
    expect(rendre(<CorpsArticle html="<p>Corps</p>" blocs={null} />)).toContain("<p>Corps</p>");
    const blocs = rendre(
      <CorpsArticle
        html={null}
        blocs={[
          { kind: "p", text: "Texte" },
          { kind: "ol", items: ["a", "b"] },
        ]}
      />,
    );
    expect(blocs).toContain("<p>Texte</p>");
    expect(blocs.match(/<li>/g)).toHaveLength(2);
    expect(rendre(<CorpsArticle html={null} blocs={null} />)).toContain("art-corps");
  });

  it("TableauDefilant : région focusable nommée par la caption", () => {
    const html = rendre(
      <TableauDefilant id="cap-1" legende="Légende">
        <tbody>
          <tr>
            <th scope="row">A</th>
            <td>1</td>
          </tr>
        </tbody>
      </TableauDefilant>,
    );
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-labelledby="cap-1"');
    expect(html).toContain('<caption id="cap-1">Légende</caption>');
  });

  it("ArticleEtapes : 0, 1 et 5 étapes, ids uniques", () => {
    expect(rendre(<ArticleEtapes etapes={[]} />)).toBe("");
    const une = rendre(<ArticleEtapes etapes={[{ id: "e1", titre: "Un" }]} />);
    expect(une).toContain('<li id="e1"><h3>Un</h3></li>');
    const cinq = rendre(
      <ArticleEtapes
        niveauTitre={4}
        etapes={[1, 2, 3, 4, 5].map((n) => ({ id: `e${n}`, titre: `T${n}` }))}
      />,
    );
    expect(cinq.match(/<li id=/g)).toHaveLength(5);
    expect(cinq).toContain("<h4>T5</h4>");
  });

  it("EncadreArticle : section nommée, sans role note/alert/status", () => {
    const html = rendre(
      <EncadreArticle id="pt" titre="Point clé">
        <p>Texte</p>
      </EncadreArticle>,
    );
    expect(html).toContain('<section class="art-encadre" aria-labelledby="pt">');
    expect(html).toContain('<p id="pt" class="art-encadre-titre">Point clé</p>');
    expect(html).not.toMatch(/role="(note|alert|status)"/);
  });

  it("FicheContexte : champs absents omis, fiche vide non rendue, aucun chiffre ajouté", () => {
    const vide = rendre(
      <FicheContexte
        lignes={[
          { libelle: "Secteur", valeur: null },
          { libelle: "Ville", valeur: "  " },
        ]}
      />,
    );
    expect(vide).toBe("");
    const html = rendre(
      <FicheContexte
        lignes={[
          { libelle: "Secteur", valeur: "Services" },
          { libelle: "Ville", valeur: undefined },
          { libelle: "Catégorie", valeur: "Cas" },
        ]}
      />,
    );
    expect(html).toContain("<dt>Secteur</dt><dd>Services</dd>");
    expect(html).not.toContain("<dt>Ville</dt>");
    expect(html).not.toContain("<strong");
  });

  it("BlocDefinition : le terme est dans <dfn>", () => {
    const html = rendre(
      <BlocDefinition terme="Terme" libelle="Définition">
        Sa définition.
      </BlocDefinition>,
    );
    expect(html).toContain("<dfn>Terme</dfn>");
    expect(html).toContain("Sa définition.");
  });

  it("BandeauDonnees : rendu seulement si la date du relevé existe", () => {
    expect(rendre(<BandeauDonnees dateIso={null} dateLisible="" />)).toBe("");
    const html = rendre(<BandeauDonnees dateIso="2026-10-01" dateLisible="1 octobre 2026" />);
    expect(html).toContain('<time datetime="2026-10-01">1 octobre 2026</time>');
    expect(html).toContain("/observatoire-ia");
  });

  it("PiedArticle : un seul conteneur", () => {
    const html = rendre(
      <PiedArticle>
        <p>a</p>
        <p>b</p>
      </PiedArticle>,
    );
    expect(html.match(/art-pied/g)).toHaveLength(1);
  });

  it("CtaGabarit : trois variantes, un lien chacune, h2 nommé", () => {
    const audit = rendre(<CtaGabarit variante="audit" />);
    expect(audit).toContain('href="/audit"');
    expect(audit).toContain('aria-labelledby="art-cta-titre"');
    expect(rendre(<CtaGabarit variante="rdv" />)).toContain('href="/appel"');
    expect(rendre(<CtaGabarit variante="journeeIa" />)).toMatch(/href="\/[^"]+"/);
    expect(audit.match(/<a /g)).toHaveLength(1);
  });
});

describe("variantes V2 des composants partagés", () => {
  const items = [
    { anchor: "un", title: "Un", level: 2 as const },
    { anchor: "u1", title: "Sous-un", level: 3 as const },
    { anchor: "deux", title: "Deux", level: 2 as const },
  ];

  it("ArticleTOC v2 : deux <nav aria-label>, H3 imbriqués, pastilles aria-hidden", () => {
    const html = rendre(
      <ArticleTOC items={items} pageUrl="https://x.test/p" locale="fr" variante="v2" />,
    );
    expect(html.match(/<nav aria-label="Sommaire"/g)).toHaveLength(2);
    expect(html).toContain("<details");
    expect(html).toContain('aria-hidden="true" class="art-toc-pastille"');
    expect(html).toContain('<ol><li><a href="#u1">Sous-un</a></li></ol>');
    // Les H3 ne portent pas de pastille : seuls les H2 sont numérotés.
    expect(html.match(/art-toc-pastille/g)).toHaveLength(4);
  });

  it("ArticleTOC v2 : niveauMax 2 retire les H3", () => {
    const html = rendre(
      <ArticleTOC
        items={items}
        pageUrl="https://x.test/p"
        locale="fr"
        variante="v2"
        niveauMax={2}
      />,
    );
    expect(html).not.toContain("Sous-un");
  });

  it("ArticleTOC : V1 par défaut identique à variante v1 explicite, sans marqueur V2", () => {
    const defaut = rendre(<ArticleTOC items={items} pageUrl="https://x.test/p" locale="fr" />);
    const v1 = rendre(
      <ArticleTOC items={items} pageUrl="https://x.test/p" locale="fr" variante="v1" />,
    );
    expect(defaut).toBe(v1);
    expect(defaut).not.toContain("art-toc");
    expect(defaut).not.toContain("min-h-11");
    expect(defaut).toContain('<nav aria-label="Sommaire"');
    expect(defaut.match(/<nav /g)).toHaveLength(1);
  });

  it("ArticleTOC V1 : cibleTactile ajoute min-h-11 sans rien d'autre", () => {
    const sans = rendre(<ArticleTOC items={items} pageUrl="https://x.test/p" locale="fr" />);
    const avec = rendre(
      <ArticleTOC items={items} pageUrl="https://x.test/p" locale="fr" cibleTactile />,
    );
    expect(avec.replaceAll(" min-h-11", "")).toBe(sans);
  });

  const faq = [
    { question: "Une ?", answer: "<p>Réponse un.</p>" },
    { question: "Deux ?", answer: "<p>Réponse deux.</p>" },
  ];

  it("ArticleFaq v2 : première ouverte, padding sur summary, aucun titre dans summary", () => {
    const html = rendre(<ArticleFaq items={faq} locale="fr" variante="v2" premiereOuverte />);
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html.match(/<details open/g)).toHaveLength(1);
    expect(html).toContain('<h2 id="faq">');
    expect(html).toContain("data-faq-q");
    expect(html).toContain("data-faq-a");
    expect(html).not.toMatch(/<summary[^>]*>\s*<h[1-6]/);
    expect(html).not.toContain("max-w-[52rem]");
  });

  it("ArticleFaq v2 : niveauTitre 3, rien d'ouvert par défaut", () => {
    const html = rendre(<ArticleFaq items={faq} locale="fr" variante="v2" niveauTitre={3} />);
    expect(html).toContain('<h3 id="faq">');
    expect(html).not.toContain("<details open");
  });

  it("ArticleFaq : V1 par défaut = variante v1, avec ses marqueurs historiques", () => {
    const defaut = rendre(<ArticleFaq items={faq} locale="fr" />);
    expect(defaut).toBe(rendre(<ArticleFaq items={faq} locale="fr" variante="v1" />));
    expect(defaut).toContain("max-w-[52rem]");
    expect(defaut).not.toContain("art-faq");
    expect(rendre(<ArticleFaq items={[]} locale="fr" variante="v2" />)).toBe("");
  });

  it("AnswerCard v2 : data-aeo et .tldr-answer conservés, V1 intacte par défaut", () => {
    const v2 = rendre(
      <AnswerCard locale="fr" variante="v2" libelle="Réponse directe">
        Texte
      </AnswerCard>,
    );
    expect(v2).toContain('data-aeo="tldr"');
    expect(v2).toContain("tldr-answer");
    expect(v2).toContain("border-2");
    expect(v2).not.toContain("doc-tip");
    const defaut = rendre(<AnswerCard locale="fr">Texte</AnswerCard>);
    expect(defaut).toBe(
      rendre(
        <AnswerCard locale="fr" variante="v1">
          Texte
        </AnswerCard>,
      ),
    );
    expect(defaut).toContain('role="doc-tip"');
    expect(defaut).toContain("border-l-4");
  });
});

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

const props = (gabarit: ArticleGabaritProps["gabarit"]): ArticleGabaritProps => ({
  gabarit,
  view,
  locale: "fr",
  html: "<h2 id='a'>Un</h2><p>Corps</p><h2 id='b'>Deux</h2><h2 id='c'>Trois</h2>",
  blocs: null,
  tocItems: [
    { anchor: "a", title: "Un", level: 2 },
    { anchor: "b", title: "Deux", level: 2 },
    { anchor: "c", title: "Trois", level: 2 },
  ],
  pageUrl: "https://example.test/fr/blog/mon-article",
  chapo: "Chapô",
  titre: { lead: "Mon article" },
  tldr: "Réponse courte",
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
});

describe("aiguillage vers les huit gabarits (S2)", () => {
  it.each(GABARITS_ARTICLE)(
    "%s : data-gabarit, un seul h1, ancres du sommaire présentes",
    (code) => {
      const html = rendre(<ArticleGabarit {...props(code)} />);
      expect(html).toContain(`data-gabarit="${code}"`);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      for (const ancre of ["a", "b", "c"]) {
        expect(html).toContain(`href="#${ancre}"`);
        expect(html).toContain(`id='${ancre}'`);
      }
      expect(html.match(/<nav aria-label="sommaire"/g)).toHaveLength(2);
      expect(html).toContain("BlogPosting");
      // Aucun marqueur de la page V1.
      expect(html).not.toContain("max-w-[52rem]");
    },
  );

  it("un seul appel à l'action par page", () => {
    for (const code of GABARITS_ARTICLE) {
      expect(rendre(<ArticleGabarit {...props(code)} />).match(/art-cta-bouton/g)).toHaveLength(1);
    }
  });

  it("pas de saut de niveau de titre dans le squelette (h1 puis h2)", () => {
    const html = rendre(<ArticleGabarit {...props("analyse")} />);
    const niveaux = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    for (let i = 1; i < niveaux.length; i++) {
      expect(niveaux[i]! - niveaux[i - 1]!).toBeLessThanOrEqual(1);
    }
  });
});
