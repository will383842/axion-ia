import { describe, expect, it } from "vitest";
import {
  GABARITS,
  GABARITS_REGLES,
  TITRES_GENERIQUES,
  calculerFourchetteMots,
  compterMotsContenu,
  formatDominant,
  motsSignificatifs,
  verifierTitres,
  type SectionPlan,
} from "./structure-hn";

describe("compterMotsContenu : une seule façon de compter", () => {
  it("ignore la ponctuation isolée (« ? » et « : » précédés d'une espace)", () => {
    expect(compterMotsContenu("Que faire ? Voici : trois étapes .")).toBe(5);
  });
  it("compte les nombres et les mots accentués", () => {
    expect(compterMotsContenu("En 2026, 14 % des PME")).toBe(5);
    expect(compterMotsContenu("")).toBe(0);
  });
});

describe("motsSignificatifs", () => {
  it("garde les mots de 3 lettres ou plus et « IA », sans mots vides, sans pluriel", () => {
    expect(motsSignificatifs("L'IA dans les PME : quels outils ?")).toEqual(
      expect.arrayContaining(["ia", "pme", "outil"]),
    );
    expect(motsSignificatifs("les des une")).toEqual([]);
  });
});

describe("règles par gabarit (addendum § 10)", () => {
  it("porte les dix gabarits, bornes cohérentes", () => {
    expect(GABARITS).toHaveLength(10);
    for (const g of GABARITS) {
      const r = GABARITS_REGLES[g];
      expect(r.motsMin).toBeLessThan(r.motsMax);
      expect(r.repliMin).toBeGreaterThanOrEqual(r.motsMin);
      expect(r.repliMax).toBeLessThanOrEqual(r.motsMax);
      expect(r.h2Min).toBeLessThanOrEqual(r.h2Max);
    }
    expect(GABARITS_REGLES.analyse.motsMin).toBe(800);
    expect(GABARITS_REGLES["guide-pilier"].motsMax).toBe(4500);
  });
  it("ne descend jamais sous le plancher de la porte : 850 mots pour un article (B11)", () => {
    // Les gabarits courts (définition, FAQ, actualité…) relèvent d'un seuil décidé avec la porte :
    // leurs bornes sont documentées, jamais utilisées pour contourner B11 sur l'article standard.
    expect(GABARITS_REGLES.analyse.motsMin).toBeLessThan(850);
    expect(GABARITS_REGLES.analyse.repliMin).toBeGreaterThanOrEqual(850);
  });
});

describe("formatDominant", () => {
  it("rend le format d'au moins 60 % des pages lisibles, sinon mixte", () => {
    const p = (format: string, mots: number) => ({ url: "https://a.fr/" + format, format, mots });
    expect(
      formatDominant([p("guide-etapes", 900), p("guide-etapes", 1000), p("analyse", 1100)]),
    ).toBe("guide-etapes");
    expect(formatDominant([p("guide-etapes", 900), p("analyse", 1000)])).toBe("mixte");
    expect(formatDominant([])).toBe("mixte");
  });
  it("ignore les pages illisibles (0 mot)", () => {
    const p = (format: string, mots: number) => ({ url: "https://a.fr/" + format, format, mots });
    expect(formatDominant([p("analyse", 900), p("forum", 0), p("forum", 0)])).toBe("analyse");
  });
});

describe("calculerFourchetteMots (addendum § 7.3)", () => {
  const page = (mots: number) => ({ url: `https://a.fr/${mots}`, format: "guide-etapes", mots });
  it("mesure : 0,75 à 1,25 fois la médiane, arrondie à 50, dans les bornes du gabarit", () => {
    const r = calculerFourchetteMots({
      gabarit: "guide",
      pagesLues: [page(1200), page(1400), page(1600)],
      nbH2: 5,
    });
    expect(r).toMatchObject({ ok: true, methode: "mesure", mediane: 1400, pagesRetenues: 3 });
    if (r.ok) {
      expect(r.min).toBe(1050);
      expect(r.max).toBe(1750);
    }
  });
  it("repli du gabarit quand moins de 3 pages compatibles", () => {
    const r = calculerFourchetteMots({
      gabarit: "guide",
      pagesLues: [page(1200), { ...page(900), format: "page-offre" }],
      nbH2: 5,
    });
    expect(r).toMatchObject({ ok: true, methode: "repli-gabarit", min: 1200, max: 1800 });
  });
  it("le plancher de couverture 60 + 100 × H2 relève le minimum", () => {
    const r = calculerFourchetteMots({ gabarit: "analyse", pagesLues: [], nbH2: 8 });
    expect(r.ok && r.min).toBeGreaterThanOrEqual(860);
  });
  it("refuse le plan quand le plancher dépasse la borne haute du gabarit", () => {
    const r = calculerFourchetteMots({ gabarit: "definition", pagesLues: [], nbH2: 20 });
    expect(r).toEqual({ ok: false, raison: "plan_trop_long_pour_le_gabarit" });
  });
  it("garde un écart d'au moins 200 mots quand les bornes le permettent", () => {
    const r = calculerFourchetteMots({
      gabarit: "analyse",
      pagesLues: [page(1000), page(1000), page(1000)].map((p) => ({ ...p, format: "analyse" })),
      nbH2: 4,
    });
    expect(r.ok && r.max - r.min).toBeGreaterThanOrEqual(200);
  });
  it("calcule le plancher des questions-réponses : 60 + 60 × questions", () => {
    const r = calculerFourchetteMots({ gabarit: "faq", pagesLues: [], nbH2: 1, nbQuestions: 12 });
    expect(r.ok && r.min).toBeGreaterThanOrEqual(780);
  });
});

const plan = (...intitules: string[]): SectionPlan[] =>
  intitules.map((intitule) => ({
    type: "informatif",
    intitule,
    question: null,
    blocAttendu: null,
  }));

describe("verifierTitres (H-1 à H-11)", () => {
  const h1 = "Comment automatiser les notes de frais dans une PME ?";
  const bon = plan(
    "Quels frais peut-on automatiser en premier ?",
    "Quels outils choisir pour une PME de 40 salariés ?",
    "Comment former les équipes sans les ralentir ?",
    "Quelles erreurs éviter pendant le déploiement ?",
  );
  it("accepte un plan sain", () => {
    expect(
      verifierTitres({ h1, motCle: "automatiser notes de frais", plan: bon, gabarit: "analyse" }),
    ).toEqual([]);
  });
  it("refuse un H1 trop court, trop long, avec marque ou séparateur", () => {
    const base = { motCle: "notes de frais", plan: bon, gabarit: "analyse" as const };
    expect(verifierTitres({ ...base, h1: "Notes de frais" })).toContain("h1_longueur");
    expect(verifierTitres({ ...base, h1: "Notes de frais " + "mot ".repeat(25) })).toContain(
      "h1_longueur",
    );
    expect(
      verifierTitres({ ...base, h1: "Notes de frais et IA | Axion-IA pour les PME" }),
    ).toContain("h1_marque_ou_separateur");
  });
  it("refuse un H1 sans mot significatif du mot-clé", () => {
    expect(
      verifierTitres({ h1, motCle: "cybersécurité", plan: bon, gabarit: "analyse" }),
    ).toContain("h1_sans_mot_cle");
  });
  it("refuse les titres génériques", () => {
    expect(TITRES_GENERIQUES).toContain("introduction");
    const p = plan(
      "Introduction",
      "Quels outils choisir pour une PME ?",
      "Comment former les équipes ?",
      "Quelles erreurs éviter ici ?",
    );
    expect(verifierTitres({ h1, motCle: "notes de frais", plan: p, gabarit: "analyse" })).toContain(
      "h2_generique",
    );
  });
  it("refuse un nombre de H2 hors bornes du gabarit", () => {
    expect(
      verifierTitres({ h1, motCle: "notes de frais", plan: bon.slice(0, 2), gabarit: "analyse" }),
    ).toContain("h2_nombre");
  });
  it("refuse un H2 trop court ou trop long, en double, ou identique au H1", () => {
    const p = plan(
      "Outils ?",
      "Quels outils choisir pour une PME ?",
      "Quels outils choisir pour une PME ?",
      h1,
    );
    const r = verifierTitres({ h1, motCle: "notes de frais", plan: p, gabarit: "analyse" });
    expect(r).toEqual(expect.arrayContaining(["h2_longueur", "h2_doublon", "h2_egal_h1"]));
  });
  it("limite le mot-clé exact à 2 H2", () => {
    const p = plan(
      "Pourquoi les notes de frais coûtent-elles cher ?",
      "Comment suivre vos notes de frais chaque mois ?",
      "Quels pièges évitent les notes de frais ratées ?",
      "Que faire des notes de frais refusées ?",
    );
    expect(verifierTitres({ h1, motCle: "notes de frais", plan: p, gabarit: "analyse" })).toContain(
      "motcle_exact_trop_present",
    );
  });
  it("refuse un titre générique suivi d'un deux-points", () => {
    const p = plan(
      "Conclusion : ce qu'il faut retenir pour vous",
      "Quels outils choisir pour une PME ?",
      "Comment former les équipes ?",
      "Quelles erreurs éviter ici ?",
    );
    expect(
      verifierTitres({
        h1: "Comment automatiser les notes de frais dans une PME ?",
        motCle: "notes de frais",
        plan: p,
        gabarit: "analyse",
      }),
    ).toContain("h2_generique");
  });
  it("le plancher de couverture relève le minimum même sous la borne basse", () => {
    const r = calculerFourchetteMots({ gabarit: "definition", pagesLues: [], nbH2: 6 });
    expect(r.ok && r.min).toBeGreaterThanOrEqual(660);
  });
});
