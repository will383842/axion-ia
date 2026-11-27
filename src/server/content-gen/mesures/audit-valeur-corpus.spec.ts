import { describe, expect, it } from "vitest";
import {
  auditerCorpus,
  cleUrl,
  empreintePlan,
  extraireH2,
  jaccard,
  type PageCorpus,
} from "./audit-valeur-corpus";

const NOW = new Date("2026-11-27T00:00:00Z");
const ancien = new Date("2026-06-01T00:00:00Z");
const recent = new Date("2026-11-20T00:00:00Z");

function page(p: Partial<PageCorpus> & { id: string }): PageCorpus {
  return {
    type: "article",
    url: `https://axion-ia.com/fr/blog/${p.id}`,
    titre: p.id,
    mots: 1200,
    qualityScore: 80,
    publieLe: ancien,
    plan: [],
    impressions: 10,
    ...p,
  };
}

const planA = ["Definition", "Les cas d'usage", "Les risques", "Le cout", "La mise en oeuvre"];

describe("extraireH2", () => {
  it("lit les H2 et retire les balises internes", () => {
    expect(
      extraireH2("<h2>Un <em>titre</em></h2><p>x</p><H2 id='a'>Deux&nbsp;</H2><h3>non</h3>"),
    ).toEqual(["Un titre", "Deux"]);
  });
});

describe("jaccard / empreintePlan", () => {
  it("ignore casse, accents et mots variables", () => {
    const a = empreintePlan(["Pourquoi à Lyon ?", "Le coût"], ["Lyon"]);
    const b = empreintePlan(["pourquoi à Nantes ?", "Le cout"], ["Nantes"]);
    expect(jaccard(a, b)).toBe(1);
  });
  it("deux ensembles vides : 0, pas de NaN", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe("auditerCorpus", () => {
  it("signale faible valeur (mots ou score) avec un motif lisible", () => {
    const r = auditerCorpus(
      [page({ id: "a", mots: 200 }), page({ id: "b", qualityScore: 40 }), page({ id: "c" })],
      NOW,
    );
    const fv = r.signalements.filter((s) => s.famille === "faible-valeur");
    expect(fv.map((s) => s.id).sort()).toEqual(["a", "b"]);
    expect(fv[0]?.motif).toMatch(/mots|score/);
  });

  it("la page ville a un seuil de mots propre", () => {
    const r = auditerCorpus([page({ id: "v", type: "page-ville", mots: 400 })], NOW);
    expect(r.parFamille["faible-valeur"]).toBe(0);
  });

  it("sans impressions : seulement si 0 impression, assez ancienne et Search Console répond", () => {
    const r = auditerCorpus(
      [
        page({ id: "zero", impressions: 0 }),
        page({ id: "jeune", impressions: 0, publieLe: recent }),
        page({ id: "vue", impressions: 3 }),
        page({ id: "sansdate", impressions: 0, publieLe: null }),
      ],
      NOW,
    );
    expect(r.signalements.filter((s) => s.famille === "sans-impressions").map((s) => s.id)).toEqual(
      ["zero"],
    );
  });

  it("page ville sans date et sans mots : seul « sans impressions » peut la signaler", () => {
    const r = auditerCorpus(
      [
        page({
          id: "v",
          type: "page-ville",
          mots: null,
          qualityScore: null,
          publieLe: null,
          impressions: 0,
        }),
      ],
      NOW,
    );
    expect(r.signalements.map((s) => s.famille)).toEqual(["sans-impressions"]);
  });

  it("Search Console muette : jamais de « sans impressions », et le rapport le dit", () => {
    const r = auditerCorpus([page({ id: "a", impressions: null })], NOW);
    expect(r.impressionsDisponibles).toBe(false);
    expect(r.parFamille["sans-impressions"]).toBe(0);
  });

  it("doublons de plan : grappe de plans identiques, jamais article contre page ville", () => {
    const r = auditerCorpus(
      [
        page({ id: "a1", plan: planA }),
        page({ id: "a2", plan: [...planA] }),
        page({ id: "a3", plan: ["Tout", "Autre", "Chose", "Complete", "Ment"] }),
        page({ id: "v1", type: "page-ville", plan: planA }),
      ],
      NOW,
    );
    expect(r.grappes).toHaveLength(1);
    expect(r.grappes[0]?.pages.map((p) => p.id)).toEqual(["a1", "a2"]);
    expect(r.parFamille["doublon-de-plan"]).toBe(2);
  });

  it("pages villes : le nom de la ville ne masque pas le doublon", () => {
    const q = (v: string) => [
      `Pourquoi ${v} ?`,
      `Prix à ${v}`,
      `Délais à ${v}`,
      `Financement à ${v}`,
    ];
    const r = auditerCorpus(
      [
        page({ id: "l", type: "page-ville", plan: q("Lyon"), motsVariables: ["Lyon"] }),
        page({ id: "n", type: "page-ville", plan: q("Nantes"), motsVariables: ["Nantes"] }),
      ],
      NOW,
    );
    expect(r.grappes).toHaveLength(1);
    expect(r.signalements[0]?.motif).toMatch(/gabarit/);
  });

  it("un plan trop court n'est pas comparé", () => {
    const r = auditerCorpus(
      [page({ id: "a", plan: ["Un", "Deux"] }), page({ id: "b", plan: ["Un", "Deux"] })],
      NOW,
    );
    expect(r.grappes).toHaveLength(0);
  });

  it("n'expose aucune action : un signalement ne porte que de l'information", () => {
    const r = auditerCorpus([page({ id: "a", mots: 10 })], NOW);
    const cles = Object.keys(r.signalements[0] ?? {});
    expect(cles.sort()).toEqual(["famille", "id", "motif", "titre", "type", "url"]);
  });
});

describe("cleUrl", () => {
  it("ignore barre finale et casse", () => {
    expect(cleUrl("https://Axion-IA.com/fr/blog/x/")).toBe(
      cleUrl("https://axion-ia.com/fr/blog/x"),
    );
  });
});

describe("pages noindex", () => {
  it("jamais signalées « sans impressions », même avec 0 impression", () => {
    const r = auditerCorpus(
      [
        page({ id: "noindex", impressions: 0, indexable: false }),
        page({ id: "indexe", impressions: 0 }),
      ],
      NOW,
    );
    const ids = r.signalements.filter((s) => s.famille === "sans-impressions").map((s) => s.id);
    expect(ids).toEqual(["indexe"]);
  });
  it("Search Console disponible s'apprécie sur les pages indexables seulement", () => {
    const r = auditerCorpus([page({ id: "noindex", impressions: 0, indexable: false })], NOW);
    expect(r.impressionsDisponibles).toBe(false);
  });
});
