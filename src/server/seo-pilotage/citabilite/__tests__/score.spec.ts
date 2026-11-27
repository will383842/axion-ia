import { describe, expect, it } from "vitest";
import {
  calculerCitabilite,
  ID_ORGANISATION,
  POINTS,
  type EntreePage,
  type IdCritere,
} from "../score";
import { detecterFaitsDivergents, faitsCanon } from "../faits";
import { JOURNEE_IA_TIER } from "@/content/pricing";
import { DELAI_RAPPORT_JOURS_OUVRES, DEDUCTION_JOURNEE_IA } from "@/content/journee-ia-commun";

const URL_PAGE = "https://axion-ia.com/fr/blog/automatiser-sa-facturation";
const MAINTENANT = new Date("2026-11-27T10:00:00Z");

/** N mots neutres (sans chiffre, sans mot interdit). */
const phrase = (n: number): string => Array.from({ length: n }, () => "mot").join(" ");

interface Variantes {
  h1?: string;
  h2?: string[];
  premierParagraphe?: string;
  passages?: string[];
  paragrapheChiffre?: string;
  temps?: string;
  jsonLd?: string;
  faqVisible?: string;
  liste?: string;
  tete?: string;
  liens?: string;
  extra?: string;
}

const JSON_LD_PARFAIT = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": URL_PAGE,
      publisher: { "@id": ID_ORGANISATION },
      dateModified: "2026-10-01",
    },
    {
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "Combien de temps dure la mise en place ?" }],
    },
  ],
});

function page(v: Variantes = {}): string {
  const h2 = v.h2 ?? [
    "Pourquoi automatiser sa facturation ?",
    "Comment choisir ses outils ?",
    "Les étapes clés",
  ];
  const passages = v.passages ?? [phrase(60), phrase(70)];
  return `<!doctype html><html lang="fr"><head>
${v.tete ?? `<link rel="canonical" href="${URL_PAGE}"><meta name="robots" content="index,follow"><link rel="alternate" type="text/markdown" href="${URL_PAGE}.md">`}
<script type="application/ld+json">${v.jsonLd ?? JSON_LD_PARFAIT}</script>
<script>var x = "<h1>faux titre</h1>";</script>
</head><body><main>
${v.h1 ?? "<h1>Automatiser sa facturation</h1>"}
<p>${v.premierParagraphe ?? phrase(60)}</p>
${h2.map((t) => `<h2>${t}</h2>`).join("\n")}
${passages.map((p) => `<p>${p}</p>`).join("\n")}
<p>${v.paragrapheChiffre ?? `Selon l'étude, 42 % des PME gagnent du temps <a href="https://www.insee.fr/etude">source</a>.`}</p>
${v.temps ?? `<time datetime="2026-10-01">1 octobre 2026</time>`}
${v.liste ?? "<ul><li>un</li><li>deux</li><li>trois</li></ul>"}
${v.faqVisible ?? "<h3>Combien de temps dure la mise en place ?</h3><p>Quelques semaines.</p>"}
${v.liens ?? `<a href="/fr/journee-ia">Journée IA</a> <a href="https://axion-ia.com/fr/tarifs/">Tarifs</a>`}
${v.extra ?? ""}
</main></body></html>`;
}

function entree(html: string, surcharge: Partial<EntreePage> = {}): EntreePage {
  return {
    html,
    url: URL_PAGE,
    dansSitemap: true,
    pagesFortes: ["/fr/journee-ia", "/fr/tarifs"],
    maintenant: MAINTENANT,
    ...surcharge,
  };
}

function points(html: string, surcharge: Partial<EntreePage> = {}): Record<IdCritere, number> {
  const r = calculerCitabilite(entree(html, surcharge));
  return Object.fromEntries(r.criteres.map((c) => [c.id, c.points])) as Record<IdCritere, number>;
}

describe("calculerCitabilite — page parfaite", () => {
  it("vaut 100 sans pénalité", () => {
    const r = calculerCitabilite(entree(page()));
    expect(r.criteres.filter((c) => !c.ok).map((c) => c.id)).toEqual([]);
    expect(r.score).toBe(100);
    expect(r.penalites).toEqual([]);
  });

  it("la somme des points maximaux vaut 100", () => {
    expect(Object.values(POINTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("calculerCitabilite — un fixture par critère", () => {
  it("titres : deux H1 → 0", () => {
    expect(points(page({ h1: "<h1>A</h1><h1>B</h1>" })).structureTitres).toBe(0);
  });
  it("titres : seulement 2 H2 → 0", () => {
    expect(points(page({ h2: ["Pourquoi ?", "Comment ?"] })).structureTitres).toBe(0);
  });
  it("titres : aucune question parmi les H2 → 0", () => {
    expect(points(page({ h2: ["Un", "Deux", "Trois"] })).structureTitres).toBe(0);
  });
  it("titres : 1 question sur 3 (33 %) → 10", () => {
    expect(points(page({ h2: ["Pourquoi ?", "Deux", "Trois"] })).structureTitres).toBe(10);
  });

  it("réponse directe : premier paragraphe de 39 mots → 0, de 40 → 15", () => {
    expect(points(page({ premierParagraphe: phrase(39), passages: [] })).reponseDirecte).toBe(0);
    expect(points(page({ premierParagraphe: phrase(40), passages: [] })).reponseDirecte).toBe(15);
  });
  it("réponse directe : 91 mots → 0 ; 90 → 15", () => {
    expect(points(page({ premierParagraphe: phrase(91), passages: [] })).reponseDirecte).toBe(0);
    expect(points(page({ premierParagraphe: phrase(90), passages: [] })).reponseDirecte).toBe(15);
  });
  it("réponse directe : paragraphe correct mais après 200 mots → 0", () => {
    const p = points(page({ premierParagraphe: phrase(150), passages: [phrase(100), phrase(60)] }));
    // 150 mots, puis 100 → débute à 150 (<200) mais fait 100 mots (>90) ; le 60 débute à 250.
    expect(p.reponseDirecte).toBe(0);
  });

  it("passages autonomes : 2 passages seulement → 0", () => {
    expect(
      points(page({ premierParagraphe: phrase(10), passages: [phrase(50), phrase(50)] }))
        .passagesAutonomes,
    ).toBe(0);
  });
  it("passages autonomes : un renvoi « comme vu plus haut » n'est pas autonome", () => {
    const renvoi = `Comme vu plus haut, ${phrase(50)}`;
    expect(
      points(page({ premierParagraphe: phrase(10), passages: [phrase(50), renvoi, phrase(50)] }))
        .passagesAutonomes,
    ).toBe(0);
  });
  it("passages autonomes : 121 mots n'en est pas un", () => {
    expect(
      points(page({ premierParagraphe: phrase(50), passages: [phrase(121), phrase(50)] }))
        .passagesAutonomes,
    ).toBe(0);
  });

  it("chiffres sourcés : chiffre sans lien externe → 0", () => {
    expect(
      points(page({ paragrapheChiffre: "42 % des PME gagnent du temps." })).chiffresSources,
    ).toBe(0);
  });
  it("chiffres sourcés : lien interne seulement → 0", () => {
    expect(
      points(page({ paragrapheChiffre: `42 % <a href="/fr/journee-ia">ici</a>` })).chiffresSources,
    ).toBe(0);
  });
  it("chiffres sourcés : lien externe sans chiffre → 0", () => {
    expect(
      points(page({ paragrapheChiffre: `Voir <a href="https://www.insee.fr/">la source</a>.` }))
        .chiffresSources,
    ).toBe(0);
  });

  it("date : pas de balise time → 0", () => {
    expect(points(page({ temps: "" })).dateVisible).toBe(0);
  });
  it("date : dateModified vieille de plus de 365 jours → 0", () => {
    const vieux = JSON_LD_PARFAIT.replace("2026-10-01", "2025-01-01");
    expect(points(page({ jsonLd: vieux })).dateVisible).toBe(0);
  });
  it("date : dateModified absente → 0", () => {
    const sans = JSON_LD_PARFAIT.replace('"dateModified":"2026-10-01"', '"x":1');
    expect(points(page({ jsonLd: sans })).dateVisible).toBe(0);
  });

  it("JSON-LD : sans référence à /#organization → 0", () => {
    const sans = JSON_LD_PARFAIT.replace(ID_ORGANISATION, "https://axion-ia.com/#autre");
    expect(points(page({ jsonLd: sans })).jsonLd).toBe(0);
  });
  it("JSON-LD : second nœud Organization → 0", () => {
    const deux = JSON.stringify({
      "@graph": [
        {
          "@type": "Organization",
          "@id": ID_ORGANISATION,
          name: "Axion-IA",
          url: "https://axion-ia.com",
        },
        {
          "@type": "Organization",
          "@id": "https://axion-ia.com/#bis",
          name: "Bis",
          url: "https://x.fr",
        },
        { "@type": "WebPage", publisher: { "@id": ID_ORGANISATION } },
      ],
    });
    expect(points(page({ jsonLd: deux })).jsonLd).toBe(0);
  });
  it("JSON-LD : un seul nœud Organization canonique → 10", () => {
    const un = JSON.stringify({
      "@graph": [
        {
          "@type": "Organization",
          "@id": ID_ORGANISATION,
          name: "Axion-IA",
          url: "https://axion-ia.com",
        },
        { "@type": "WebPage", publisher: { "@id": ID_ORGANISATION } },
      ],
    });
    expect(points(page({ jsonLd: un })).jsonLd).toBe(10);
  });
  it("JSON-LD cassé : 0 et aucune exception", () => {
    expect(points(page({ jsonLd: "{pas du json" })).jsonLd).toBe(0);
  });

  it("FAQ : question de FAQPage absente du texte visible → 0", () => {
    expect(points(page({ faqVisible: "<p>Rien.</p>" })).faq).toBe(0);
  });
  it("FAQ : pas de FAQPage → 0", () => {
    const sans = JSON.stringify({
      "@graph": [{ "@type": "WebPage", publisher: { "@id": ID_ORGANISATION } }],
    });
    expect(points(page({ jsonLd: sans })).faq).toBe(0);
  });

  it("listes : ni tableau ni liste de 3 éléments → 0 ; un tableau → 5", () => {
    expect(points(page({ liste: "<ul><li>un</li><li>deux</li></ul>" })).structureListes).toBe(0);
    expect(points(page({ liste: "<table><tr><td>a</td></tr></table>" })).structureListes).toBe(5);
  });

  it("indexable : noindex → 0", () => {
    const tete = `<link rel="canonical" href="${URL_PAGE}"><meta name="robots" content="noindex">`;
    expect(points(page({ tete })).indexable).toBe(0);
  });
  it("indexable : canonique vers une autre page → 0", () => {
    const tete = `<link rel="canonical" href="https://axion-ia.com/fr/autre">`;
    expect(points(page({ tete })).indexable).toBe(0);
  });
  it("indexable : absente du sitemap → 0", () => {
    expect(points(page(), { dansSitemap: false }).indexable).toBe(0);
  });
  it("indexable : canonique avec barre finale → 10", () => {
    const tete = `<link rel="canonical" href="${URL_PAGE}/">`;
    expect(points(page({ tete })).indexable).toBe(10);
  });

  it("liens internes : un seul lien fort → 0 ; deux fois le même → 0", () => {
    expect(points(page({ liens: `<a href="/fr/journee-ia">a</a>` })).liensInternes).toBe(0);
    expect(
      points(page({ liens: `<a href="/fr/journee-ia">a</a><a href="/fr/journee-ia/">b</a>` }))
        .liensInternes,
    ).toBe(0);
  });
  it("liens internes : lien externe vers un chemin « fort » ne compte pas", () => {
    expect(
      points(
        page({
          liens: `<a href="https://autre.fr/fr/journee-ia">a</a><a href="https://autre.fr/fr/tarifs">b</a>`,
        }),
      ).liensInternes,
    ).toBe(0);
  });

  it("markdown : absente → 0 ; indiquée par l'entrée → 5", () => {
    const tete = `<link rel="canonical" href="${URL_PAGE}">`;
    expect(points(page({ tete })).markdown).toBe(0);
    expect(points(page({ tete }), { varianteMarkdown: true }).markdown).toBe(5);
  });
});

describe("calculerCitabilite — pénalités", () => {
  it("prix divergent de la Journée IA : −20 et divergence signalée", () => {
    const r = calculerCitabilite(
      entree(page({ extra: "<p>La Journée IA coûte 1 290 € par jour.</p>" })),
    );
    expect(r.divergences.map((d) => d.type)).toEqual(["prix-journee-ia"]);
    expect(r.divergences[0]?.trouve).toBe(1290);
    expect(r.divergences[0]?.attendu).toBe(JOURNEE_IA_TIER.priceFlat);
    expect(r.score).toBe(r.sousTotal - 20);
  });

  it("prix conforme : aucune pénalité", () => {
    const prix = String(JOURNEE_IA_TIER.priceFlat).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const r = calculerCitabilite(entree(page({ extra: `<p>La Journée IA coûte ${prix} €.</p>` })));
    expect(r.divergences).toEqual([]);
  });

  it("« Grenoble » : −20", () => {
    const r = calculerCitabilite(entree(page({ extra: "<p>Nous sommes à Grenoble.</p>" })));
    expect(r.interdits.map((i) => i.code)).toContain("grenoble");
    expect(r.score).toBe(r.sousTotal - 20);
  });

  it("les deux pénalités se cumulent, le score ne passe jamais sous 0", () => {
    const r = calculerCitabilite(
      entree("<html><body><p>La Journée IA à 10 € à Grenoble.</p></body></html>"),
    );
    expect(r.penalites).toHaveLength(2);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("un mot interdit dans un script n'est pas du texte visible", () => {
    const r = calculerCitabilite(entree(page({ extra: `<script>var v = "Grenoble";</script>` })));
    expect(r.interdits).toEqual([]);
  });
});

describe("calculerCitabilite — page réelle (extrait représentatif)", () => {
  const html = `<!doctype html><html lang="fr"><head><title>Journée IA</title>
<link rel="canonical" href="https://axion-ia.com/fr/journee-ia"></head><body>
<header><nav><a href="/fr">Accueil</a></nav></header>
<main><h1>La Journée IA</h1>
<p>Une journée dans votre entreprise&nbsp;: le matin, un audit ; l'après-midi, la formation des équipes.</p>
<p>Le rapport est remis sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés.</p></main></body></html>`;

  it("page sans structure GEO : score bas, aucune pénalité, aucune exception", () => {
    const r = calculerCitabilite(
      entree(html, { url: "https://axion-ia.com/fr/journee-ia", dansSitemap: true }),
    );
    expect(r.penalites).toEqual([]);
    expect(r.criteres.find((c) => c.id === "indexable")?.ok).toBe(true);
    expect(r.criteres.find((c) => c.id === "structureTitres")?.ok).toBe(false);
    expect(r.score).toBeLessThan(30);
  });
});

describe("faits canon : lus à la source", () => {
  it("reprend le prix et le délai des fichiers de contenu", () => {
    expect(faitsCanon()).toEqual({
      prixJourneeIaEur: JOURNEE_IA_TIER.priceFlat,
      delaiRapportJoursOuvres: DELAI_RAPPORT_JOURS_OUVRES,
    });
  });

  it("détecte un délai de rapport divergent", () => {
    const canon = faitsCanon();
    const d = detecterFaitsDivergents(
      `Le rapport est remis sous ${canon.delaiRapportJoursOuvres + 5} jours ouvrés.`,
      canon,
    );
    expect(d.map((x) => x.type)).toEqual(["delai-rapport"]);
  });

  it("ne juge pas un prix hors Journée IA", () => {
    const canon = faitsCanon();
    expect(detecterFaitsDivergents("Un devis à 5 000 € minimum.", canon)).toEqual([]);
  });

  it("comprend les espaces insécables et « euros »", () => {
    const canon = { prixJourneeIaEur: 1490, delaiRapportJoursOuvres: 10 };
    expect(detecterFaitsDivergents("La Journée IA : 1 490 €.", canon)).toEqual([]);
    expect(detecterFaitsDivergents("La Journée IA : 1490 euros.", canon)).toEqual([]);
    expect(detecterFaitsDivergents("La Journée IA : 990 euros.", canon)).toHaveLength(1);
  });
});

describe("régressions de la relecture", () => {
  it("la phrase de déduction canon (5 000 € et prix) ne diverge pas", () => {
    const texte = DEDUCTION_JOURNEE_IA.replace(
      "{{PRIX}}",
      `${String(faitsCanon().prixJourneeIaEur).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`,
    );
    expect(detecterFaitsDivergents(texte, faitsCanon())).toEqual([]);
  });

  it("une Organization redéfinie avec le même @id reste à 10", () => {
    const complet = {
      "@type": "Organization",
      "@id": ID_ORGANISATION,
      name: "Axion-IA",
      url: "https://axion-ia.com",
    };
    const html = page({ jsonLd: JSON.stringify({ "@graph": [complet] }) }).replace(
      "</head>",
      `<script type="application/ld+json">${JSON.stringify(complet)}</script></head>`,
    );
    expect(points(html).jsonLd).toBe(10);
  });

  it.each([
    ["<p> non fermés", "<p>mot ".repeat(150_000)],
    ["<!-- non fermés", "<!-- x ".repeat(150_000)],
    ["<script non fermés", "<script>x ".repeat(100_000)],
    ["balises ouvertes sans >", "<a href=x ".repeat(90_000)],
    ["<ul> non fermés", "<ul><li>a ".repeat(80_000)],
    ["chiffres collés à Journée IA", `Journée IA ${"9".repeat(200_000)}`],
  ])("une entrée gigantesque (%s) reste en temps linéaire", (_nom, corps) => {
    const t0 = Date.now();
    const r = calculerCitabilite(entree(`<html><body><main>${corps}</main></body></html>`));
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(Date.now() - t0).toBeLessThan(1500);
  });
});

describe("régressions de la relecture — tour 2", () => {
  const penal = (html: string) => calculerCitabilite(entree(html));

  it("un Organization imbriqué (recognizedBy) n'est pas une seconde définition", () => {
    const ld = JSON.stringify({
      "@graph": [
        {
          "@type": "Organization",
          "@id": ID_ORGANISATION,
          name: "Axion-IA",
          recognizedBy: [{ "@type": "Organization", name: "Organisme certificateur" }],
        },
        { "@type": "WebPage", publisher: { "@id": ID_ORGANISATION } },
      ],
    });
    expect(points(page({ jsonLd: ld })).jsonLd).toBe(10);
  });

  it("un GovernmentOrganization défini au niveau du graphe sans @id du site fait perdre le critère", () => {
    const ld = JSON.stringify({
      "@graph": [{ "@type": "GovernmentOrganization", name: "Autre" }],
    });
    expect(points(page({ jsonLd: ld })).jsonLd).toBe(0);
  });

  it("« par rapport à … 5 jours ouvrés » n'est pas le délai du rapport", () => {
    const r = penal(
      "<main><p>Par rapport à un cabinet, comptez 5 jours ouvrés pour un devis.</p></main>",
    );
    expect(r.divergences).toEqual([]);
  });

  it("un autre délai après un point-virgule n'est pas jugé", () => {
    const r = penal(
      `<main><p>Le rapport est remis sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés ; le paiement à 30 jours ouvrés.</p></main>`,
    );
    expect(r.divergences).toEqual([]);
  });

  it("des blocs voisins sans ponctuation ne fusionnent pas en une phrase", () => {
    const r = penal(
      "<main><h3>Découvrir la Journée IA</h3><h3>Accompagnement</h3><p>À partir de 4 900 €</p></main>",
    );
    expect(r.divergences).toEqual([]);
  });

  it("un prix faux dans la même phrase que la Journée IA reste détecté", () => {
    const r = penal("<main><p>La Journée IA coûte 4 900 €.</p></main>");
    expect(r.divergences.map((d) => d.type)).toEqual(["prix-journee-ia"]);
  });

  it("les formules d'accueil (slogan, « ils nous font confiance ») ne sont pas pénalisées", () => {
    const r = penal("<main><h1>Axion-IA</h1><p>Nous, si.</p><p>Ils nous font confiance</p></main>");
    expect(r.interdits).toEqual([]);
  });

  it("« Questions fréquentes » et « Commentaires » ne comptent pas comme questions", () => {
    const html = page({ h2: ["Questions fréquentes", "Quelques chiffres", "Commentaires"] });
    expect(points(html).structureTitres).toBe(0);
  });

  it("un <time> hors du corps (pied de page) ne date pas la page", () => {
    const html = page({ temps: "" }).replace(
      "</main>",
      `</main><footer><time datetime="2026-10-01">1 oct.</time></footer>`,
    );
    expect(points(html).dateVisible).toBe(0);
  });

  it("le dateModified d'un WebSite ne date pas la page", () => {
    const ld = JSON.stringify({
      "@graph": [
        { "@type": "WebSite", dateModified: "2026-10-01", publisher: { "@id": ID_ORGANISATION } },
      ],
    });
    expect(points(page({ jsonLd: ld })).dateVisible).toBe(0);
  });
});

describe("page réelle — rendu complet (gabarit Next : layout, JSON-LD global, hero, nav)", () => {
  // Instantané reconstitué du rendu d'une page d'offre : <head> chargé, graphe JSON-LD global
  // (organisation + organisme certificateur imbriqué), hero sans ponctuation, cartes, images
  // à srcset long, pied de page daté.
  const srcset = Array.from(
    { length: 40 },
    (_, i) => `/_next/image?url=%2Fa.png&w=${i + 1}0&q=75 ${i + 1}0w`,
  ).join(", ");
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charSet="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>La Journée IA — Axion-IA</title>
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="https://axion-ia.com/fr/journee-ia"/>
<link rel="alternate" type="text/markdown" href="https://axion-ia.com/fr/journee-ia.md"/>
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": ID_ORGANISATION,
        name: "Axion-IA",
        url: "https://axion-ia.com",
        recognizedBy: [{ "@type": "Organization", name: "Organisme certificateur" }],
      },
      { "@type": "WebSite", "@id": "https://axion-ia.com/#website", dateModified: "2020-01-01" },
      {
        "@type": "WebPage",
        "@id": "https://axion-ia.com/fr/journee-ia",
        publisher: { "@id": ID_ORGANISATION },
        dateModified: "2026-11-01",
      },
    ],
  })}</script>
<script>self.__next_f=self.__next_f||[];self.__next_f.push([1,"<h1>faux</h1>"])</script>
<style>.hero{color:#c24a1b}</style></head>
<body class="antialiased"><header><nav><a href="/fr">Accueil</a><a href="/fr/tarifs">Tarifs</a></nav></header>
<main id="contenu"><section class="hero"><h1>La Journée IA</h1>
<p>Une journée dans votre entreprise : le matin, un audit de vos usages ; l'après-midi, la formation de vos équipes sur vos propres cas. Le prix est fixe, ${faitsCanon().prixJourneeIaEur.toLocaleString("fr-FR")}&nbsp;€, et le rapport vous est remis sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés, avec les priorités classées et un plan d'action chiffré pour les trois mois suivants.</p>
<img alt="Équipe en atelier" src="/a.png" srcset="${srcset}" sizes="100vw"/></section>
<section><h2>Comment se déroule la journée ?</h2>
<ul><li>Audit du matin</li><li>Formation de l'après-midi</li><li>Rapport sous quelques jours</li></ul>
<h2>Que contient le rapport ?</h2><p>${phrase(55)}</p>
<h2>Pourquoi un prix fixe ?</h2><p>${phrase(60)}</p>
<div class="carte"><h3>Découvrir la Journée IA</h3></div><div class="carte"><h3>Accompagnement</h3></div>
<p>À partir de 4&nbsp;900&nbsp;€ pour l'accompagnement long.</p>
<a href="/fr/tarifs">Voir les tarifs</a> <a href="/fr/a-propos">À propos</a></section></main>
<footer><time datetime="2026-11-01">1 novembre 2026</time></footer></body></html>`;

  it("score cohérent, aucune pénalité à tort, JSON-LD relié, pas de fuite de script ni de srcset", () => {
    const r = calculerCitabilite(
      entree(html, {
        url: "https://axion-ia.com/fr/journee-ia",
        pagesFortes: ["/fr/tarifs", "/fr/a-propos"],
      }),
    );
    expect(r.penalites).toEqual([]);
    const ok = (id: IdCritere) => r.criteres.find((c) => c.id === id)?.ok;
    expect(ok("jsonLd")).toBe(true);
    expect(ok("indexable")).toBe(true);
    expect(ok("markdown")).toBe(true);
    expect(ok("structureTitres")).toBe(true);
    expect(ok("structureListes")).toBe(true);
    expect(ok("liensInternes")).toBe(true);
    // Le <time> n'est que dans le pied de page : la date visible n'est pas créditée.
    expect(ok("dateVisible")).toBe(false);
    expect(r.score).toBeGreaterThan(50);
  });
});
