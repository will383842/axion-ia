import { describe, expect, it } from "vitest";
import { construireCarteMotsCles } from "../carte";
import type { LigneRequete } from "../../opportunites/types";

const B = "https://axion-ia.com/fr";

function l(p: Partial<LigneRequete>): LigneRequete {
  return {
    requete: "formation ia pme",
    url: `${B}/blog/a`,
    typePage: "article",
    position: 8,
    impressions: 200,
    clics: 5,
    semainesPresentes: 4,
    ...p,
  };
}

describe("carte des mots-clés : une page principale par recherche", () => {
  it("une seule page sur la requête : propriétaire unique, aucun rapprochement", () => {
    const r = construireCarteMotsCles([l({})]);
    expect(r.entrees).toHaveLength(1);
    expect(r.entrees[0]).toMatchObject({
      statut: "unique",
      proprietaire: `${B}/blog/a`,
      concurrentes: [],
    });
    expect(r.rapprochements).toHaveLength(0);
  });

  it("deux pages significatives : une propriétaire (la plus vue), l'autre est rapprochée par lien interne", () => {
    const r = construireCarteMotsCles([
      l({ url: `${B}/blog/a`, impressions: 300 }),
      l({ url: `${B}/blog/b`, impressions: 150 }),
    ]);
    expect(r.entrees[0]).toMatchObject({ statut: "concurrence", proprietaire: `${B}/blog/a` });
    expect(r.rapprochements).toEqual([
      expect.objectContaining({
        requete: expect.any(String),
        proprietaire: `${B}/blog/a`,
        concurrente: `${B}/blog/b`,
        action: "lien_interne",
        fusionAEtudier: true,
      }),
    ]);
  });

  it("une page marginale (< 20 % des impressions) ne compte pas comme concurrente", () => {
    const r = construireCarteMotsCles([
      l({ url: `${B}/blog/a`, impressions: 400 }),
      l({ url: `${B}/blog/b`, impressions: 10 }),
    ]);
    expect(r.entrees[0]!.statut).toBe("unique");
    expect(r.rapprochements).toHaveLength(0);
  });

  it("le plan éditorial désigne le propriétaire, même s'il est moins vu", () => {
    const r = construireCarteMotsCles(
      [l({ url: `${B}/blog/a`, impressions: 300 }), l({ url: `${B}/blog/b`, impressions: 150 })],
      { plan: [{ requete: "formation IA PME", url: `${B}/blog/b/` }] },
    );
    expect(r.entrees[0]).toMatchObject({ proprietaire: `${B}/blog/b`, raison: "plan" });
    expect(r.rapprochements[0]).toMatchObject({ concurrente: `${B}/blog/a` });
  });

  it("même règle que construireCarte : meilleure position parmi les pages significatives", () => {
    const r = construireCarteMotsCles([
      l({ url: `${B}/blog/a`, impressions: 300, position: 9 }),
      l({ url: `${B}/blog/b`, impressions: 200, position: 4 }),
    ]);
    expect(r.entrees[0]).toMatchObject({ proprietaire: `${B}/blog/b`, raison: "mesure" });
  });

  it("une page à peine vue ne devient pas propriétaire, même du type attendu ; le manque est signalé", () => {
    const r = construireCarteMotsCles([
      l({ requete: "formation ia pme prix", url: `${B}/blog/x`, impressions: 900, position: 9 }),
      l({
        requete: "formation ia pme prix",
        url: `${B}/formations/ia`,
        typePage: "offre",
        impressions: 1,
        position: 2,
      }),
    ]);
    expect(r.entrees[0]!.intention).toBe("transactionnelle");
    expect(r.entrees[0]).toMatchObject({ proprietaire: `${B}/blog/x`, typeAttenduAbsent: true });
    expect(r.rapprochements).toHaveLength(0);
    const r2 = construireCarteMotsCles([
      l({ requete: "formation ia pme prix", url: `${B}/blog/x`, impressions: 900 }),
    ]);
    expect(r2.entrees[0]!.typeAttenduAbsent).toBe(true);
  });

  it("entre 30 et 100 impressions : pas de verdict « unique »", () => {
    const r = construireCarteMotsCles([
      l({ url: `${B}/blog/a`, impressions: 45 }),
      l({ url: `${B}/blog/b`, impressions: 45 }),
    ]);
    expect(r.entrees[0]!.statut).toBe("trop_peu_de_donnees");
    expect(r.rapprochements).toHaveLength(0);
  });

  it("une URL « grenoble » du plan est écartée", () => {
    const r = construireCarteMotsCles([l({})], {
      plan: [{ requete: "formation ia pme", url: `${B}/blog/grenoble-ia` }],
    });
    expect(JSON.stringify(r)).not.toMatch(/grenoble/i);
  });

  it("déterminisme : type de page en conflit sur une URL normalisée et doublons du plan", () => {
    const lignes = [
      l({ url: `${B}/blog/b/`, typePage: "offre", impressions: 100, position: 5 }),
      l({ url: `${B}/blog/b`, typePage: "article", impressions: 100, position: 5 }),
      l({ url: `${B}/blog/a`, impressions: 150, position: 5 }),
    ];
    const plan = [
      { requete: "formation ia pme", url: `${B}/blog/z` },
      { requete: "pme formation IA", url: `${B}/blog/y` },
    ];
    expect(construireCarteMotsCles(lignes, { plan })).toEqual(
      construireCarteMotsCles([...lignes].reverse(), { plan: [...plan].reverse() }),
    );
    expect(construireCarteMotsCles(lignes, { plan }).entrees[0]!.proprietaire).toBe(`${B}/blog/y`);
  });

  it("l'ordre des mots ne crée pas deux requêtes ; casse et accents sont ignorés", () => {
    const r = construireCarteMotsCles([
      l({ requete: "Formation IA PME", url: `${B}/blog/a`, impressions: 300 }),
      l({ requete: "pme formation ia", url: `${B}/blog/b`, impressions: 300 }),
    ]);
    expect(r.entrees).toHaveLength(1);
    expect(r.entrees[0]!.concurrentes).toHaveLength(1);
  });

  it("sous le plancher d'impressions : « trop_peu_de_donnees », pas de rapprochement", () => {
    const r = construireCarteMotsCles([
      l({ url: `${B}/blog/a`, impressions: 10 }),
      l({ url: `${B}/blog/b`, impressions: 8 }),
    ]);
    expect(r.entrees[0]!.statut).toBe("trop_peu_de_donnees");
    expect(r.rapprochements).toHaveLength(0);
  });

  it("une page protégée n'est devient un signalement seul, sans action", () => {
    const r = construireCarteMotsCles([
      l({ url: `${B}/blog/a`, impressions: 300 }),
      l({ url: `${B}/tarifs`, typePage: "offre", impressions: 150 }),
    ]);
    const rap = r.rapprochements.find((x) => x.concurrente === `${B}/tarifs`);
    expect(rap).toMatchObject({ protegee: true, action: "signalement_seul" });
  });

  it("écarte marque, « grenoble » et interdits de publication", () => {
    const r = construireCarteMotsCles([
      l({ requete: "axionia" }),
      l({ requete: "formation ia grenoble" }),
      l({ requete: "formation ia qualiopi" }),
      l({ requete: "formation ia pme" }),
    ]);
    expect(r.entrees.map((e) => e.exemple)).toEqual(["formation ia pme"]);
  });

  it("aucune sortie ne propose de changer d'URL, et la sortie est déterministe", () => {
    const lignes = [
      l({ url: `${B}/blog/a`, impressions: 300 }),
      l({ url: `${B}/blog/b`, impressions: 300 }),
    ];
    const a = construireCarteMotsCles(lignes);
    const b = construireCarteMotsCles([...lignes].reverse());
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toMatch(/nouvelleUrl|changer_url|redirect/i);
  });

  it("agrège les lignes d'une même page (URL avec barre finale ou ancre) avant de comparer", () => {
    const r = construireCarteMotsCles([
      l({ url: `${B}/blog/a`, impressions: 100, position: 4 }),
      l({ url: `${B}/blog/a/`, impressions: 100, position: 10 }),
    ]);
    expect(r.entrees[0]).toMatchObject({ statut: "unique", impressions: 200 });
  });
});
