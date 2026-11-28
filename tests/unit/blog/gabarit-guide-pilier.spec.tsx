/**
 * PR M-GU1 — gabarit « Guide pilier » (/guides/[slug]) : chapitres, sommaire en grille,
 * deux encarts du milieu, feuille de route, aiguillage derrière l'interrupteur, textes.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", async () => {
  const { readFileSync: lire } = await import("node:fs");
  const fichiers: Record<string, unknown> = {
    commun: JSON.parse(lire("src/messages/gabarits/commun.fr.json", "utf8")),
    "guide-pilier": JSON.parse(lire("src/messages/gabarits/guide-pilier.fr.json", "utf8")),
  };
  const chercher = (ns: string, k: string): unknown => {
    const m = /^articleGabarits\.([a-z-]+)\.?(.*)$/.exec(ns);
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
  "@/components/marketing/TermesGlossaireLies",
  "@/components/content-gen/ArticleFaq",
]) {
  vi.doMock(m, () => {
    const nom = m.split("/").pop()!;
    return { [nom]: () => <div data-brique={nom} />, aDesSourcesAffichables: () => false };
  });
}
vi.doMock("@/components/marketing/AnswerCard", () => ({
  AnswerCard: ({ children }: { children: React.ReactNode }) => (
    <aside data-aeo="tldr">{children}</aside>
  ),
}));

import { PHOTOS_REPLI } from "@/lib/blog/photos-repli";
import type { ArticleGuidePilierProps } from "@/components/article-v2/types";

const { GabaritGuidePilier } = await import("@/components/article-v2/gabarits/GabaritGuidePilier");
const { ArticleTOC } = await import("@/components/seo/ArticleTOC");
const { decouperTitre } = await import("@/components/article-v2/decouper-titre");

const rendre = (el: React.ReactElement) => renderToStaticMarkup(el);

const etapes = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    position: i + 1,
    name: `Chapitre numéro ${i + 1} ?`,
    text: `Premier paragraphe du chapitre ${i + 1}.\n\nSecond paragraphe.`,
  }));

const base: ArticleGuidePilierProps = {
  locale: "fr",
  slug: "mettre-en-place-ia-pme",
  titreComplet: "Mettre en place l’IA : le guide complet",
  titre: decouperTitre("Mettre en place l’IA : le guide complet"),
  tldr: "Sept temps pour démarrer.",
  publieLe: { iso: "2026-10-08", lisible: "8 octobre 2026" },
  misAJourLe: { iso: "2026-11-26", lisible: "26 novembre 2026" },
  dateMiseAJourIso: "2026-11-26",
  etapes: etapes(7),
  html: null,
  paragraphes: [],
  tocItems: etapes(7).map((e) => ({
    anchor: `step-${e.position}`,
    title: e.name,
    level: 2 as const,
  })),
  photo: { src: null, alt: null, photographerName: null, photographerUrl: null },
  pointCle: null,
  expertQuote: null,
  faqItems: [],
  citations: [],
  pageUrl: "https://axion-ia.com/fr/guides/mettre-en-place-ia-pme",
  filAriane: [
    { href: "/guides", label: "Guides" },
    { href: "/guides/mettre-en-place-ia-pme", label: "Mettre en place l’IA" },
  ],
  bylineManon: null,
  questionsAssociees: [],
  suggestions: [],
  precedentSuivant: { prev: null, next: null },
  termesLies: [],
  jsonLd: [{ "@type": "HowTo" }],
};

describe("GabaritGuidePilier : structure", () => {
  const html = rendre(<GabaritGuidePilier {...base} />);

  it("data-gabarit, un seul h1, ni <main> ni en-tête de site, héros terracotta", () => {
    expect(html).toContain('data-gabarit="guide-pilier"');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).not.toContain("<main");
    expect(html).not.toContain("data-tone");
    expect(html).toContain('<header class="heros sur-terracotta">');
  });

  it("auteur et dates visibles dans le héros (écart E-E-A-T corrigé)", () => {
    const heros = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(heros).toContain("Manon");
    expect(heros).toContain('href="/equipe/manon"');
    expect(heros).toContain("8 octobre 2026");
    expect(heros).toContain("26 novembre 2026");
    expect(heros).toContain('data-aeo="freshness"');
    expect(heros).toContain('dateTime="2026-10-08"');
  });

  it("signe du gabarit : le nombre de chapitres, en décor aria-hidden", () => {
    expect(html).toContain('class="heros__signe signe--guide-pilier" aria-hidden="true"');
    expect(html).toContain('<span class="signe__grand">7</span>');
  });

  it("sept chapitres : ids step-N conservés, aria-labelledby, bandeaux en alternance", () => {
    for (let i = 1; i <= 7; i++) {
      expect(html).toContain(`<h2 id="step-${i}"`);
      expect(html).toContain(`aria-labelledby="step-${i}"`);
    }
    expect(html.match(/<section class="chapitre"/g)).toHaveLength(7);
    expect(html.match(/chapitre__bandeau chapitre__bandeau--terracotta/g)).toHaveLength(3);
    expect(html).toContain("Chapitre 1 sur 7");
    expect(html).toContain("Chapitre 7 sur 7");
    expect(html).toContain("Dernier chapitre");
  });

  it("le chiffre du chapitre est un décor ; le texte du chapitre est dans le DOM", () => {
    expect(html).toContain('<span class="chapitre__numero" aria-hidden="true">1</span>');
    expect(html).toContain("<p>Premier paragraphe du chapitre 1.</p>");
    expect(html).toContain("<p>Second paragraphe.</p>");
  });

  it("« Aller au chapitre suivant » (numéro masqué visuellement) sauf au dernier ; retour au sommaire", () => {
    expect(html.match(/href="#step-2"[^>]*>Aller au chapitre suivant/g)).toHaveLength(1);
    expect(html.match(/Aller au chapitre suivant/g)).toHaveLength(6);
    expect(html).toContain('class="visuellement-masque"');
    expect(html.match(/href="#sommaire"/g)).toHaveLength(7);
  });

  it("barre de progression et chiffres de durée : décor + texte, valeurs cohérentes", () => {
    expect(html).toContain('style="--p:14%"');
    expect(html).toContain('style="--p:100%"');
    expect(html.match(/chapitre__barre/g)).toHaveLength(7);
  });

  it("deux encarts du milieu : Diagnostic puis Journée IA ; liens attendus", () => {
    expect(html.match(/<aside class="cta-milieu"/g)).toHaveLength(2);
    expect(html).toContain("depuis=guide-pilier-milieu");
    const milieux = [...html.matchAll(/<aside class="cta-milieu".*?<\/aside>/g)].map((m) => m[0]);
    expect(milieux[0]).toContain("Diagnostic IA, 45 min");
    expect(milieux[0]).toContain('href="/guide-ia"');
    expect(milieux[0]).toContain("40 pages");
    expect(milieux[1]).toContain("Découvrir la Journée IA");
    expect(milieux[1]).toContain('href="/contact"');
  });

  it("feuille de route finale = résumé de fin, tirée des titres de chapitres", () => {
    const route = html.slice(html.indexOf('class="feuille-route'));
    expect(route).toContain('data-aeo="key-point"');
    expect(
      route.match(/<li><p>Chapitre numéro \d \?<span>Chapitre \d<\/span><\/p><\/li>/g),
    ).toHaveLength(7);
  });

  it("un seul aside.action (guide-pilier-colonne) après </article> ; FAQ et sources DANS l'article", () => {
    expect(html.match(/<aside class="action"/g)).toHaveLength(1);
    expect(html).toContain("depuis=guide-pilier-colonne");
    const fin = html.indexOf("</article>");
    expect(html.indexOf('<aside class="action"')).toBeGreaterThan(fin);
    for (const b of ["ArticleFaq", "ArticleSources", "AuthorByline", "TermesGlossaireLies"]) {
      const i = html.indexOf(`data-brique="${b}"`);
      expect(i, b).toBeGreaterThan(html.indexOf("<article"));
      expect(i, b).toBeLessThan(fin);
    }
  });

  it("capture e-mail existante conservée, une seule ; alternate markdown ; JSON-LD de la page", () => {
    expect(html.match(/data-brique="ArticleNewsletterInline"/g)).toHaveLength(1);
    expect(html).toContain('href="/api/markdown/guides/mettre-en-place-ia-pme"');
    expect(html).toContain('"@type":"HowTo"');
  });

  it("photo de repli « guide-pilier » : vraie photo, eager, fetchPriority high, aucun SVG", () => {
    expect(html).toContain(PHOTOS_REPLI["guide-pilier"].src);
    expect(html).toContain('data-fetchpriority="high"');
    const cadre = html.slice(html.indexOf("visuel__cadre"), html.indexOf("</figure>"));
    expect(cadre).not.toContain("<svg");
  });

  it("aucun mot interdit dans le HTML produit", () => {
    expect(html).not.toMatch(
      /grenoble|frais de déplacement|témoignage|avocat|réserv|<s>|<del>|line-through/i,
    );
    expect(html).not.toMatch(/€|\bprix\b/i);
  });
});

describe("GabaritGuidePilier : variantes de données", () => {
  it("avec photo d'article : sa photo et son alt, pas le repli", () => {
    const html = rendre(
      <GabaritGuidePilier
        {...base}
        photo={{
          src: "/p.jpg",
          alt: "Un chemin",
          photographerName: "J. Photo",
          photographerUrl: "https://u.test/j",
        }}
      />,
    );
    expect(html).toContain('src="/p.jpg"');
    expect(html).toContain('alt="Un chemin"');
    expect(html).not.toContain(PHOTOS_REPLI["guide-pilier"].src);
  });

  it("sans étapes structurées : corps HTML, ni chapitres ni feuille de route ni sommaire", () => {
    const html = rendre(
      <GabaritGuidePilier
        {...base}
        etapes={[]}
        tocItems={[]}
        html="<h2>Titre</h2><p>Corps libre.</p>"
      />,
    );
    expect(html).toContain("Corps libre.");
    expect(html).not.toContain('class="chapitre"');
    expect(html).not.toContain("feuille-route");
    expect(html.match(/<aside class="cta-milieu"/g)).toHaveLength(1);
    expect(html).not.toContain('class="heros__signe');
  });

  it("sans étapes ni HTML : paragraphes", () => {
    const html = rendre(
      <GabaritGuidePilier {...base} etapes={[]} tocItems={[]} paragraphes={["Un.", "Deux."]} />,
    );
    expect(html).toContain("<p>Un.</p>");
    expect(html).toContain("<p>Deux.</p>");
  });

  it("deux chapitres : un seul encart du milieu, après le premier chapitre", () => {
    const html = rendre(<GabaritGuidePilier {...base} etapes={etapes(2)} tocItems={[]} />);
    expect(html.match(/<aside class="cta-milieu"/g)).toHaveLength(1);
    expect(html.indexOf("cta-milieu")).toBeGreaterThan(html.indexOf('<h2 id="step-1"'));
    expect(html.indexOf("cta-milieu")).toBeLessThan(html.indexOf('<h2 id="step-2"'));
  });

  it("point clé existant rendu ; aucun texte inventé sans lui", () => {
    expect(rendre(<GabaritGuidePilier {...base} />)).toContain('data-brique="ArticleKeyTakeaway"');
  });
});

describe("titre et numérotation", () => {
  it("le « : » reste dans le h1 (titre lu en entier)", () => {
    const html = rendre(<GabaritGuidePilier {...base} />);
    expect(html).toContain("<h1>Mettre en place l’IA : <em>le guide complet</em></h1>");
    expect(decouperTitre("A : B").lead).toBe("A :");
    expect(decouperTitre("Un titre sans séparateur ici")).toEqual({
      lead: "Un titre sans",
      em: "séparateur ici",
    });
  });

  it("positions non contiguës ou répétées : numéros affichés par rang, ancres inchangées", () => {
    const bizarres = [3, 3, 7, 2].map((position, i) => ({
      position,
      name: `Étape ${i}`,
      text: "Un texte.",
    }));
    const html = rendre(<GabaritGuidePilier {...base} etapes={bizarres} tocItems={[]} />);
    for (let rang = 1; rang <= 4; rang++) expect(html).toContain(`Chapitre ${rang} sur 4`);
    expect(html).not.toMatch(/Chapitre [5-9] sur 4/);
    expect(html).toContain('<h2 id="step-7"');
    expect(html).toContain('href="#step-7"');
    expect(html.match(/chapitre__bandeau chapitre__bandeau--terracotta/g)).toHaveLength(2);
  });

  it("trois chapitres : un seul encart du milieu (Diagnostic)", () => {
    const html = rendre(<GabaritGuidePilier {...base} etapes={etapes(3)} tocItems={[]} />);
    expect(html.match(/<aside class="cta-milieu"/g)).toHaveLength(1);
  });
});

describe("ArticleTOC v2 : grille de chapitres", () => {
  it("détail, progression, total et id du sommaire ; ItemList inchangée", () => {
    const html = rendre(
      <ArticleTOC
        items={[
          { anchor: "step-1", title: "Un ?", level: 2, detail: "≈ 2 min", progression: 50 },
          { anchor: "step-2", title: "Deux ?", level: 2, detail: "≈ 2 min", progression: 100 },
        ]}
        pageUrl="https://x.test/fr/guides/a"
        locale="fr"
        variante="v2"
        id="sommaire"
        total="4 min"
      />,
    );
    expect(html).toContain('id="sommaire"');
    expect(html).toContain(
      '<li style="--p:50%"><a href="#step-1">Un ?<span class="sommaire__duree">≈ 2 min</span></a></li>',
    );
    expect(html).toContain('<span class="sommaire__total">4 min</span>');
    expect(html).toContain('"name":"Un ?"');
    expect(html).not.toContain("détail");
  });

  it("sans les nouvelles options : rendu v2 identique à avant", () => {
    const html = rendre(
      <ArticleTOC
        items={[
          { anchor: "a", title: "A", level: 2 },
          { anchor: "b", title: "B", level: 2 },
        ]}
        pageUrl="https://x.test/p"
        locale="fr"
        variante="v2"
      />,
    );
    expect(html).toContain(
      '<nav aria-label="Sommaire" class="sommaire not-prose"><details><summary>Sommaire</summary><ol><li><a href="#a">A</a></li>',
    );
  });
});

describe("page /guides/[slug] : une seule insertion derrière l'interrupteur", () => {
  const src = readFileSync("src/app/[locale]/guides/[slug]/page.tsx", "utf8");
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
    expect(v1).toContain("Guide pilier");
    expect(v1).toContain("step-${step.position}");
    expect(v1).not.toContain("data-gabarit");
    expect(v1).not.toContain("GabaritGuidePilier");
  });

  it("generateMetadata ne dépend pas de l'interrupteur", () => {
    const debut = src.indexOf("export async function generateMetadata");
    const fin = src.indexOf("export default async function GuidePiliersPage");
    expect(src.slice(debut, fin)).not.toMatch(/gabaritsV2Actifs|GabaritGuidePilier/);
  });

  it("le JSON-LD passé au gabarit est celui de la V1, sans nouveau nœud", () => {
    const bloc = src.slice(garde, retourV1);
    expect(bloc).toContain("jsonLd");
    expect(bloc).toContain("personJsonLd");
    expect(bloc).not.toMatch(/build\w*JsonLd\(/);
  });

  it("« mis à jour » seulement si le jour est postérieur à la publication ; FAQ sur la dernière écriture", () => {
    const bloc = src.slice(garde, retourV1);
    expect(bloc).toMatch(/updatedAt\.toISOString\(\)\.slice\(0, 10\) > guide\.publishedAt/);
    expect(bloc).toContain("dateMiseAJourIso={guide.updatedAt.toISOString().slice(0, 10)}");
  });

  it("les ids step-N du sommaire sont ceux des chapitres (même source)", () => {
    expect(src).toContain("anchor: `step-${s.position}`");
  });
});

describe("garde-fous du gabarit", () => {
  it("aucun use client, aucun hexadécimal dans les fichiers de la PR", () => {
    for (const f of [
      "src/components/article-v2/gabarits/GabaritGuidePilier.tsx",
      "src/components/article-v2/BandeauChapitre.tsx",
      "src/styles/article-v2/guide-pilier.css",
    ]) {
      const t = readFileSync(f, "utf8");
      expect(t, f).not.toMatch(/["']use client["']/);
      expect(t, f).not.toMatch(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
    }
  });

  it("le gabarit importe socle, compléments puis guide-pilier, dans cet ordre", () => {
    const src = readFileSync("src/components/article-v2/gabarits/GabaritGuidePilier.tsx", "utf8");
    const i = ["socle.css", "complements.css", "guide-pilier.css"].map((f) =>
      src.indexOf(`import "@/styles/article-v2/${f}"`),
    );
    expect(i.every((x) => x > 0)).toBe(true);
    expect(i).toEqual([...i].sort((a, b) => a - b));
  });
});
