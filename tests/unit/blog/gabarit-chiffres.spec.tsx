/** Gabarit Chiffres (G8) — rendu serveur, règles communes du découpage (a, c, d, f, g, h). */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => {
  const lire = (f: string) =>
    JSON.parse(readFileSync(`src/messages/gabarits/${f}.fr.json`, "utf8"));
  const sources: Record<string, unknown> = {
    "articleGabarits.commun": lire("commun"),
    "articleGabarits.chiffres": lire("chiffres"),
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
      {
        raw: (k: string) => chercher(ns, k),
        rich: (k: string, vars?: Record<string, unknown>) => {
          const v = String(chercher(ns, k) ?? k).replace("{date}", String(vars?.date ?? ""));
          const m = /^(.*)<dateBalise>(.*)<\/dateBalise>(.*)$/.exec(v);
          if (!m) return v;
          const balise = vars?.dateBalise as (x: string) => React.ReactNode;
          return (
            <>
              {m[1]}
              {balise(m[2]!)}
              {m[3]}
            </>
          );
        },
      },
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

const { MiseEnPageChiffres } = await import("@/components/article-v2/gabarits/GabaritChiffres");
import type { Releve } from "@/server/content-gen/blog/charger-releve";

function props(surcharge: Partial<ArticleGabaritProps> = {}): ArticleGabaritProps {
  return {
    gabarit: "chiffres",
    view: {
      slug: "chiffres-ia",
      title: "Observatoire : où en est l’IA dans les PME",
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
      faqItems: [],
      citations: [],
    } as unknown as ArticleGabaritProps["view"],
    locale: "fr",
    html: '<h2 id="contexte">Contexte</h2><p>Corps</p>',
    blocs: null,
    tocItems: [{ anchor: "contexte", title: "Contexte", level: 2 }],
    pageUrl: "https://example.test/fr/blog/chiffres-ia",
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
const RELEVE: Releve = {
  dateIso: "2026-10-01",
  total: 120,
  constats: [
    { cle: "competitors_use_ai", pct: 62 },
    { cle: "investment_intent", pct: 37 },
  ],
  maturite: [
    { valeur: "none", pct: 25 },
    { valeur: "poc", pct: 50 },
    { valeur: "inconnu", pct: 99 },
  ],
};
const rendre = (p: ArticleGabaritProps, r: Releve | null = RELEVE) =>
  renderToStaticMarkup(<MiseEnPageChiffres p={p} releve={r} />);

describe("GabaritChiffres", () => {
  it("rend data-gabarit, un seul h1, ni <main> ni en-tête de site, aucun svg dans la photo", () => {
    const h = rendre(props());
    expect(h).toContain('data-gabarit="chiffres"');
    expect(h.match(/<h1\b/g)).toHaveLength(1);
    expect(h).not.toContain("<main");
    expect(h).not.toContain("data-tone");
    expect(h).not.toMatch(/visuel__cadre">(?:(?!<\/div>).)*<svg/s);
    expect(h).toMatch(/visuel__cadre">(?:(?!<\/div>).)*<img/s);
  });

  it("aucun JavaScript client : aucun script hors JSON-LD", () => {
    expect(rendre(props()).match(/<script(?![^>]*application\/ld\+json)/g) ?? []).toHaveLength(0);
  });

  it("avec relevé : bandeau daté sous le héros, avec le lien vers l'Observatoire", () => {
    const h = rendre(props());
    expect(h).toContain('<time dateTime="2026-10-01">');
    expect(h).toContain("1er octobre 2026");
    expect(h).toContain('href="/observatoire-ia"');
    expect(h.indexOf("Données au")).toBeGreaterThan(h.indexOf("</header>"));
    expect(h.indexOf("Données au")).toBeLessThan(h.indexOf("article__ouverture"));
  });

  it("chiffres géants : valeur en texte, source du relevé, un par constat du relevé", () => {
    const h = rendre(props());
    expect(h).toContain("62 %");
    expect(h).toContain("37 %");
    expect(h.match(/chiffres__valeur/g)).toHaveLength(2);
    expect(h).toContain("pensent que leurs concurrents utilisent déjà l’IA");
    expect(h).toContain("Source : Observatoire Axion-IA 2026");
  });

  it("barres : valeur en texte, piste aria-hidden, niveau inconnu écarté", () => {
    const h = rendre(props());
    expect(h).toContain("25 %");
    expect(h).toContain("50 %");
    expect(h).not.toContain("99\u202f%");
    expect(h.match(/class="barres__piste" aria-hidden="true"/g)).toHaveLength(2);
    expect(h).toContain("--v:25%");
    expect(h).not.toMatch(/<svg|<canvas|chart/i);
  });

  it("« Comment lire ces chiffres » : champ, période, échantillon du relevé", () => {
    const h = rendre(props());
    expect(h).toContain("Comment lire ces chiffres");
    expect(h).toContain("relevé arrêté au 1er octobre 2026.");
    expect(h).toContain("120 répondants.");
  });

  it("aucun chiffre rendu qui ne vienne pas du relevé (rangée, barres, lecture)", () => {
    const h = rendre(props());
    const debut = h.indexOf('class="chiffres"');
    const fin = h.indexOf("</dl>", debut);
    expect(debut).toBeGreaterThan(-1);
    const bloc = h.slice(debut, fin).replace(/<[^>]*>/g, " ");
    const nombres = new Set((bloc.match(/\d+/g) ?? []).map(Number));
    expect([...nombres].sort((a, b) => a - b)).toEqual([1, 25, 37, 50, 62, 120, 2026]);
  });

  it("le signe du héros n'affiche aucun nombre inventé", () => {
    const h = rendre(props());
    const signe = h.slice(h.indexOf("heros__signe"), h.indexOf("</header>"));
    expect(signe.replace(/<[^>]*>/g, "")).not.toMatch(/\d/);
  });

  it("sans relevé : mise en page Analyse, ni bandeau, ni chiffres, ni barres, corps intact", () => {
    const h = rendre(props(), null);
    expect(h).not.toContain("Données au");
    expect(h).not.toContain("chiffres__valeur");
    expect(h).not.toContain("barres");
    expect(h).not.toContain("Comment lire");
    expect(h).toContain("<p>Corps</p>");
  });

  it("relevé sans constat ni répartition : seul l'encadré de lecture reste", () => {
    const h = rendre(props(), { ...RELEVE, constats: [], maturite: [] });
    expect(h).not.toContain("chiffres__valeur");
    expect(h).not.toContain("barres__liste");
    expect(h).toContain("120 répondants.");
  });

  it("l'aiguillage lit le relevé du job d'origine de l'article", async () => {
    vi.resetModules();
    vi.doMock("@/server/content-gen/blog/charger-releve", () => ({
      chargerReleve: async (id: string | null) => (id === "job-1" ? RELEVE : null),
    }));
    const { GabaritChiffresAvecReleve: G } =
      await import("@/components/article-v2/gabarits/GabaritChiffres");
    const avec = renderToStaticMarkup(
      await G(props({ view: { ...props().view, generatedByJobId: "job-1" } as never })),
    );
    const sans = renderToStaticMarkup(await G(props()));
    expect(avec).toContain("chiffres__valeur");
    expect(sans).not.toContain("chiffres__valeur");
    vi.doUnmock("@/server/content-gen/blog/charger-releve");
  });

  it("CtaMilieu : bouton principal Journée IA (terracotta), lien Diagnostic IA", () => {
    const h = rendre(props());
    const milieu = h.slice(h.indexOf('class="cta-milieu"'));
    expect(milieu).toMatch(/class="btn btn--terracotta"[^>]*data-cta="journee"/);
    expect(milieu).toMatch(/data-cta="diagnostic"/);
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
