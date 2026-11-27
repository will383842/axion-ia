import { describe, expect, it } from "vitest";
import {
  detecterCannibalisation,
  detecterCtrAnormal,
  detecterDeclin,
  detecterJamaisAffichee,
  detecterQuasiGagnante,
  detecterRequeteSansPage,
} from "../detecteurs";
import { construireCourbeCtr } from "../courbe-ctr";
import type { LigneRequete } from "../types";

const U = "https://axion-ia.com/fr/blog/x";
function l(p: Partial<LigneRequete> & { position: number }): LigneRequete {
  return {
    requete: "formation ia pme",
    url: U,
    typePage: "article",
    impressions: 200,
    clics: 10,
    semainesPresentes: 4,
    ...p,
  };
}
const proprio = () => U;

describe("a · quasi-gagnante : bornes 4,9 / 5 / 20 / 20,1", () => {
  const run = (position: number) =>
    detecterQuasiGagnante([l({ position })], { proprietaire: proprio });
  it("4,9 : non", () => expect(run(4.9)).toHaveLength(0));
  it("5 : oui, titre/méta", () => expect(run(5).map((p) => p.action)).toContain("titre_meta"));
  it("10 : titre/méta ; 11 : mise à jour", () => {
    expect(run(10).map((p) => p.action)).toContain("titre_meta");
    expect(run(11).map((p) => p.action)).toContain("mise_a_jour");
    expect(run(11).map((p) => p.action)).not.toContain("titre_meta");
  });
  it("20 : oui", () => expect(run(20).length).toBeGreaterThan(0));
  it("20,1 : non", () => expect(run(20.1)).toHaveLength(0));
  it("moins de 100 impressions : non", () =>
    expect(
      detecterQuasiGagnante([l({ position: 8, impressions: 99 })], { proprietaire: proprio }),
    ).toHaveLength(0));
  it("page non propriétaire : non", () =>
    expect(
      detecterQuasiGagnante([l({ position: 8 })], {
        proprietaire: () => "https://axion-ia.com/fr/autre",
      }),
    ).toHaveLength(0));
  it("plancher par requête : 29 impressions ou 2 semaines : non", () => {
    expect(
      detecterQuasiGagnante([l({ position: 8, semainesPresentes: 2 })], { proprietaire: proprio }),
    ).toHaveLength(0);
  });
  it("question : ajoute la FAQ", () =>
    expect(
      detecterQuasiGagnante([l({ position: 8, requete: "comment former mon equipe a l ia" })], {
        proprietaire: proprio,
      }).map((p) => p.action),
    ).toContain("faq"));
});

describe("b · CTR anormal", () => {
  const courbe = construireCourbeCtr(
    [1, 3, 6, 9].map((position, i) =>
      l({ requete: `r${i}`, position, impressions: 2000, clics: [600, 200, 100, 40][i]! }),
    ),
  );
  it("en veille sans courbe", () => {
    expect(
      detecterCtrAnormal([l({ position: 3, clics: 0, impressions: 500 })], { courbe: null }),
    ).toEqual([]);
  });
  it("signale un CTR très inférieur au site", () => {
    const r = detecterCtrAnormal([l({ position: 3, clics: 2, impressions: 1000 })], { courbe });
    expect(r).toHaveLength(1);
    expect(r[0]!.action).toBe("titre_meta");
  });
  it("0 clic sur 40 : non signalé (sous 200 impressions)", () => {
    expect(detecterCtrAnormal([l({ position: 3, clics: 0, impressions: 40 })], { courbe })).toEqual(
      [],
    );
  });
  it("CTR normal : non", () => {
    expect(
      detecterCtrAnormal([l({ position: 3, clics: 200, impressions: 1000 })], { courbe }),
    ).toEqual([]);
  });
  it("marque exclue", () => {
    expect(
      detecterCtrAnormal([l({ requete: "axion ia", position: 3, clics: 0, impressions: 1000 })], {
        courbe,
      }),
    ).toEqual([]);
  });
});

describe("c · requête sans page dédiée", () => {
  it("brief de nouvelle page quand aucune page cible n'existe", () => {
    const r = detecterRequeteSansPage(
      [
        l({
          requete: "tarif formation ia lyon",
          position: 12,
          typePage: "article",
          impressions: 80,
        }),
      ],
      { trouverPageCible: () => null },
    );
    expect(r[0]).toMatchObject({ action: "nouvelle_page", detecteur: "c" });
  });
  it("lien interne quand la bonne page existe", () => {
    const r = detecterRequeteSansPage(
      [l({ requete: "tarif formation ia", position: 12, typePage: "article", impressions: 80 })],
      { trouverPageCible: () => "https://axion-ia.com/fr/tarifs" },
    );
    expect(r[0]).toMatchObject({
      action: "lien_interne",
      pageCible: "https://axion-ia.com/fr/tarifs",
    });
  });
  it("type conforme, trop peu d'impressions ou position > 30 : rien", () => {
    const o = { trouverPageCible: () => null };
    expect(
      detecterRequeteSansPage(
        [l({ requete: "tarif formation ia", position: 5, typePage: "offre" })],
        o,
      ),
    ).toEqual([]);
    expect(
      detecterRequeteSansPage(
        [l({ requete: "tarif formation ia", position: 5, impressions: 49 })],
        o,
      ),
    ).toEqual([]);
    expect(
      detecterRequeteSansPage([l({ requete: "tarif formation ia", position: 31 })], o),
    ).toEqual([]);
  });
});

describe("d · cannibalisation", () => {
  const A = "https://axion-ia.com/fr/blog/a";
  const B = "https://axion-ia.com/fr/blog/b";
  const h = (bascules: number, ia = 60, ib = 60) => ({
    requete: "agent ia",
    bascules,
    urls: [
      { url: A, impressions: ia },
      { url: B, impressions: ib },
    ],
  });
  it("2 URL ≥ 20 %, 3 bascules, ≥ 100 impressions : lien interne vers le propriétaire + signalement de fusion", () => {
    const r = detecterCannibalisation([h(3)], { proprietaire: () => A });
    expect(r.propositions[0]).toMatchObject({ action: "lien_interne", url: B, pageCible: A });
    expect(r.signalements[0]).toMatchObject({ kind: "fusion" });
  });
  it("2 bascules : alternance insuffisante", () => {
    expect(detecterCannibalisation([h(2)], { proprietaire: () => A }).propositions).toEqual([]);
  });
  it("une URL sous 20 % : non", () => {
    expect(detecterCannibalisation([h(5, 90, 10)], { proprietaire: () => A }).propositions).toEqual(
      [],
    );
  });
  it("moins de 100 impressions : non", () => {
    expect(detecterCannibalisation([h(5, 40, 40)], { proprietaire: () => A }).propositions).toEqual(
      [],
    );
  });
});

describe("e · déclin", () => {
  const p = (o: object) => ({
    url: U,
    clics: 60,
    clicsPrecedents: 100,
    position: 5,
    positionPrecedente: 5,
    ...o,
  });
  const site = { clics: 1000, clicsPrecedents: 1000 };
  it("position stable : demande en baisse, aucune action", () => {
    expect(detecterDeclin([p({})], { site }).propositions).toEqual([]);
  });
  it("position dégradée : mise à jour", () => {
    const r = detecterDeclin([p({ position: 8 })], { site });
    expect(r.propositions[0]).toMatchObject({ action: "mise_a_jour", detecteur: "e" });
  });
  it("moins de 20 clics perdus : non", () => {
    expect(
      detecterDeclin([p({ clics: 8, clicsPrecedents: 15, position: 9 })], { site }).propositions,
    ).toEqual([]);
  });
  it("normalisé par la tendance du site", () => {
    const baisseSite = { clics: 600, clicsPrecedents: 1000 };
    expect(detecterDeclin([p({ position: 8 })], { site: baisseSite }).propositions).toEqual([]);
  });
  it("saisonnalité absorbée par N−1", () => {
    expect(
      detecterDeclin(
        [p({ position: 8, clicsAnneePrecedente: 60, clicsAnneePrecedentePrecedents: 100 })],
        { site },
      ).propositions,
    ).toEqual([]);
  });
  it("N−1 sans baisse : le déclin reste signalé", () => {
    expect(
      detecterDeclin(
        [p({ position: 8, clicsAnneePrecedente: 100, clicsAnneePrecedentePrecedents: 100 })],
        { site },
      ).propositions,
    ).toHaveLength(1);
  });
});

describe("f · jamais affichée", () => {
  const v = (o: object) => ({
    url: U,
    typePage: "article" as const,
    ageJours: 60,
    impressions90j: 0,
    ...o,
  });
  it("page de plus de 45 j sans impression : inspection + signalement", () => {
    const r = detecterJamaisAffichee([v({})]);
    expect(r.propositions[0]).toMatchObject({ action: "inspection", detecteur: "f" });
    expect(r.signalements[0]).toMatchObject({ kind: "noindex_ou_fusion" });
  });
  it("45 j pile, impressions, legal, conversion : rien", () => {
    expect(detecterJamaisAffichee([v({ ageJours: 45 })]).propositions).toEqual([]);
    expect(detecterJamaisAffichee([v({ impressions90j: 1 })]).propositions).toEqual([]);
    expect(detecterJamaisAffichee([v({ typePage: "legal" })]).propositions).toEqual([]);
    expect(detecterJamaisAffichee([v({ typePage: "conversion" })]).propositions).toEqual([]);
  });
});

describe("robustesse", () => {
  it("(a) URL brute avec barre finale / majuscules : toujours reconnue", () => {
    const r = detecterQuasiGagnante([l({ position: 8, url: "https://Axion-ia.com/fr/blog/X/" })], {
      proprietaire: () => "https://axion-ia.com/fr/blog/x",
    });
    expect(r.length).toBeGreaterThan(0);
  });
  it("(d) deux graphies d'une même URL ne sont pas une cannibalisation, pas d'auto-lien", () => {
    const r = detecterCannibalisation(
      [
        {
          requete: "agent ia",
          bascules: 5,
          urls: [
            { url: "https://axion-ia.com/fr/blog/A", impressions: 80 },
            { url: "https://axion-ia.com/fr/blog/a/", impressions: 80 },
          ],
        },
      ],
      { proprietaire: () => "https://axion-ia.com/fr/blog/a" },
    );
    expect(r.propositions).toEqual([]);
  });
  it("NaN : aucun signal", () => {
    const courbe = null;
    expect(
      detecterQuasiGagnante([l({ position: 8, clics: NaN })], { proprietaire: proprio }),
    ).toEqual([]);
    expect(
      detecterCtrAnormal([l({ position: 3, clics: NaN, impressions: 500 })], { courbe }),
    ).toEqual([]);
    const p = { url: U, clics: NaN, clicsPrecedents: 100, position: 9, positionPrecedente: 5 };
    expect(detecterDeclin([p], { site: { clics: 1, clicsPrecedents: 1 } }).propositions).toEqual(
      [],
    );
    expect(
      detecterDeclin([{ ...p, clics: 10, positionPrecedente: NaN }], {
        site: { clics: 1, clicsPrecedents: 1 },
      }).propositions,
    ).toEqual([]);
  });
  it("(e) N−1 normalise : une chute bien plus forte que celle de l'an dernier reste signalée", () => {
    const p = {
      url: U,
      clics: 20,
      clicsPrecedents: 100,
      position: 9,
      positionPrecedente: 5,
      clicsAnneePrecedente: 60,
      clicsAnneePrecedentePrecedents: 100,
    };
    expect(
      detecterDeclin([p], { site: { clics: 1, clicsPrecedents: 1 } }).propositions,
    ).toHaveLength(1);
  });
  it("(a) 10 : titre/méta ; 10,5 : mise à jour", () => {
    const r = detecterQuasiGagnante([l({ position: 10.5 })], { proprietaire: proprio });
    expect(r.map((x) => x.action)).toContain("mise_a_jour");
  });
});
