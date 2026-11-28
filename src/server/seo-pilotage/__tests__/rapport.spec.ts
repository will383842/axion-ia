import { describe, expect, it } from "vitest";
import {
  PLANCHER_IMPRESSIONS_28J,
  ajouterSectionAuCourriel,
  construireSectionPilotage,
  type DonneesRapport,
} from "../rapport";

const base: DonneesRapport = {
  fin: "2026-11-23",
  courante: { clics: 120, impressions: 4000, positionSum: 40000, pages: 80, joursMesures: 7 },
  precedente: { clics: 100, impressions: 5000, positionSum: 55000, pages: 70, joursMesures: 7 },
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

  it("5 chiffres clés, taux de clics compris, et date en français", () => {
    const s = construireSectionPilotage({ etat: "ok", donnees: base });
    expect(s?.text).toContain("Taux de clics : 3,0 %");
    expect(s?.text).toContain("23/11/2026");
  });

  it("fenêtre courante incomplète : aucun chiffre, le nombre de jours est annoncé", () => {
    const s = construireSectionPilotage({
      etat: "ok",
      donnees: { ...base, courante: { ...base.courante!, joursMesures: 3 } },
    });
    expect(s?.text).toContain("3 jour(s) mesuré(s) sur 7");
    expect(s?.text).not.toContain("Clics :");
  });

  it("semaine précédente incomplète : pas de pourcentage inventé", () => {
    const s = construireSectionPilotage({
      etat: "ok",
      donnees: { ...base, precedente: { ...base.precedente!, joursMesures: 2 } },
    });
    expect(s?.text).toContain("Clics : 120 (—) — semaine précédente incomplète");
  });

  it("dit ce qui n'est pas encore mesuré", () => {
    expect(construireSectionPilotage({ etat: "ok", donnees: base })?.text).toContain(
      "Pas encore mesuré",
    );
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
      detecteur: "a",
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
      detecteur: "e",
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

describe("ajouterSectionAuCourriel", () => {
  const courriel = {
    subject: "S",
    html: '<body><table></table><p style="margin-top:30px;font-size:12px;color:#999">pied</p></body>',
    text: "texte",
  };
  it("section absente : courriel identique", () => {
    expect(ajouterSectionAuCourriel(courriel, null)).toEqual(courriel);
  });
  it("section présente : insérée avant le pied, texte à la suite", () => {
    const section = construireSectionPilotage({ etat: "indisponible" });
    const r = ajouterSectionAuCourriel(courriel, section);
    expect(r.html.indexOf("Pilotage SEO")).toBeLessThan(r.html.indexOf("pied"));
    expect(r.text.startsWith("texte\n\n")).toBe(true);
    expect(r.subject).toBe("S");
  });
});
