import { describe, expect, it } from "vitest";
import { validateDataQuality } from "../../quality/data-quality-gate";
import { evaluerPorteAvec as evaluerBrut } from "../porte";
import { CRITERES } from "../registre";
import {
  contenuValide,
  contexteValide,
  corpsValide,
  LIENS_SAINS,
  mots,
  REPONSE_DIRECTE,
} from "./fixtures";
import type { ContenuPorte, ContextePorte } from "../types";

const evaluerPorte = (a: ContenuPorte, b: ContextePorte) =>
  evaluerBrut(a, b, { idsAttendus: CRITERES.map((k) => k.id) });

function r(id: string, c: Partial<ContenuPorte> = {}, x: Partial<ContextePorte> = {}) {
  return evaluerPorte(contenuValide(c), contexteValide(x)).criteres.find((k) => k.id === id)!;
}

describe("B01 doctrine (appelle interdits-publication, ne la copie pas)", () => {
  it("passe sur un contenu sain", () => expect(r("B01").statut).toBe("ok"));
  it("« partout en France » n'est jamais refusée", () => {
    const corps = corpsValide() + "<p>Nous intervenons dans vos locaux, partout en France.</p>";
    const v = evaluerPorte(
      contenuValide({
        corpsHtml: corps,
        metaDescription: "Une journée dans vos locaux, partout en France.",
      }),
      contexteValide(),
    );
    expect(v.criteres.filter((c) => c.statut !== "ok").map((c) => c.id)).toEqual([]);
    expect(v.verdict).toBe("publiable");
  });
  it("refuse « Grenoble » dans le corps", () => {
    const x = r("B01", { corpsHtml: corpsValide() + "<p>Notre équipe à Grenoble.</p>" });
    expect(x.statut).toBe("echec");
  });
  it("refuse Grenoble dans le titre, la méta, un champ supplémentaire (alt, JSON-LD)", () => {
    expect(r("B01", { titre: "IA à Grenoble" }).statut).toBe("echec");
    expect(r("B01", { corpsHtml: corpsValide() + "<p>Gre<span></span>noble</p>" }).statut).toBe(
      "echec",
    );
    // un champ supplémentaire ne peut pas masquer le titre
    expect(
      r("B01", { titre: "IA à Grenoble", champsSupplementaires: { titre: "propre" } }).statut,
    ).toBe("echec");
    expect(r("B01", { metaDescription: "Axion-IA à Grenoble" }).statut).toBe("echec");
    expect(r("B01", { champsSupplementaires: { "image.alt": "bureau à Grenoble" } }).statut).toBe(
      "echec",
    );
  });
  it("refuse Qualiopi", () => {
    expect(
      r("B01", { corpsHtml: corpsValide() + "<p>Nous sommes certifiés Qualiopi.</p>" }).statut,
    ).toBe("echec");
  });
  it("l'actualité RSS et le financement public suivent les options de la liste", () => {
    const corps = corpsValide() + "<p>Une prise en charge par votre OPCO est possible.</p>";
    expect(r("B01", { corpsHtml: corps }).statut).toBe("echec");
    expect(r("B01", { corpsHtml: corps }, { financementPublicAutorise: true }).statut).toBe("ok");
  });
});

describe("B03 faits canoniques (prix)", () => {
  it("passe sans prix", () => expect(r("B03").statut).toBe("ok"));
  it("refuse un prix hors source unique", () => {
    const x = r("B03", { corpsHtml: corpsValide() + "<p>Cela coûte 1 234 € HT.</p>" });
    expect(x.statut).toBe("echec");
    expect(x.preuves.join(" ")).toMatch(/1 234/);
  });
  it("ignore le jeton {{price:journee-ia}}", () => {
    expect(
      r("B03", { corpsHtml: corpsValide() + "<p>Pour {{price:journee-ia}}.</p>" }).statut,
    ).toBe("ok");
  });
  it("accepte le seul prix de la source unique, même avec espace insécable ou entité", () => {
    for (const p of ["1 490 € HT", "1&nbsp;490&nbsp;€ HT", "1&#8239;490 &euro; HT"]) {
      expect(
        r("B03", { corpsHtml: corpsValide() + `<p>La Journée IA coûte ${p}.</p>` }).statut,
        p,
      ).toBe("ok");
    }
  });
  it("juge la phrase d'Axion-IA même si le même montant apparaît licite ailleurs", () => {
    const corps =
      corpsValide() +
      "<p>Une aide régionale de 3 500 € existe. Notre accompagnement est à 3 500 € HT.</p>";
    expect(r("B03", { corpsHtml: corps }).statut).toBe("echec");
  });
  it("contrôle aussi le point clé et la réponse directe (B01 et B03)", () => {
    expect(r("B01", { keyTakeaway: "Formation certifiée Qualiopi et éligible CPF" }).statut).toBe(
      "echec",
    );
    expect(r("B01", { directAnswer: mots(45) + " Qualiopi." }).statut).toBe("echec");
    expect(r("B03", { keyTakeaway: "Notre diagnostic coûte 3 500 € HT" }).statut).toBe("echec");
  });
  it("ne juge pas les montants hors offre (abonnement tiers, prise en charge)", () => {
    const corps =
      corpsValide() +
      "<p>L'abonnement ChatGPT Team coûte 25 € par mois. Votre OPCO peut prendre en charge la formation jusqu'à 3 000 €.</p>";
    expect(r("B03", { corpsHtml: corps }).statut).toBe("ok");
  });
  it("un titre « Nos… » ou la méta ne contaminent pas le paragraphe suivant", () => {
    const h = corpsValide() + "<h2>Nos offres</h2><p>Un abonnement ChatGPT coûte 25 €</p>";
    expect(r("B03", { corpsHtml: h }).statut).toBe("ok");
    expect(
      r("B03", { titre: "Nos conseils pour PME", metaDescription: "ChatGPT coûte 25 € par mois." })
        .statut,
    ).toBe("ok");
  });
  it("limite assumée : un prix sans mot d'offre dans sa phrase n'est pas jugé par B03", () => {
    const corps = corpsValide() + "<p>La formule intra coûte 2 000 € par personne.</p>";
    expect(r("B03", { corpsHtml: corps }).statut).toBe("ok");
  });
  it("ne juge pas un montant étranger à l'offre (aide, amende) : c'est B02", () => {
    const corps =
      corpsValide() + "<p>Une aide de 5 000 € existe. Une amende de 20 000 € est possible.</p>";
    expect(r("B03", { corpsHtml: corps }).statut).toBe("ok");
  });
});

describe("B08 réponse directe de 40 à 60 mots", () => {
  it.each([
    [39, "echec"],
    [40, "ok"],
    [60, "ok"],
    [61, "echec"],
  ])("%i mots → %s", (n, attendu) => {
    expect(r("B08", { directAnswer: mots(n) }).statut).toBe(attendu);
  });
  it("refuse l'absence de réponse directe", () => {
    expect(r("B08", { directAnswer: null }).statut).toBe("echec");
    expect(r("B08", { directAnswer: "   " }).statut).toBe("echec");
  });
  it("reste aligné sur data-quality-gate pour le plancher de 40 mots", () => {
    for (const n of [39, 40]) {
      const ancien = validateDataQuality({
        contentType: "blog_article",
        keyTakeaway: "un point clé de cinq mots",
        expertQuote: null,
        faqJson: null,
        directAnswer: mots(n),
        citationCount: 2,
      });
      const ancienRefuse = ancien.reasons.some((x) => x.startsWith("directAnswer"));
      expect(r("B08", { directAnswer: mots(n) }).statut === "echec").toBe(ancienRefuse);
    }
  });
});

describe("B11 complétude (sans la FAQ ni expertQuote)", () => {
  it("passe sur un article complet", () => expect(r("B11").statut).toBe("ok"));
  it("ne demande NI FAQ NI citation d'expert", () => {
    const x = r("B11", { corpsHtml: corpsValide() });
    expect(x.statut).toBe("ok");
    expect(JSON.stringify(x)).not.toMatch(/faq|expert/i);
  });
  it("refuse un article long de moins de 850 mots", () => {
    expect(r("B11", { corpsHtml: corpsValide({ motsParSection: 150 }) }).statut).toBe("echec");
  });
  it("refuse moins de 3 ou plus de 8 H2", () => {
    expect(r("B11", { corpsHtml: corpsValide({ h2: 2, motsParSection: 400 }) }).statut).toBe(
      "echec",
    );
    expect(r("B11", { corpsHtml: corpsValide({ h2: 9, motsParSection: 100 }) }).statut).toBe(
      "echec",
    );
  });
  it("refuse moins de 2 sources externes", () => {
    const html = corpsValide().replace(/<a href="https:\/\/www\.economie[^>]*>.*?<\/a>/, "la DGE");
    expect(r("B11", { corpsHtml: html }).statut).toBe("echec");
  });
  it("refuse un point clé absent ou trop court, sauf pour l'actualité RSS", () => {
    expect(r("B11", { keyTakeaway: null }).statut).toBe("echec");
    expect(r("B11", { keyTakeaway: "trop court" }).statut).toBe("echec");
    const rss = r("B11", {
      contentType: "blog_from_rss",
      keyTakeaway: null,
      corpsHtml: corpsValide({ motsParSection: 100 }),
    });
    expect(rss.statut).toBe("ok");
  });
  it("une page non article refuse sous 350 mots (page mince)", () => {
    const mince = r("B11", {
      contentType: "faq_page",
      corpsHtml: corpsValide({ motsParSection: 30 }),
    });
    expect(mince.statut).toBe("echec");
  });
});

describe("B13 maillage sortant", () => {
  it("passe avec 3 liens internes sains", () => expect(r("B13").statut).toBe("ok"));
  it("refuse moins de 3 liens internes, sans consulter la source", () => {
    const html = corpsValide().replace('<a href="/fr/blog/b">un autre guide</a>', "un autre guide");
    const x = r(
      "B13",
      { corpsHtml: html },
      { etatLiens: { etat: "indisponible", raison: "réseau" } },
    );
    expect(x.statut).toBe("echec");
  });
  it("source des liens indisponible = non évalué, pas 0 ni ok", () => {
    const x = r("B13", {}, { etatLiens: { etat: "indisponible", raison: "réseau coupé" } });
    expect(x.statut).toBe("non_evalue");
    expect(x.raison).toMatch(/réseau coupé/);
  });
  it("ne compte pas un lien mort ou non indexable", () => {
    const x = r(
      "B13",
      {},
      {
        etatLiens: {
          etat: "ok",
          valeur: { "/fr/contact": "sain", "/fr/blog/a": "mort", "/fr/blog/b": "non_indexable" },
        },
      },
    );
    expect(x.statut).toBe("echec");
  });
  it("compte une fois un même lien répété, et accepte l'URL absolue du site", () => {
    const html = `<h1>T</h1><p>${REPONSE_DIRECTE}</p><a href="/fr/contact">a</a><a href="/fr/contact#x">b</a><a href="https://axion-ia.com/fr/blog/a">c</a>`;
    const x = r("B13", { corpsHtml: html });
    expect(x.statut).toBe("echec");
    expect(x.raison).toMatch(/2 lien/);
    expect(x.preuves).toContain("/fr/blog/a");
  });
  it("exige le lien vers la page propriétaire quand elle est connue", () => {
    expect(
      r("B13", {}, { pageProprietaire: { etat: "ok", valeur: "/fr/guide-ia-pme" } }).statut,
    ).toBe("echec");
    expect(r("B13", {}, { pageProprietaire: { etat: "ok", valeur: "/fr/contact" } }).statut).toBe(
      "ok",
    );
  });
  it("page propriétaire indisponible = non évalué ; URL hors site = échec", () => {
    expect(
      r("B13", {}, { pageProprietaire: { etat: "indisponible", raison: "carte absente" } }).statut,
    ).toBe("non_evalue");
    expect(
      r("B13", {}, { pageProprietaire: { etat: "ok", valeur: "https://autre.example/x" } }).statut,
    ).toBe("echec");
  });
  it("chemin relatif de page propriétaire accepté (fr/contact)", () => {
    expect(r("B13", {}, { pageProprietaire: { etat: "ok", valeur: "fr/contact" } }).statut).toBe(
      "ok",
    );
    expect(r("B13", {}, { pageProprietaire: { etat: "ok", valeur: "fr/autre" } }).statut).toBe(
      "echec",
    );
  });
  it("lien externe jamais compté comme interne", () => {
    expect(
      r("B13", { corpsHtml: corpsValide() }, { etatLiens: LIENS_SAINS }).preuves.join(" "),
    ).not.toMatch(/insee/);
  });
});

describe("B14 auteur et dates honnêtes", () => {
  it("passe sur un contenu neuf", () => expect(r("B14").statut).toBe("ok"));
  it("refuse sans auteur ou sans date de publication", () => {
    expect(r("B14", { auteur: null }).statut).toBe("echec");
    expect(r("B14", { datePublished: null }).statut).toBe("echec");
    expect(r("B14", { datePublished: "pas une date" }).statut).toBe("echec");
  });
  it("refuse un faux auteur (personne non réelle)", () => {
    expect(r("B14", { auteur: { nom: "Marie Durand", type: "Person", reel: false } }).statut).toBe(
      "echec",
    );
  });
  it("refuse une date de publication dans le futur", () => {
    expect(r("B14", { datePublished: "2026-12-30" }).statut).toBe("echec");
  });
  it("horloge invalide : non évalué, jamais ok", () => {
    expect(r("B14", {}, { maintenant: new Date("x") }).statut).toBe("non_evalue");
  });
  it("refuse une dateModified antérieure à la publication", () => {
    expect(r("B14", { dateModified: "2026-10-01" }).statut).toBe("echec");
  });
  it("refuse une dateModified sur un contenu jamais publié", () => {
    expect(r("B14", { dateModified: "2026-11-20" }).statut).toBe("echec");
  });
  it("refuse une dateModified quand le corps n'a pas changé", () => {
    const corps = corpsValide();
    const x = r(
      "B14",
      { corpsHtml: corps, dateModified: "2026-11-20" },
      { corpsDejaPublie: { etat: "ok", valeur: corps } },
    );
    expect(x.statut).toBe("echec");
  });
  it("accepte une dateModified quand le corps a changé", () => {
    const x = r(
      "B14",
      { dateModified: "2026-11-20" },
      { corpsDejaPublie: { etat: "ok", valeur: corpsValide({ h2: 3 }) } },
    );
    expect(x.statut).toBe("ok");
  });
  it("corps déjà publié indisponible + dateModified = non évalué", () => {
    const x = r(
      "B14",
      { dateModified: "2026-11-20" },
      { corpsDejaPublie: { etat: "indisponible", raison: "base injoignable" } },
    );
    expect(x.statut).toBe("non_evalue");
  });
  it("corps déjà publié indisponible sans dateModified : sans effet", () => {
    const x = r("B14", {}, { corpsDejaPublie: { etat: "indisponible", raison: "x" } });
    expect(x.statut).toBe("ok");
  });
});
