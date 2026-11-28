import { describe, expect, it } from "vitest";
import {
  BLOCS_FAITS_MIN,
  SEUIL_SIMILARITE_VILLES,
  evaluerPageVille,
  evaluerToutesLesVilles,
  porteQualiteVilleActive,
  type BlocFait,
  type ContenuVille,
} from "../porte-qualite-ville";

const SRC = "https://www.insee.fr/fr/statistiques/2011101?geo=COM-00000";

/** Texte synthétique de test : mots tous distincts d'une ville à l'autre grâce au préfixe. */
function mots(prefixe: string, n: number): string {
  return Array.from({ length: n }, (_, i) => `${prefixe}mot${i}`).join(" ");
}

function bloc(id: string, texte: string, source: string = SRC): BlocFait {
  return { id, texte, source };
}

function ville(slug: string, nom: string, over: Partial<ContenuVille> = {}): ContenuVille {
  const blocs = [
    bloc("secteurs", `${nom} ${mots(slug + "a", 12)}`),
    bloc("ecoles", `${nom} ${mots(slug + "b", 12)}`),
    bloc("poles", `${nom} ${mots(slug + "c", 12)}`),
  ];
  return {
    slug,
    nom,
    blocsFaits: blocs,
    texteVisible: blocs.map((b) => b.texte).join(" "),
    exempleIa: `Exemple d'usage de l'IA pour ${nom} : ${mots(slug + "x", 15)}`,
    ...over,
  };
}

describe("evaluerPageVille", () => {
  it("publie une ville aux faits sourcés, propres, sans doublon", () => {
    const a = ville("alpha", "Alpha");
    const b = ville("beta", "Beta");
    const v = evaluerPageVille("alpha", a, [b]);
    expect(v).toEqual(expect.objectContaining({ publiable: true, raisons: [] }));
  });

  it("refuse sous le minimum de blocs de faits", () => {
    const a = ville("alpha", "Alpha");
    const peu = { ...a, blocsFaits: a.blocsFaits.slice(0, BLOCS_FAITS_MIN - 1) };
    const v = evaluerPageVille("alpha", peu, []);
    expect(v.publiable).toBe(false);
    expect(v.raisons.join(" ")).toMatch(/blocs de faits/);
  });

  it("ne compte pas un bloc sans source, ni à source non publique (LLM)", () => {
    const a = ville("alpha", "Alpha");
    const sans = {
      ...a,
      blocsFaits: [
        a.blocsFaits[0]!,
        bloc("x", a.blocsFaits[1]!.texte, ""),
        bloc("y", a.blocsFaits[2]!.texte, "claude-knowledge:wikipedia-pretraining"),
      ],
    };
    const v = evaluerPageVille("alpha", sans, []);
    expect(v.publiable).toBe(false);
    expect(v.raisons.join(" ")).toMatch(/source/);
  });

  it("refuse deux villes qui ne diffèrent que par le nom", () => {
    const a = ville("alpha", "Alpha");
    const clone: ContenuVille = {
      ...a,
      slug: "beta",
      nom: "Beta",
      blocsFaits: a.blocsFaits.map((b) => ({ ...b, texte: b.texte.replaceAll("Alpha", "Beta") })),
      texteVisible: a.texteVisible.replaceAll("Alpha", "Beta"),
      exempleIa: a.exempleIa?.replaceAll("Alpha", "Beta"),
    };
    const v = evaluerPageVille("beta", clone, [a]);
    expect(v.publiable).toBe(false);
    expect(v.similariteMax).toBeGreaterThan(SEUIL_SIMILARITE_VILLES);
    expect(v.raisons.join(" ")).toMatch(/similarité/);
  });

  it("refuse un gabarit vide (texte vide, variable non remplacée, marqueur)", () => {
    const a = ville("alpha", "Alpha");
    for (const mauvais of [
      "",
      "   ",
      "{ville} accueille {secteur}",
      "TODO à compléter",
      "lorem ipsum dolor sit amet",
    ]) {
      const c = { ...a, blocsFaits: [bloc("vide", mauvais), ...a.blocsFaits] };
      const v = evaluerPageVille("alpha", c, []);
      expect(v.publiable, mauvais).toBe(false);
      expect(v.raisons.join(" "), mauvais).toMatch(/gabarit/);
    }
  });

  it("exige l'exemple concret d'usage de l'IA", () => {
    const a = ville("alpha", "Alpha", { exempleIa: undefined });
    const v = evaluerPageVille("alpha", a, []);
    expect(v.publiable).toBe(false);
    expect(v.raisons.join(" ")).toMatch(/exemple/);
  });

  it("applique la même règle à toutes les villes (aucun traitement par slug)", () => {
    const a = ville("grenoble", "Grenoble");
    const b = ville("autre", "Autre");
    expect(evaluerPageVille("grenoble", a, [b]).publiable).toBe(true);
    const peu = { ...a, blocsFaits: [] };
    expect(evaluerPageVille("grenoble", peu, [b]).publiable).toBe(false);
  });
});

describe("evaluerToutesLesVilles", () => {
  it("donne le même verdict que l'évaluation unitaire", () => {
    const a = ville("alpha", "Alpha");
    const b = ville("beta", "Beta");
    const c: ContenuVille = {
      ...a,
      slug: "gamma",
      nom: "Gamma",
      blocsFaits: a.blocsFaits.map((x) => ({ ...x, texte: x.texte.replaceAll("Alpha", "Gamma") })),
      texteVisible: a.texteVisible.replaceAll("Alpha", "Gamma"),
    };
    const tous = evaluerToutesLesVilles([a, b, c]);
    for (const x of [a, b, c]) {
      const unitaire = evaluerPageVille(
        x.slug,
        x,
        [a, b, c].filter((y) => y.slug !== x.slug),
      );
      expect(tous.get(x.slug)).toEqual(unitaire);
    }
    expect(tous.get("beta")?.publiable).toBe(true);
    expect(tous.get("alpha")?.publiable).toBe(false);
    expect(tous.get("gamma")?.publiable).toBe(false);
  });
});

describe("porteQualiteVilleActive", () => {
  it("est ÉTEINTE par défaut", () => {
    expect(porteQualiteVilleActive({})).toBe(false);
    expect(porteQualiteVilleActive({ VILLES_PORTE_QUALITE_ACTIVE: "" })).toBe(false);
    expect(porteQualiteVilleActive({ VILLES_PORTE_QUALITE_ACTIVE: "false" })).toBe(false);
    expect(porteQualiteVilleActive({ VILLES_PORTE_QUALITE_ACTIVE: "1" })).toBe(false);
  });
  it("ne s'allume que sur « true »", () => {
    expect(porteQualiteVilleActive({ VILLES_PORTE_QUALITE_ACTIVE: "true" })).toBe(true);
  });
});
