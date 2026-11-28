/** PR S2 — rendu serveur de chaque composant commun, des huit gabarits et des variantes V2. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const commun = JSON.parse(readFileSync("src/messages/gabarits/commun.fr.json", "utf8"));
  const chercher = (ns: string, k: string): unknown => {
    if (!ns.startsWith("articleGabarits.commun")) return undefined;
    const chemin = `${ns}.${k}`.replace(/^articleGabarits\.commun\.?/, "");
    return chemin
      .split(".")
      .filter(Boolean)
      .reduce<unknown>((o, c) => (o as Record<string, unknown> | undefined)?.[c], commun);
  };
  const fabrique = (ns: string) =>
    Object.assign(
      (k: string, vars?: Record<string, unknown>) => {
        const v = chercher(ns, k);
        if (typeof v !== "string") return k;
        return v.replace(/\{(\w+)\}/g, (_, n) => String(vars?.[n] ?? ""));
      },
      {
        raw: (k: string) => chercher(ns, k),
        rich: (k: string, v: Record<string, unknown>) => {
          const balise = v.dateBalise as (m: string) => unknown;
          return [k, " ", balise(String(v.date))];
        },
      },
    );
  return { useTranslations: (ns: string) => fabrique(ns ?? "") };
});
vi.mock("next/image", () => ({
  default: (p: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={String(p.alt)}
      src={String(p.src)}
      data-fill={String(p.fill)}
      loading={p.loading as "eager"}
      sizes={String(p.sizes)}
      data-fetchpriority={String(p.fetchPriority)}
      data-priority={String(p.priority)}
    />
  ),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: (p: {
    href: string;
    className?: string;
    children: React.ReactNode;
    "aria-label"?: string;
    "data-cta"?: string;
  }) => (
    <a href={p.href} className={p.className} aria-label={p["aria-label"]} data-cta={p["data-cta"]}>
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
vi.mock("@/components/article-v2/ColonneActionsConnectee", async () => {
  const { ColonneActions } = await import("@/components/article-v2/ColonneActions");
  return {
    ColonneActionsConnectee: ({ gabarit }: { gabarit: string }) =>
      ColonneActions({ gabarit, qualiopiPublie: false }),
  };
});
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
import { PHOTOS_REPLI } from "@/lib/blog/photos-repli";
import type { ArticleGabaritProps } from "@/components/article-v2/types";

const { ArticleGabarit } = await import("@/components/article-v2/ArticleGabarit");
const { HerosArticle } = await import("@/components/article-v2/HerosArticle");
const { PhotoArticle } = await import("@/components/article-v2/PhotoArticle");
const { ColonneActions } = await import("@/components/article-v2/ColonneActions");
const { CtaMilieu } = await import("@/components/article-v2/CtaMilieu");
const { CtaFin } = await import("@/components/article-v2/CtaFin");
const { BarreProgression } = await import("@/components/article-v2/BarreProgression");
const { MiseEnPageLecture } = await import("@/components/article-v2/MiseEnPageLecture");
const { CorpsArticle } = await import("@/components/article-v2/CorpsArticle");
const { TableauDefilant } = await import("@/components/article-v2/TableauDefilant");
const { ArticleEtapes } = await import("@/components/article-v2/ArticleEtapes");
const { EncadreArticle } = await import("@/components/article-v2/EncadreArticle");
const { FicheContexte } = await import("@/components/article-v2/FicheContexte");
const { BlocDefinition } = await import("@/components/article-v2/BlocDefinition");
const { BandeauDonnees } = await import("@/components/article-v2/BandeauDonnees");
const { PiedArticle } = await import("@/components/article-v2/PiedArticle");
const { ArticleTOC } = await import("@/components/seo/ArticleTOC");
const { ArticleFaq } = await import("@/components/content-gen/ArticleFaq");
const { AnswerCard } = await import("@/components/marketing/AnswerCard");

const rendre = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("composants communs (S2)", () => {
  const baseHeros = {
    gabarit: "analyse" as const,
    categorie: "Organisation & IA",
    titre: { lead: "Titre", em: "accent" },
    chapo: "Chapô",
    auteur: "Manon",
    auteurHref: "/equipe/manon",
    publieLe: "2026-01-02",
    tempsLecture: "4 min",
    pageUrl: "https://x.test/fr/blog/a",
    titreArticle: "Titre accent",
  };

  it("HerosArticle : header.heros.sur-terracotta, un h1, jamais un en-tête de site", () => {
    const html = rendre(<HerosArticle {...baseHeros} misAJourLe="2026-02-03" />);
    expect(html).toContain('<header class="heros sur-terracotta">');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("<em>accent</em>");
    expect(html).toContain('<time dateTime="2026-01-02">');
    expect(html).toContain('data-aeo="freshness"');
    expect(html).not.toContain("<main");
    expect(html).not.toContain("data-tone");
    expect(html).not.toContain("site-entete");
    expect(html.match(/<li><a href="(https:\/\/|mailto:)/g)).toHaveLength(3);
    expect(html).toContain('class="heros__signe signe--analyse" aria-hidden="true"');
  });

  it("HerosArticle : « mis à jour » seulement si la date diffère, chapô facultatif", () => {
    const meme = rendre(<HerosArticle {...baseHeros} misAJourLe="2026-01-02" chapo={null} />);
    expect(meme).not.toContain("freshness");
    expect(meme).not.toContain('class="chapo"');
    expect(rendre(<HerosArticle {...baseHeros} misAJourLe={null} />)).not.toContain("freshness");
  });

  it("PhotoArticle : vraie photo, eager, fetchPriority high, sizes imposé, aucun svg", () => {
    const html = rendre(
      <PhotoArticle
        gabarit="analyse"
        src="/x.jpg"
        alt="Alt"
        titre="T"
        photographerName="Jeanne Photo"
        photographerUrl="https://unsplash.com/@jeanne"
      />,
    );
    expect(html).toContain('<figure class="visuel"><div class="visuel__cadre">');
    expect(html).toContain('loading="eager"');
    expect(html).toContain('data-fetchpriority="high"');
    expect(html).toContain('data-priority="undefined"');
    expect(html).toContain('sizes="(min-width: 1024px) 800px, calc(100vw - 32px)"');
    expect(html).toContain('alt="Alt"');
    expect(html).not.toContain("<svg");
    expect(html).toContain("<figcaption>");
    expect(html).toContain("Jeanne Photo");
    expect(html).toContain("utm_source=axion-ia");
  });

  it("PhotoArticle : sans photo d'article, photo de repli de la banque, jamais de SVG", () => {
    for (const code of GABARITS_ARTICLE) {
      const html = rendre(
        <PhotoArticle gabarit={code} src={null} alt={null} titre="Titre de l'article" />,
      );
      expect(html).toContain(PHOTOS_REPLI[code].src);
      expect(html).not.toContain("<svg");
      expect(html).not.toContain("<figcaption>");
    }
  });

  it("BarreProgression : décor aria-hidden", () => {
    expect(rendre(<BarreProgression />)).toBe('<div class="progression" aria-hidden="true"></div>');
  });

  it("ColonneActions : un seul aside, trois liens, aria-label contenant le texte visible", () => {
    const html = rendre(<ColonneActions gabarit="analyse" />);
    expect(html.match(/<aside\b/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Passer à l’action"');
    expect(html.match(/<a /g)).toHaveLength(3);
    expect(html).toContain("depuis=analyse-colonne");
    expect(html).toContain('href="/journee-ia"');
    expect(html).toContain('href="/contact"');
    for (const [visible, aria] of [
      ["Diagnostic IA, 45 min", "Diagnostic IA, 45 min, gratuit"],
      ["Découvrir la Journée IA", "Découvrir la Journée IA"],
      ["Écrire un message", "Écrire un message"],
    ] as const) {
      expect(html).toContain(visible);
      expect(html).toContain(`aria-label="${aria}"`);
    }
    expect(html).not.toContain("btn--bleu");
  });

  it("ColonneActions : la mention Qualiopi n'existe que si l'identité est publiée", () => {
    expect(rendre(<ColonneActions gabarit="analyse" />)).not.toContain("Qualiopi");
    expect(rendre(<ColonneActions gabarit="analyse" qualiopiPublie />)).toContain("Qualiopi");
  });

  it("CtaMilieu : titre en <p> (jamais un h2), un bouton et un lien, principal selon le gabarit", () => {
    const d = rendre(<CtaMilieu gabarit="analyse" />);
    expect(d).not.toMatch(/<h[1-6]/);
    expect(d).toMatch(/<p class="cta-milieu__titre" id="[^"]+-titre">/);
    expect(d).toContain("depuis=analyse-milieu");
    expect(d.match(/class="btn btn--terracotta"/g)).toHaveLength(1);
    const j = rendre(<CtaMilieu gabarit="guide" principal="journee" />);
    expect(j).toMatch(/href="\/journee-ia" class="btn btn--terracotta"/);
  });

  it("CtaFin : trois actions, déroulé en trois étapes, réassurance factuelle", () => {
    const html = rendre(<CtaFin gabarit="analyse" />);
    expect(html.match(/data-cta=/g)).toHaveLength(3);
    expect(html.match(/<ol class="deroule".*?<\/ol>/s)![0].match(/<li>/g)).toHaveLength(3);
    expect(html).toContain("depuis=analyse-fin");
  });

  it("MiseEnPageLecture : article.article puis la colonne ; ni <main> ni en-tête de site", () => {
    const html = rendre(
      <MiseEnPageLecture
        ouverture={<header>O</header>}
        sommaire={<nav>S</nav>}
        colonne={<aside>C</aside>}
      >
        corps
      </MiseEnPageLecture>,
    );
    expect(html).toBe(
      '<div class="conteneur mise-en-page"><article class="article"><header>O</header><nav>S</nav><div class="article__corps prose">corps</div></article><aside>C</aside></div>',
    );
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
    expect(rendre(<CorpsArticle html={null} blocs={null} />)).toBe("<div></div>");
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
    expect(une).toContain('<li id="e1"><h3 class="etapes__titre">Un</h3></li>');
    const cinq = rendre(
      <ArticleEtapes
        niveauTitre={4}
        etapes={[1, 2, 3, 4, 5].map((n) => ({ id: `e${n}`, titre: `T${n}` }))}
      />,
    );
    expect(cinq.match(/<li id=/g)).toHaveLength(5);
    expect(cinq).toContain('<h4 class="etapes__titre">T5</h4>');
  });

  it("EncadreArticle : section nommée, sans role note/alert/status", () => {
    const html = rendre(
      <EncadreArticle id="pt" titre="Point clé">
        <p>Texte</p>
      </EncadreArticle>,
    );
    expect(html).toContain('<section class="encadre encadre--retenir" aria-labelledby="pt">');
    expect(html).toContain('<p id="pt" class="encadre__titre">Point clé</p>');
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
    expect(html).toContain('<time dateTime="2026-10-01">1 octobre 2026</time>');
    expect(html).toContain("/observatoire-ia");
  });

  it("PiedArticle : un seul conteneur", () => {
    const html = rendre(
      <PiedArticle>
        <p>a</p>
        <p>b</p>
      </PiedArticle>,
    );
    expect(html).toBe("<div><p>a</p><p>b</p></div>");
  });
});

describe("variantes V2 des composants partagés", () => {
  const items = [
    { anchor: "un", title: "Un", level: 2 as const },
    { anchor: "u1", title: "Sous-un", level: 3 as const },
    { anchor: "deux", title: "Deux", level: 2 as const },
  ];

  it("ArticleTOC v2 : un seul <nav class=sommaire>, details, H3 imbriqués, pas de pastille", () => {
    const html = rendre(
      <ArticleTOC items={items} pageUrl="https://x.test/p" locale="fr" variante="v2" />,
    );
    expect(html.match(/<nav /g)).toHaveLength(1);
    expect(html).toContain('<nav aria-label="Sommaire" class="sommaire not-prose">');
    expect(html).toContain("<details>");
    expect(html).toContain('<ol><li><a href="#u1">Sous-un</a></li></ol>');
    expect(html).not.toContain("pastille");
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
    expect(defaut).toContain('<details class="not-prose group border-border bg-sand');
    expect(defaut).toContain("lg:sticky lg:top-24");
    expect(defaut).toContain("01</span>");
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
    expect(html).toContain('<h2 id="art-faq-titre" class="bloc-titre">');
    expect(html).toContain('class="faq"');
    expect(html).toContain("data-faq-q");
    expect(html).toContain("data-faq-a");
    expect(html).not.toMatch(/<summary[^>]*>\s*<h[1-6]/);
    expect(html).not.toContain("max-w-[52rem]");
  });

  it("ArticleFaq v2 : niveauTitre 3, rien d'ouvert par défaut", () => {
    const html = rendre(<ArticleFaq items={faq} locale="fr" variante="v2" niveauTitre={3} />);
    expect(html).toContain('<h3 id="art-faq-titre" class="bloc-titre">');
    expect(html).not.toContain("<details open");
  });

  it("ArticleFaq : V1 par défaut = variante v1, avec ses marqueurs historiques", () => {
    const defaut = rendre(<ArticleFaq items={faq} locale="fr" />);
    expect(defaut).toBe(rendre(<ArticleFaq items={faq} locale="fr" variante="v1" />));
    expect(defaut).toContain("max-w-[52rem]");
    expect(defaut).toContain(
      '<h2 class="text-fg inline-flex items-center gap-2.5 text-2xl font-semibold tracking-tight">',
    );
    expect(defaut).toContain("rounded-xl border px-4 py-3.5");
    expect(defaut).not.toContain("art-faq");
    expect(rendre(<ArticleFaq items={[]} locale="fr" variante="v2" />)).toBe("");
  });

  it("AnswerCard v2 : data-aeo et .tldr-answer conservés, V1 intacte par défaut", () => {
    const v2 = rendre(
      <AnswerCard locale="fr" variante="v2" libelle="En bref">
        Texte
      </AnswerCard>,
    );
    expect(v2).toContain('data-aeo="tldr"');
    expect(v2).toContain("tldr-answer");
    expect(v2).toContain('class="en-bref tldr-answer"');
    expect(v2).toContain('role="doc-tip"');
    expect(v2).not.toContain("border-2");
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
    expect(defaut).toContain("bg-halo-warm");
    expect(defaut).toContain("Réponse rapide");
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
      // « definition » masque le sommaire sous 4 entrées (G6) : 3 entrées ici.
      const sommaire = code === "definition" ? 0 : 1;
      for (const ancre of ["a", "b", "c"]) {
        if (sommaire) expect(html).toContain(`href="#${ancre}"`);
        expect(html).toContain(`id='${ancre}'`);
      }
      expect(html.match(/<nav aria-label="Sommaire"/g) ?? []).toHaveLength(sommaire);
      expect(html).toContain('<header class="heros sur-terracotta">');
      expect(html.match(/<aside class="action"/g)).toHaveLength(1);
      expect(html).not.toContain("<main");
      expect(html).not.toContain("data-tone");
      expect(html).toContain("visuel__cadre");
      expect(html).toContain("BlogPosting");
      // Aucun marqueur de la page V1.
      expect(html).not.toContain("max-w-[52rem]");
    },
  );

  it("appels à l'action : une colonne, un encart de milieu, un appel de fin", () => {
    for (const code of GABARITS_ARTICLE) {
      const html = rendre(<ArticleGabarit {...props(code)} />);
      expect(html.match(/<aside class="action"/g)).toHaveLength(1);
      expect(html.match(/class="cta-milieu"/g)).toHaveLength(1);
      expect(html.match(/class="cta-fin sur-sombre"/g)).toHaveLength(1);
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
