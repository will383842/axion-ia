import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { briefSchema, importerPlanEditorial } from "./brief";

const valide = {
  motCle: "service pilote IA",
  intention: "decision",
  requetesSecondaires: ["pilote ia pme"],
  champSemantique: ["pilote"],
  entites: ["PME"],
  questions: [
    { question: "Par où commencer ?", origine: "plan-editorial", reference: "plan n° 7" },
  ],
  urlCible: "https://axion-ia.com/fr/blog/service-pilote-ia",
  cluster: "/journee-ia",
  type: "neuf",
};

describe("briefSchema", () => {
  it("accepte un brief complet", () => {
    expect(briefSchema.safeParse(valide).success).toBe(true);
  });
  it("refuse une question sans origine", () => {
    const q = { question: "Par où commencer ?", reference: "x" };
    expect(briefSchema.safeParse({ ...valide, questions: [q] }).success).toBe(false);
  });
  it("refuse une origine inconnue ou une référence vide", () => {
    const base = { question: "Q ?", origine: "plan-editorial", reference: "x" };
    expect(
      briefSchema.safeParse({ ...valide, questions: [{ ...base, origine: "au-hasard" }] }).success,
    ).toBe(false);
    expect(
      briefSchema.safeParse({ ...valide, questions: [{ ...base, reference: " " }] }).success,
    ).toBe(false);
  });
  it("refuse un type ou une URL invalides", () => {
    expect(briefSchema.safeParse({ ...valide, type: "refonte" }).success).toBe(false);
    expect(briefSchema.safeParse({ ...valide, urlCible: "/fr/blog/x" }).success).toBe(false);
  });
});

describe("importerPlanEditorial", () => {
  const md = [
    "| n° | Question | Mot-clé | Intention | Angle | Persona | Type | Lien | Semaine |",
    "| --: | -- | -- | -- | -- | -- | -- | -- | --: |",
    "| 3 | « Interdire ou encadrer ? » | usage de l'IA non encadré | décision | a | p | `blog_from_title` | `/journee-ia` | S2 |",
    "| 4 | « Notes de frais ? » | automatiser les notes de frais | information | a | p | `blog_from_title` | `/demande-devis` | S2 |",
    "| 5 | incomplète | seulement | |",
  ].join("\n");

  it("transforme les lignes en briefs et écarte les invalides", () => {
    const { briefs, rejets } = importerPlanEditorial(md);
    expect(briefs).toHaveLength(2);
    expect(briefs[0]).toMatchObject({
      motCle: "usage de l'IA non encadré",
      intention: "decision",
      cluster: "/journee-ia",
      type: "neuf",
      urlCible: "https://axion-ia.com/fr/blog/usage-de-l-ia-non-encadre",
      questions: [
        { question: "Interdire ou encadrer ?", origine: "plan-editorial", reference: "plan n° 3" },
      ],
    });
    expect(rejets).toEqual([{ ligne: 5, raison: "colonnes manquantes" }]);
  });

  it("lit les 40 articles du plan du dépôt", () => {
    const plan = readFileSync(
      resolve(process.cwd(), "docs/contenu/plan-editorial-journee-ia-2026-11.md"),
      "utf8",
    );
    const { briefs, rejets } = importerPlanEditorial(plan);
    expect(rejets).toEqual([]);
    expect(briefs).toHaveLength(40);
    expect(new Set(briefs.map((b) => b.urlCible)).size).toBe(40);
  });
});

// ── C3 : extension du brief (champs nullables de la chaîne éditoriale) ──────
import {
  planTitresSchema,
  STATUTS_BESOIN,
  STATUTS_BRIEF,
  STATUTS_PROPOSITION,
  FOURCHETTE_LONGUEUR_MAX_MOTS,
} from "./brief";

describe("briefSchema étendu (C3)", () => {
  it("reste valide sans aucun des nouveaux champs (compatibilité)", () => {
    expect(briefSchema.safeParse(valide).success).toBe(true);
  });
  it("accepte intention de recherche, plan de titres et fourchette de longueur", () => {
    const r = briefSchema.safeParse({
      ...valide,
      intentionRecherche: "comparaison",
      planTitres: [
        { niveau: 1, titre: "Pilote IA en PME" },
        { niveau: 2, titre: "Par où commencer ?" },
        { niveau: 3, titre: "Choisir un cas d'usage" },
      ],
      longueurMinMots: 900,
      longueurMaxMots: 1800,
    });
    expect(r.success).toBe(true);
  });
  it("accepte des champs explicitement nuls", () => {
    const r = briefSchema.safeParse({
      ...valide,
      intentionRecherche: null,
      planTitres: null,
      longueurMinMots: null,
      longueurMaxMots: null,
    });
    expect(r.success).toBe(true);
  });
  it("refuse un niveau de titre hors H1-H3, une intention inconnue, une fourchette inversée", () => {
    expect(planTitresSchema.safeParse([{ niveau: 4, titre: "x" }]).success).toBe(false);
    expect(briefSchema.safeParse({ ...valide, intentionRecherche: "achat" }).success).toBe(false);
    expect(
      briefSchema.safeParse({ ...valide, longueurMinMots: 2000, longueurMaxMots: 1000 }).success,
    ).toBe(false);
    expect(
      briefSchema.safeParse({ ...valide, longueurMaxMots: FOURCHETTE_LONGUEUR_MAX_MOTS + 1 })
        .success,
    ).toBe(false);
  });
  it("expose les statuts de la chaîne (texte en base, aucune énumération Postgres)", () => {
    expect(STATUTS_BESOIN).toEqual(["nouveau", "en_brief", "couvert", "ecarte"]);
    expect(STATUTS_BRIEF).toContain("abandonne");
    expect(STATUTS_PROPOSITION).toEqual(["a_relire", "appliquee", "refusee", "reportee"]);
  });
});
