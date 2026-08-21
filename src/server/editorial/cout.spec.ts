/**
 * Console éditoriale — tests du coût par résultat (lot 6).
 *
 * Trois pièges d'arithmétique, tous SILENCIEUX — c'est ce qui les rend
 * dangereux, et c'est ce que ces tests visent :
 *
 *   1. diviser par zéro résultat ne donne pas un coût infini, mais un coût
 *      INDÉTERMINÉ — `Infinity` s'affiche mal, se trie mal, et casse tout
 *      calcul en aval ;
 *   2. « gratuit » et « non mesuré » sont deux états différents, et c'est
 *      l'inverse exact de la règle du lot 3 sur les métriques ;
 *   3. tout est en CENTIMES : l'erreur d'un facteur 100 sur un coût
 *      d'acquisition ne se voit pas, « 4,50 » et « 450 » sont tous deux
 *      plausibles.
 */

import { describe, it, expect } from "vitest";
import {
  coutParResultat,
  formaterEuros,
  formaterCoutParResultat,
  comparerUsages,
  depensesSansResultat,
  budgetTotal,
  type PublicationCoutee,
} from "./cout";

/**
 * Normalise les espaces avant comparaison.
 *
 * 🔴 `toLocaleString("fr-FR", { style: "currency" })` insère un espace
 * INSÉCABLE (U+00A0) — et selon la version d'ICU, une espace fine insécable
 * (U+202F) — avant le symbole €. Comparer à une espace ordinaire échoue avec
 * le message le plus déroutant qui soit : « expected '0 €' to be '0 €' ».
 *
 * On normalise donc dans le TEST, pas dans le code : l'espace insécable est
 * la bonne typographie française, et l'enlever du rendu serait corriger un
 * affichage correct pour faire passer un test fautif.
 */
function espacesNormalisees(texte: string): string {
  return texte.replace(/[  ]/g, " ");
}

function pub(patch: Partial<PublicationCoutee> & { publicationId: string }): PublicationCoutee {
  return {
    coutCentimes: 0,
    identite: "perso",
    usage: "organique",
    rdvAttribues: null,
    devisAttribues: null,
    clics: null,
    impressions: null,
    ...patch,
  };
}

describe("coutParResultat — quatre états qui ne se confondent pas", () => {
  it("calcule un coût quand il y a de l'argent ET des résultats", () => {
    // 30 000 centimes (300 €) pour 4 rendez-vous = 7 500 centimes (75 €).
    const c = coutParResultat(30_000, 4);
    expect(c.etat).toBe("calcule");
    expect(c.centimes).toBe(7_500);
    expect(espacesNormalisees(formaterCoutParResultat(c))).toBe("75 €");
  });

  it("🔴 rend GRATUIT — et non « non disponible » — pour un coût nul", () => {
    // Un post organique coûte réellement zéro. C'est comparable, et c'est
    // l'inverse exact de la règle du lot 3 sur les métriques absentes.
    const c = coutParResultat(0, 3);
    expect(c.etat).toBe("gratuit");
    expect(c.centimes).toBe(0);
    expect(formaterCoutParResultat(c)).toBe("gratuit");
  });

  it("🔴 rend INDÉTERMINÉ — ni Infinity, ni null — quand on a payé pour rien", () => {
    // `30000 / 0` vaut `Infinity` en JavaScript : ça s'affiche mal, ça se
    // trie mal, et ça contamine tout calcul en aval. Or « on a payé et rien
    // n'est venu » est une information FORTE, pas une absence d'information.
    const c = coutParResultat(30_000, 0);
    expect(c.etat).toBe("indetermine");
    expect(c.centimes).toBeNull();
    expect(Number.isFinite(c.centimes as number)).toBe(false);
    expect(espacesNormalisees(c.explication)).toContain("300 €");
    expect(c.explication).toContain("aucun résultat");
  });

  it("🔴 rend NON MESURÉ quand les résultats ne sont pas relevés", () => {
    const c = coutParResultat(30_000, null);
    expect(c.etat).toBe("non_mesure");
    expect(c.centimes).toBeNull();
    expect(c.explication).toContain("Saisissez un relevé");
  });

  it("🔴 distingue « gratuit et non mesuré » de « gratuit et mesuré »", () => {
    // Un post organique non relevé reste non mesuré : la gratuité ne dispense
    // pas de mesurer.
    expect(coutParResultat(0, null).etat).toBe("non_mesure");
    expect(coutParResultat(0, 0).etat).toBe("gratuit");
  });

  it("arrondit au centime, sans laisser de décimale parasite", () => {
    // 10 000 centimes pour 3 résultats = 3333,33… → 3333.
    expect(coutParResultat(10_000, 3).centimes).toBe(3_333);
  });
});

describe("formaterEuros — le facteur 100", () => {
  it("🔴 convertit les CENTIMES en euros", () => {
    // L'erreur qui ne se voit pas : « 450 » au lieu de « 4,50 ».
    expect(espacesNormalisees(formaterEuros(45_000))).toBe("450 €");
    expect(espacesNormalisees(formaterEuros(450))).toBe("4,50 €");
  });

  it("omet les décimales sur un montant rond", () => {
    expect(espacesNormalisees(formaterEuros(30_000))).toBe("300 €");
  });

  it("garde les centimes quand il y en a", () => {
    expect(espacesNormalisees(formaterEuros(7_549))).toBe("75,49 €");
  });

  it("rend « non disponible » sur null, jamais « 0 € »", () => {
    expect(formaterEuros(null)).toBe("non disponible");
  });

  it("gère le zéro comme un vrai montant", () => {
    expect(espacesNormalisees(formaterEuros(0))).toBe("0 €");
  });
});

describe("comparerUsages — la question du lot 6", () => {
  const publications = [
    pub({ publicationId: "o1", usage: "organique", rdvAttribues: 2 }),
    pub({ publicationId: "o2", usage: "organique", rdvAttribues: 1 }),
    pub({ publicationId: "p1", usage: "payant", coutCentimes: 20_000, rdvAttribues: 4 }),
    pub({ publicationId: "p2", usage: "payant", coutCentimes: 10_000, rdvAttribues: 1 }),
  ];

  it("compare organique et payant sur la même métrique", () => {
    const bilans = comparerUsages(publications);
    const organique = bilans.find((b) => b.usage === "organique");
    const payant = bilans.find((b) => b.usage === "payant");

    expect(organique?.resultats).toBe(3);
    expect(organique?.coutMoyen.etat).toBe("gratuit");

    expect(payant?.resultats).toBe(5);
    expect(payant?.coutTotalCentimes).toBe(30_000);
    // 30 000 centimes pour 5 rendez-vous = 6 000 centimes = 60 €.
    expect(payant?.coutMoyen.centimes).toBe(6_000);
  });

  it("🔴 n'affiche pas un usage qui n'a aucune publication", () => {
    // Un groupe « mixte » vide affiché à zéro laisserait croire qu'on en fait
    // et que ça ne marche pas.
    expect(comparerUsages(publications).map((b) => b.usage)).toEqual(["organique", "payant"]);
  });

  it("🔴 rend `resultats` à null si AUCUNE publication du groupe n'est relevée", () => {
    const bilans = comparerUsages([
      pub({ publicationId: "x", usage: "payant", coutCentimes: 5_000 }),
    ]);
    expect(bilans[0]!.resultats).toBeNull();
    expect(bilans[0]!.coutMoyen.etat).toBe("non_mesure");
    expect(bilans[0]!.nbMesurees).toBe(0);
  });

  it("compte combien de publications ont été relevées", () => {
    const bilans = comparerUsages([
      pub({ publicationId: "a", usage: "payant", coutCentimes: 1_000, rdvAttribues: 1 }),
      pub({ publicationId: "b", usage: "payant", coutCentimes: 1_000 }),
    ]);
    expect(bilans[0]!.nbMesurees).toBe(1);
    expect(bilans[0]!.nbPublications).toBe(2);
    // Le coût total compte les DEUX, même celle qu'on n'a pas relevée : on a
    // bien dépensé les 2 000 centimes.
    expect(bilans[0]!.coutTotalCentimes).toBe(2_000);
  });

  it("sait comparer sur les clics plutôt que sur les rendez-vous", () => {
    const bilans = comparerUsages(
      [pub({ publicationId: "a", usage: "payant", coutCentimes: 10_000, clics: 200 })],
      "clics",
    );
    expect(bilans[0]!.coutMoyen.centimes).toBe(50); // 0,50 € le clic
  });
});

describe("depensesSansResultat — ce qu'on arrête en premier", () => {
  it("🔴 remonte l'argent engagé qui n'a rien rapporté", () => {
    const sansResultat = depensesSansResultat([
      pub({ publicationId: "a", coutCentimes: 5_000, rdvAttribues: 0 }),
      pub({ publicationId: "b", coutCentimes: 40_000, rdvAttribues: 0 }),
      pub({ publicationId: "c", coutCentimes: 20_000, rdvAttribues: 3 }),
      pub({ publicationId: "d", coutCentimes: 0, rdvAttribues: 0 }),
    ]);
    // La plus coûteuse d'abord : c'est celle qu'on arrête en premier.
    expect(sansResultat.map((p) => p.publicationId)).toEqual(["b", "a"]);
  });

  it("🔴 n'y met PAS les publications gratuites — il n'y a rien à arrêter", () => {
    expect(depensesSansResultat([pub({ publicationId: "x", rdvAttribues: 0 })])).toHaveLength(0);
  });

  it("🔴 n'y met PAS les non mesurées — on ne sait pas si elles rapportent", () => {
    // Les accuser reviendrait à confondre « rien rapporté » et « pas relevé ».
    expect(
      depensesSansResultat([pub({ publicationId: "y", coutCentimes: 9_000, rdvAttribues: null })]),
    ).toHaveLength(0);
  });
});

describe("budgetTotal", () => {
  it("somme les coûts engagés", () => {
    expect(
      budgetTotal([
        pub({ publicationId: "a", coutCentimes: 12_345 }),
        pub({ publicationId: "b", coutCentimes: 7_655 }),
      ]),
    ).toBe(20_000);
  });

  it("rend zéro sur un dossier entièrement organique", () => {
    expect(budgetTotal([pub({ publicationId: "a" })])).toBe(0);
  });
});
