import { describe, expect, it } from "vitest";
import {
  PLANCHER_IMPRESSIONS_28J,
  construireSectionPilotage,
  type DonneesRapport,
} from "../rapport";

const base: DonneesRapport = {
  fin: "2026-11-23",
  courante: { clics: 120, impressions: 4000, positionSum: 40000, pages: 80 },
  precedente: { clics: 100, impressions: 5000, positionSum: 55000, pages: 70 },
  opportunites: [],
  sourcesIndisponibles: [],
};

describe("construireSectionPilotage", () => {
  it("pilotage éteint : la section est absente", () => {
    expect(construireSectionPilotage({ etat: "eteint" })).toBeNull();
  });

  it("source indisponible : la phrase l'annonce, sans chiffre inventé", () => {
    const s = construireSectionPilotage({ etat: "indisponible" });
    expect(s?.text).toMatch(/indisponible/i);
    expect(s?.text).not.toMatch(/\b0\b/);
  });

  it("donne les chiffres clés et leur évolution", () => {
    const s = construireSectionPilotage({ etat: "ok", donnees: base });
    expect(s?.text).toContain("Clics : 120 (+20 %)");
    expect(s?.text).toContain("Affichages : 4000 (-20 %)");
    expect(s?.text).toContain("Position moyenne dans Google : 10,0");
    expect(s?.html).toContain("Pilotage");
  });

  it("sans période précédente : évolution « — », jamais 0 %", () => {
    const s = construireSectionPilotage({
      etat: "ok",
      donnees: { ...base, precedente: null },
    });
    expect(s?.text).toContain("Clics : 120 (—)");
  });

  it("sans aucune donnée : dit qu'il n'y en a pas encore", () => {
    const s = construireSectionPilotage({
      etat: "ok",
      donnees: { ...base, courante: null, precedente: null, fin: null },
    });
    expect(s?.text).toMatch(/pas encore de données/i);
  });

  it("ne cite aucune requête sous le plancher de 30 affichages sur 28 jours", () => {
    const opp = (requete: string, impressions28j: number | null) => ({
      detecteur: "quasi_gagnante",
      cible: "/fr/guide",
      priorite: 5,
      requete,
      impressions28j,
    });
    const s = construireSectionPilotage({
      etat: "ok",
      donnees: {
        ...base,
        opportunites: [
          opp("requête visible", PLANCHER_IMPRESSIONS_28J),
          opp("requête rare", PLANCHER_IMPRESSIONS_28J - 1),
          opp("requête inconnue", null),
        ],
      },
    });
    expect(s?.text).toContain("requête visible");
    expect(s?.text).not.toContain("requête rare");
    expect(s?.text).not.toContain("requête inconnue");
    expect(s?.html).not.toContain("requête rare");
  });

  it("garde 5 opportunités au plus, par priorité décroissante", () => {
    const opportunites = Array.from({ length: 8 }, (_, i) => ({
      detecteur: "declin",
      cible: `/fr/p${i}`,
      priorite: i,
      requete: null,
      impressions28j: null,
    }));
    const s = construireSectionPilotage({ etat: "ok", donnees: { ...base, opportunites } });
    expect(s?.text).toContain("/fr/p7");
    expect(s?.text).toContain("/fr/p3");
    expect(s?.text).not.toContain("/fr/p2");
  });

  it("liste les sources indisponibles et échappe le HTML", () => {
    const s = construireSectionPilotage({
      etat: "ok",
      donnees: { ...base, sourcesIndisponibles: ["Search Console <b>"] },
    });
    expect(s?.text).toContain("Search Console <b>");
    expect(s?.html).toContain("Search Console &lt;b&gt;");
  });
});
