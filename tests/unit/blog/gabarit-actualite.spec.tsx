/**
 * PR M-A1 — gabarit « Actualité » (/actualites/[slug]) : rendu serveur, photo, triptyque,
 * source d'origine, colonne d'actions, aiguillage derrière l'interrupteur, textes.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", async () => {
  const { readFileSync: lire } = await import("node:fs");
  const fichiers: Record<string, unknown> = {
    commun: JSON.parse(lire("src/messages/gabarits/commun.fr.json", "utf8")),
    actualite: JSON.parse(lire("src/messages/gabarits/actualite.fr.json", "utf8")),
  };
  const chercher = (ns: string, k: string): unknown => {
    const m = /^articleGabarits\.([a-z]+)\.?(.*)$/.exec(ns);
    if (!m) return undefined;
    const chemin = `${m[2]}.${k}`.split(".").filter(Boolean);
    return chemin.reduce<unknown>(
      (o, c) => (o as Record<string, unknown> | undefined)?.[c],
      fichiers[m[1]!],
    );
  };
  const fabrique = (ns: string) =>
    Object.assign(
      (k: string, vars?: Record<string, unknown>) => {
        const v = chercher(ns, k);
        if (typeof v !== "string") return k;
        return v.replace(/\{(\w+)\}/g, (_, n) => String(vars?.[n] ?? ""));
      },
      { raw: (k: string) => chercher(ns, k) },
    );
  return { useTranslations: (ns: string) => fabrique(ns ?? "") };
});
vi.mock("next/image", () => ({
  default: (p: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={String(p.alt)}
      src={String(p.src)}
      loading={p.loading as "eager"}
      data-fetchpriority={String(p.fetchPriority)}
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
vi.mock("@/components/article-v2/ColonneActionsConnectee", async () => {
  const { ColonneActions } = await import("@/components/article-v2/ColonneActions");
  return {
    ColonneActionsConnectee: ({ gabarit }: { gabarit: string }) =>
      ColonneActions({ gabarit, qualiopiPublie: false }),
  };
});
// Briques existantes : repères lisibles pour vérifier la structure de la page.
for (const m of [
  "@/components/nav/Breadcrumbs",
  "@/components/knowledge/public/AuthorByline",
  "@/components/content-gen/ArticleSources",
  "@/components/content-gen/ArticleKeyTakeaway",
  "@/components/content-gen/ArticleExpertQuote",
  "@/components/content-gen/ArticleShareBar",
  "@/components/content-gen/ArticleTransparencyBlock",
  "@/components/content-gen/ArticlePrevNext",
  "@/components/content-gen/ArticlePeopleAlsoAsk",
  "@/components/content-gen/ArticleNewsletterInline",
  "@/components/suggested/SuggestedContent",
  "@/components/marketing/AiContentDisclaimer",
  "@/components/seo/ArticleTOC",
  "@/components/content-gen/ArticleFaq",
]) {
  vi.doMock(m, () => {
    const nom = m.split("/").pop()!;
    return {
      [nom]: () => <div data-brique={nom} />,
      aDesSourcesAffichables: () => false,
    };
  });
}
vi.doMock("@/components/marketing/AnswerCard", () => ({
  AnswerCard: ({ children }: { children: React.ReactNode }) => (
    <aside data-aeo="tldr">{children}</aside>
  ),
}));

import { PHOTOS_REPLI } from "@/lib/blog/photos-repli";
import type { ArticleActualiteProps } from "@/components/article-v2/types";

const { GabaritActualite } = await import("@/components/article-v2/gabarits/GabaritActualite");
const { TriptyqueActualite } = await import("@/components/article-v2/TriptyqueActualite");
const { CtaMilieu } = await import("@/components/article-v2/CtaMilieu");

const rendre = (el: React.ReactElement) => renderToStaticMarkup(el);

const base: ArticleActualiteProps = {
  locale: "fr",
  slug: "ai-act-article-4",
  titre: { lead: "AI Act :", em: "former vos équipes" },
  titreComplet: "AI Act : former vos équipes",
  chapo: "Ce que demande le texte.",
  categorie: "Réglementation",
  auteur: { nom: "Manon", slug: "manon", href: "/equipe/manon" },
  publieLe: { iso: "2026-11-26", lisible: "26/11/2026", jour: "26" },
  misAJourLe: { iso: "2026-11-27", lisible: "27/11/2026" },
  minutesLecture: 4,
  source: { nom: "EUR-Lex", url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj" },
  photo: { src: null, alt: null, photographerName: null, photographerUrl: null },
  tldr: "Depuis 2025, former ses équipes est attendu.",
  pointCle: "Former ses équipes à l’IA est attendu dès aujourd’hui.",
  html: '<h2 id="a">Que dit le texte ?</h2><p>Corps.</p>',
  paragraphes: [],
  tocItems: [
    { anchor: "a", title: "Que dit le texte ?", level: 2 },
    { anchor: "b", title: "Qui est concerné ?", level: 2 },
  ],
  pageUrl: "https://axion-ia.com/fr/actualites/ai-act-article-4",
  filAriane: [
    { href: "/actualites", label: "Actualités" },
    { href: "/actualites/ai-act-article-4", label: "AI Act : former vos équipes" },
  ],
  faqItems: [],
  citations: [{ name: "EUR-Lex", url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj" }],
  expertQuote: null,
  dateMiseAJourIso: "2026-11-27",
  bylineManon: null,
  questionsAssociees: [],
  suggestions: [],
  precedentSuivant: { prev: null, next: null },
  jsonLd: [{ "@type": "NewsArticle" }],
};

describe("GabaritActualite : structure", () => {
  const html = rendre(<GabaritActualite {...base} />);

  it("data-gabarit, un seul h1, ni <main> ni en-tête de site, héros terracotta", () => {
    expect(html).toContain('data-gabarit="actualite"');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).not.toContain("<main");
    expect(html).not.toContain("data-tone");
    expect(html).toContain('<header class="heros sur-terracotta">');
  });

  it("date du jour en évidence : chiffre décoratif aria-hidden, date lisible dans <time>", () => {
    expect(html).toContain(
      '<p class="date-une"><span class="date-une__jour" aria-hidden="true">26</span><time dateTime="2026-11-26">',
    );
    // une seule date de publication visible (la date du jour du héros)
    expect(html.match(/Publié le/g)).toHaveLength(1);
    expect(html).toContain('data-aeo="freshness"');
  });

  it("source d'origine en pastille avec lien sortant sûr, sans pastille de niveau interne", () => {
    expect(html).toContain("pastille--source");
    expect(html).toMatch(/<a href="https:\/\/eur-lex[^"]*" rel="noopener noreferrer">EUR-Lex<\/a>/);
    expect(html).not.toContain("Brève");
    expect(html).not.toContain("non indexée");
    expect(html).not.toContain("Actualité vérifiée");
  });

  it("<article> englobe l'en-tête ET les sources (pas seulement le corps)", () => {
    const debut = html.indexOf("<article");
    const fin = html.indexOf("</article>");
    for (const repere of [
      '<header class="heros',
      'data-brique="ArticleSources"',
      'data-brique="AuthorByline"',
    ]) {
      const i = html.indexOf(repere);
      expect(i, repere).toBeGreaterThan(debut);
      expect(i, repere).toBeLessThan(fin);
    }
  });

  it("un seul aside.action, avec depuis=actualite-colonne, après </article>", () => {
    expect(html.match(/<aside class="action"/g)).toHaveLength(1);
    expect(html).toContain("depuis=actualite-colonne");
    expect(html.indexOf('<aside class="action"')).toBeGreaterThan(html.indexOf("</article>"));
  });

  it("encart du milieu : Diagnostic en principal, lien « Écrire un message »", () => {
    expect(html).toContain("depuis=actualite-milieu");
    const debut = html.indexOf('<aside class="cta-milieu"');
    const milieu = html.slice(debut, html.indexOf("</aside>", debut));
    expect(milieu).toContain('href="/contact"');
    expect(milieu).not.toContain('href="/journee-ia"');
  });

  it("capture e-mail existante conservée, une seule", () => {
    expect(html.match(/data-brique="ArticleNewsletterInline"/g)).toHaveLength(1);
  });

  it("lien alternate markdown et JSON-LD de la page conservés", () => {
    expect(html).toContain('href="/api/markdown/actualites/ai-act-article-4"');
    expect(html).toContain('"@type":"NewsArticle"');
  });

  it("aucun mot interdit dans le HTML produit", () => {
    expect(html).not.toMatch(
      /grenoble|frais de déplacement|témoignage|avocat|réserv|<s>|<del>|line-through/i,
    );
    expect(html).not.toMatch(/€|\bprix\b/i);
  });

  it("aucun <svg> dans le cadre photo", () => {
    const cadre = html.slice(html.indexOf("visuel__cadre"), html.indexOf("</figure>"));
    expect(cadre).toContain("<img");
    expect(cadre).not.toContain("<svg");
  });
});

describe("GabaritActualite : photo", () => {
  it("sans featuredImage : photo de repli « actualite » de la banque, eager, fetchPriority high", () => {
    const html = rendre(<GabaritActualite {...base} />);
    expect(html).toContain(PHOTOS_REPLI.actualite.src);
    expect(html).toContain('loading="eager"');
    expect(html).toContain('data-fetchpriority="high"');
    expect(html).not.toContain("<figcaption>");
  });

  it("avec featuredImage : la photo de l'article, son alt et son crédit", () => {
    const html = rendre(
      <GabaritActualite
        {...base}
        photo={{
          src: "/photo.jpg",
          alt: "Une équipe en formation",
          photographerName: "Jeanne Photo",
          photographerUrl: "https://unsplash.com/@jeanne",
        }}
      />,
    );
    expect(html).toContain('src="/photo.jpg"');
    expect(html).toContain('alt="Une équipe en formation"');
    expect(html).toContain("Jeanne Photo");
    expect(html).not.toContain(PHOTOS_REPLI.actualite.src);
  });

  it("la photo de repli est une vraie photo de la banque, en .webp et .avif", () => {
    expect(PHOTOS_REPLI.actualite.src).toMatch(/^\/images\/axion-ia-photo-[a-z0-9-]+\.webp$/);
    expect(PHOTOS_REPLI.actualite.src).not.toMatch(/infographie|pourcent|-\d+-/);
    expect(PHOTOS_REPLI.actualite.alt).toBe("");
  });
});

describe("GabaritActualite : feuilles de style", () => {
  it("importe socle, compléments puis actualite, dans cet ordre (la route charge elle-même ses styles)", () => {
    const src = readFileSync("src/components/article-v2/gabarits/GabaritActualite.tsx", "utf8");
    const i = ["socle.css", "complements.css", "actualite.css"].map((f) =>
      src.indexOf(`import "@/styles/article-v2/${f}"`),
    );
    expect(i.every((x) => x > 0)).toBe(true);
    expect(i).toEqual([...i].sort((a, b) => a - b));
  });
});

describe("GabaritActualite : variantes de données", () => {
  it("sans date de publication : aucune ligne « Publié le », aucun datetime vide", () => {
    const html = rendre(<GabaritActualite {...base} publieLe={null} />);
    expect(html).not.toContain("Publié le");
    expect(html).not.toContain('dateTime=""');
    expect(html).not.toContain("date-une");
  });

  it("sans date de publication ni de mise à jour : aucune date du tout", () => {
    const html = rendre(<GabaritActualite {...base} publieLe={null} misAJourLe={null} />);
    expect(html).not.toMatch(/<time/);
  });

  it("sans source : ni pastille de source ni encadré « Source d'origine »", () => {
    const html = rendre(<GabaritActualite {...base} source={null} />);
    expect(html).not.toContain("pastille--source");
    expect(html).not.toContain("source-origine");
  });

  it("source sans lien : nom seul, aucun lien sortant", () => {
    const html = rendre(<GabaritActualite {...base} source={{ nom: "Le Journal", url: null }} />);
    expect(html).toContain("Le Journal");
    const pastille = html.slice(
      html.indexOf("pastille--source"),
      html.indexOf("</ul>", html.indexOf("pastille--source")),
    );
    expect(pastille).not.toContain("<a ");
    const encadre = html.slice(html.indexOf("source-origine__corps"), html.indexOf("cta-milieu"));
    expect(encadre).not.toContain("<a ");
  });

  it("encadré « Source d'origine » : nom, lien sortant sûr, aucune date inventée", () => {
    const html = rendre(<GabaritActualite {...base} />);
    expect(html).toContain('class="source-origine"');
    expect(html).toMatch(
      /class="btn btn--contour" href="https:\/\/eur-lex[^"]*" rel="noopener noreferrer"/,
    );
  });

  it("sans signe tiré des métadonnées : aucun signe du gabarit", () => {
    expect(rendre(<GabaritActualite {...base} />)).not.toContain("heros__signe");
  });

  it("corps en prose plate (pas de HTML) : paragraphes", () => {
    const html = rendre(<GabaritActualite {...base} html={null} paragraphes={["Un.", "Deux."]} />);
    expect(html).toContain("<p>Un.</p>");
    expect(html).toContain("<p>Deux.</p>");
  });

  it("sans réponse directe ni point clé : ni « En bref » ni triptyque", () => {
    const html = rendre(<GabaritActualite {...base} tldr={null} pointCle={null} />);
    expect(html).not.toContain('data-aeo="tldr"');
    expect(html).not.toContain("triptyque");
  });

  it("article court : pas de résumé de fin (le triptyque en tient lieu)", () => {
    expect(rendre(<GabaritActualite {...base} />)).not.toContain("Ce qu’il faut retenir");
  });

  it("aucun encart vidéo tant que /actualites n'est pas page hôte", () => {
    expect(rendre(<GabaritActualite {...base} />)).not.toContain("encart-video");
  });
});

describe("TriptyqueActualite", () => {
  it("point clé seul : une carte « Ce qui change », data-aeo=key-point conservé", () => {
    const html = rendre(<TriptyqueActualite ceQuiChange="Texte du point clé." />);
    expect(html).toContain('data-aeo="key-point"');
    expect(html.match(/<li class="triptyque__carte/g)).toHaveLength(1);
    expect(html).toContain("Texte du point clé.");
    expect(html).toContain("Ce qui change");
  });

  it("trois cartes quand les trois parties existent, étapes en liste ordonnée", () => {
    const html = rendre(
      <TriptyqueActualite ceQuiChange="A" pourQui="B" queFaire={["Un", "Deux", "Trois"]} />,
    );
    expect(html.match(/<li class="triptyque__carte/g)).toHaveLength(3);
    expect(html).toContain("Pour qui");
    expect(html).toContain("Que faire maintenant");
    expect(html.match(/<li>(Un|Deux|Trois)<\/li>/g)).toHaveLength(3);
  });

  it("rien sans contenu", () => {
    expect(rendre(<TriptyqueActualite ceQuiChange={null} />)).toBe("");
    expect(rendre(<TriptyqueActualite ceQuiChange="   " />)).toBe("");
  });

  it("identifiants de titre uniques par instance", () => {
    const deux = rendre(
      <>
        <TriptyqueActualite ceQuiChange="A" />
        <TriptyqueActualite ceQuiChange="B" />
      </>,
    );
    const ids = [...deux.matchAll(/aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("CtaMilieu : lien secondaire", () => {
  it("par défaut, le lien est l'autre bouton (inchangé)", () => {
    const html = rendre(<CtaMilieu gabarit="analyse" principal="diagnostic" />);
    expect(html).toContain('href="/journee-ia"');
  });
});

describe("page /actualites/[slug] : une seule insertion derrière l'interrupteur", () => {
  const src = readFileSync("src/app/[locale]/actualites/[slug]/page.tsx", "utf8");
  const garde = src.indexOf("if (gabaritsV2Actifs())");
  const retourV1 = src.indexOf("return (\n    <>\n      {/* Refonte templates 2026-06-22");

  it("la garde précède le return V1 et n'apparaît qu'une fois", () => {
    expect([...src.matchAll(/gabaritsV2Actifs\(\)/g)]).toHaveLength(1);
    expect(garde).toBeGreaterThan(0);
    expect(retourV1).toBeGreaterThan(garde);
  });

  it("le JSX V1 garde ses marqueurs et ne porte aucun marqueur V2", () => {
    const v1 = src.slice(retourV1);
    expect(v1).toContain("max-w-[52rem]");
    expect(v1).toContain("Mis à jour le ");
    expect(v1).toContain("tierBadge");
    expect(v1).not.toContain("data-gabarit");
    expect(v1).not.toContain("GabaritActualite");
  });

  it("generateMetadata ne dépend pas de l'interrupteur", () => {
    const debut = src.indexOf("export async function generateMetadata");
    const fin = src.indexOf("export default async function NewsArticlePage");
    expect(src.slice(debut, fin)).not.toMatch(/gabaritsV2Actifs|GabaritActualite/);
  });

  it("le JSON-LD passé au gabarit est celui de la V1, sans nouveau nœud", () => {
    const bloc = src.slice(garde, retourV1);
    expect(bloc).toContain("newsJsonLd");
    expect(bloc).toContain("personJsonLd");
    expect(bloc).not.toMatch(/build\w*JsonLd\(/);
  });

  it("interrupteur coupé : aucun module V2 chargé statiquement par la page", () => {
    // Import dynamique : le gabarit n'est chargé que derrière la garde.
    expect(src).not.toMatch(/^import .*article-v2/m);
    expect(src.slice(garde, retourV1)).toContain('import("@/components/article-v2/');
  });
});

describe("garde-fous du gabarit", () => {
  it("aucun use client, aucun hexadécimal dans les fichiers de la PR", () => {
    for (const f of [
      "src/components/article-v2/gabarits/GabaritActualite.tsx",
      "src/components/article-v2/TriptyqueActualite.tsx",
      "src/styles/article-v2/actualite.css",
    ]) {
      const t = readFileSync(f, "utf8");
      expect(t, f).not.toMatch(/["']use client["']/);
      expect(t, f).not.toMatch(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
    }
  });
});
