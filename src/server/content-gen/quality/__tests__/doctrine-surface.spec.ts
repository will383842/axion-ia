/**
 * Tests — doctrine sur toute la surface d'une sortie (titre, méta, FAQ, point
 * clé, avis d'expert, slug, alt/title, corps) et liste des fautes dures.
 */

import { describe, expect, it } from "vitest";
import { detecterInterditsSurface } from "@/lib/contenu/interdits-publication";
import { fautesDures, surfaceDepuisSortie, type SortiePourSurface } from "../doctrine-surface";

const OPTS = { actualite: false, financementPublicAutorise: false };

/** Sortie saine : un interdit est ajouté dans UN seul champ à chaque test. */
function sortie(surcharge: Partial<SortiePourSurface> = {}): SortiePourSurface {
  return {
    title: "Comment gagner du temps sur vos devis",
    metaTitle: "Gagner du temps sur vos devis",
    metaDescription: "Un exemple simple pour réduire le temps passé sur vos devis.",
    slug: "gagner-du-temps-sur-vos-devis",
    directAnswer: "Un modèle de réponse réduit le temps passé sur chaque devis.",
    bodyHtml: '<p>Un texte sain.</p><img src="/a.webp" alt="Un bureau" title="Bureau">',
    bodyText: "Un texte sain sur les devis.",
    faq: [
      { question: "Question 0 ?", answer: "Réponse 0." },
      { question: "Question 1 ?", answer: "Réponse 1." },
      { question: "Question 2 ?", answer: "Réponse 2." },
      { question: "Question 3 ?", answer: "Réponse 3." },
    ],
    keyTakeaway: "Commencez par un cas simple.",
    expertQuote: { name: "Équipe", title: "Cabinet", text: "Mesurez avant de généraliser." },
    tags: ["devis", "productivité"],
    ...surcharge,
  };
}

function violations(s: SortiePourSurface) {
  return detecterInterditsSurface(surfaceDepuisSortie(s), OPTS);
}

describe("surfaceDepuisSortie", () => {
  it("expose tous les champs publiés", () => {
    const champs = surfaceDepuisSortie(sortie());
    expect(Object.keys(champs)).toEqual(
      expect.arrayContaining([
        "titre",
        "metaTitre",
        "metaDescription",
        "slug",
        "reponseDirecte",
        "pointCle",
        "avisExpert",
        "tags",
        "attributs",
        "corps",
        "faq[3].question",
        "faq[3].reponse",
      ]),
    );
  });

  it("remplace les tirets du slug par des espaces", () => {
    expect(surfaceDepuisSortie(sortie({ slug: "formation-gratuite-ia" }))["slug"]).toBe(
      "formation gratuite ia",
    );
  });

  it("extrait les valeurs alt et title du HTML", () => {
    const attrs = surfaceDepuisSortie(sortie())["attributs"] ?? "";
    expect(attrs).toContain("Un bureau");
    expect(attrs).toContain("Bureau");
  });

  it("une sortie saine ne produit aucune violation", () => {
    expect(violations(sortie())).toEqual([]);
  });
});

describe("un interdit seul dans un champ est désigné", () => {
  const cas: ReadonlyArray<readonly [string, Partial<SortiePourSurface>, string]> = [
    ["titre", { title: "Notre méthode certifiée Qualiopi" }, "titre"],
    ["metaTitle", { metaTitle: "Formation éligible au CPF" }, "metaTitre"],
    [
      "metaDescription",
      { metaDescription: "Un résultat garanti dès le premier mois." },
      "metaDescription",
    ],
    [
      "directAnswer",
      { directAnswer: "Une prise en charge à 100 % financé est possible." },
      "reponseDirecte",
    ],
    ["keyTakeaway", { keyTakeaway: "Faites-le vous-même en une heure." }, "pointCle"],
    [
      "faq[3].answer",
      {
        faq: [
          { question: "Question 0 ?", answer: "Réponse 0." },
          { question: "Question 1 ?", answer: "Réponse 1." },
          { question: "Question 2 ?", answer: "Réponse 2." },
          { question: "Question 3 ?", answer: "Nous intervenons à Grenoble." },
        ],
      },
      "faq[3].reponse",
    ],
    [
      "expertQuote.text",
      {
        expertQuote: { name: "Équipe", title: "Cabinet", text: "Un cas client dans le commerce." },
      },
      "avisExpert",
    ],
    ["slug", { slug: "formation-gratuite-pour-tous" }, "slug"],
    ["tags", { tags: ["devis", "qualiopi"] }, "tags"],
    ["alt", { bodyHtml: '<img src="/a.webp" alt="Logo Qualiopi" title="Bureau">' }, "attributs"],
    ["corps", { bodyText: "Nous sommes partenaire officiel de plusieurs éditeurs." }, "corps"],
  ];

  for (const [nom, surcharge, champ] of cas) {
    it(nom, () => {
      const v = violations(sortie(surcharge));
      expect(v.length).toBeGreaterThan(0);
      expect(v.every((x) => x.champ === champ)).toBe(true);
      const fautes = fautesDures({ blockingViolations: [] }, v);
      expect(fautes.length).toBeGreaterThan(0);
      expect(fautes[0]!.champ).toBe(champ);
    });
  }
});

describe("fautesDures", () => {
  const siren = {
    pattern: "SIREN/SIRET/RCS",
    severity: "block" as const,
    reason: "x",
    occurrences: 1,
  };
  const prix = {
    pattern: "prix-non-SSOT:35",
    severity: "block" as const,
    reason: "x",
    occurrences: 1,
  };
  const phraseBase = {
    pattern: "interdit maison",
    severity: "block" as const,
    reason: "x",
    occurrences: 1,
    origine: "phrase-base" as const,
  };
  const naming = {
    pattern: "AxionIA / Axion IA",
    severity: "block" as const,
    reason: "x",
    occurrences: 1,
  };

  it("garde le SIREN, et lui seul par défaut", () => {
    const f = fautesDures({ blockingViolations: [siren, prix, phraseBase, naming] }, []);
    expect(f.map((x) => x.code)).toEqual(["SIREN/SIRET/RCS"]);
  });

  it("retient les prix hors grille seulement si la config l'active", () => {
    const f = fautesDures({ blockingViolations: [prix] }, [], { retainNonSsotPrice: true });
    expect(f.map((x) => x.code)).toEqual(["prix-non-SSOT:35"]);
  });

  it("retient les phrases de la base en block seulement si le drapeau est activé", () => {
    expect(fautesDures({ blockingViolations: [phraseBase] }, [])).toEqual([]);
    const f = fautesDures({ blockingViolations: [phraseBase] }, [], {
      retainBannedPhraseBlock: true,
    });
    expect(f.map((x) => x.code)).toEqual(["interdit maison"]);
  });

  it("ajoute chaque violation de surface avec son champ", () => {
    const f = fautesDures({ blockingViolations: [] }, [
      { code: "qualiopi", champ: "titre", extrait: "certifie qualiopi" },
    ]);
    expect(f).toEqual([{ code: "qualiopi", champ: "titre", extrait: "certifie qualiopi" }]);
  });
});
