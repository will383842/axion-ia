import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ModeleActif } from "@/server/seo-pilotage/ecran/modele";
import { PilotageV2 } from "../_v2/PilotageV2";

const base: ModeleActif = {
  etat: "actif",
  mode: "observation",
  source: {
    etat: "disponible",
    donneesJusquAu: "2026-11-25",
    explication: "Les données arrivent.",
  },
  donneesJusquAu: "2026-11-25",
  vue: [
    {
      typePage: "article",
      clics: 12,
      impressions: 400,
      position: 8,
      ctr: 0.03,
      variationClics: 20,
      variationImpressions: -20,
      positionPrecedente: 10,
    },
  ],
  pages: [{ chemin: "/fr/blog/x", typePage: "article", clics: 12, impressions: 400, position: 8 }],
  requetes: [
    {
      requete: "formation ia lyon",
      intention: "locale",
      impressions: 140,
      clics: 6,
      position: 7.7,
      pageProprietaire: "/fr/a",
      nbPages: 2,
      cannibalisation: true,
    },
  ],
  opportunites: [
    {
      id: "o1",
      detecteur: "a",
      cible: "/fr/blog/x",
      typePage: "article",
      priorite: 42,
      motif: "Page proche de la première page",
      signalement: false,
    },
    {
      id: "o2",
      detecteur: "d",
      cible: "/fr/blog/y",
      typePage: "article",
      priorite: 10,
      motif: "Deux pages se disputent la requête",
      signalement: true,
    },
  ],
  imports: [
    {
      jour: "2026-11-25",
      statut: "reussi",
      nbLignesPage: 80,
      nbLignesRequete: 300,
      tentatives: 1,
      erreurCode: null,
    },
  ],
};

const rendre = (modele: Parameters<typeof PilotageV2>[0]["modele"], onglet?: string) =>
  renderToStaticMarkup(<PilotageV2 modele={modele} adminPrefix="admin" onglet={onglet} />);

describe("PilotageV2", () => {
  it("pilotage éteint : l'écrit, sans onglets de données", () => {
    const html = rendre({ etat: "eteint" });
    expect(html).toContain("Pilotage éteint");
    expect(html).not.toContain("Vue d&#x27;ensemble");
  });

  it("vue d'ensemble : date des données, types de page, évolution en mots simples", () => {
    const html = rendre(base);
    expect(html).toContain("Données jusqu&#x27;au 25/11");
    expect(html).toContain("Articles");
    expect(html).toContain("+20");
    expect(html).toContain("Mode observation");
  });

  it("source ou section indisponible : « indisponible », jamais 0", () => {
    const html = rendre({
      ...base,
      source: { etat: "indisponible", donneesJusquAu: null, explication: "Aucun import." },
      donneesJusquAu: null,
      vue: null,
      pages: null,
      requetes: null,
      opportunites: null,
      imports: null,
    });
    expect(html).toContain("indisponible");
    expect(html).not.toContain("Données jusqu");
    expect(html).not.toMatch(/>0</);
    for (const onglet of ["pages", "requetes", "opportunites", "sante"]) {
      const h = rendre(
        { ...base, vue: null, pages: null, requetes: null, opportunites: null, imports: null },
        onglet,
      );
      expect(h).toContain("indisponible");
      expect(h).not.toMatch(/>0</);
    }
  });

  it("requêtes : intention en français et cannibalisation signalée", () => {
    const html = rendre(base, "requetes");
    expect(html).toContain("formation ia lyon");
    expect(html).toContain("Locale");
    expect(html).toContain("Plusieurs pages");
  });

  it("opportunités : les signalements sont à part", () => {
    const html = rendre(base, "opportunites");
    expect(html).toContain("Page proche de la première page");
    expect(html).toContain("À décider par une personne");
    expect(html.indexOf("Page proche")).toBeLessThan(html.indexOf("À décider par une personne"));
    expect(html.indexOf("À décider par une personne")).toBeLessThan(
      html.indexOf("Deux pages se disputent"),
    );
  });

  it("santé : derniers imports et erreurs", () => {
    const html = rendre(
      {
        ...base,
        imports: [
          { ...base.imports![0]!, statut: "echec", erreurCode: "quota", jour: "2026-11-24" },
        ],
      },
      "sante",
    );
    expect(html).toContain("24/11/2026");
    expect(html).toContain("quota");
  });

  it("onglet inconnu : retombe sur la vue d'ensemble", () => {
    expect(rendre(base, "n-importe-quoi")).toContain("Articles");
  });

  it("aucun « Grenoble » dans l'écran", () => {
    expect(rendre(base).toLowerCase()).not.toContain("grenoble");
  });
});
