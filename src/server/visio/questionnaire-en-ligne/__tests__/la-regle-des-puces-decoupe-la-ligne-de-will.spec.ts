/**
 * LA RÈGLE DES PUCES DÉCOUPE LA LIGNE DE WILL (UX §1.3, 2026-10-01).
 *
 * Les trois formes de l'UX — liste entre parenthèses, liste après « : »,
 * aide après le dernier « ? » — sur des lignes d'EXEMPLE (dépôt public : aucune
 * question d'un vrai prospect ici).
 *
 * Mutation qui rougit : prendre l'aide après le PREMIER « ? » ; laisser la
 * liste dans le titre ; faire des puces d'une parenthèse à un seul élément.
 * Contre-témoin : une question sans « ? » final ni liste reste intacte.
 */

import { describe, expect, it } from "vitest";

import { composerReponse, decouperQuestion } from "../decouper";

const CAS: ReadonlyArray<
  readonly [string, { titre: string; puces: string[]; aide: string | null }]
> = [
  [
    "Quels outils utilisez-vous (tableur, logiciel de facturation, CRM, autre), et depuis quand ? Pour savoir où vivent vos données. Un ordre d'idée suffit.",
    {
      titre: "Quels outils utilisez-vous, et depuis quand ?",
      puces: ["Tableur", "Logiciel de facturation", "CRM", "Autre"],
      aide: "Pour savoir où vivent vos données. Un ordre d'idée suffit.",
    },
  ],
  [
    "Qui consultera les tableaux de bord : direction, commerciaux, comptabilité ? Pour prévoir ce que chacun verra.",
    {
      titre: "Qui consultera les tableaux de bord ?",
      puces: ["Direction", "Commerciaux", "Comptabilité"],
      aide: "Pour prévoir ce que chacun verra.",
    },
  ],
  [
    "En ordre de grandeur, combien de devis, de commandes et de factures traitez-vous par mois ? Une estimation convient.",
    {
      titre:
        "En ordre de grandeur, combien de devis, de commandes et de factures traitez-vous par mois ?",
      puces: [],
      aide: "Une estimation convient.",
    },
  ],
];

describe("la règle des puces découpe la ligne de Will", () => {
  it.each(CAS.map(([ligne, attendu], i) => [i + 1, ligne, attendu] as const))(
    "forme %i : titre, puces et aide",
    (_, ligne, attendu) => {
      expect(decouperQuestion(ligne)).toEqual(attendu);
    },
  );

  it("l'aide est prise après le DERNIER « ? »", () => {
    expect(decouperQuestion("Pourquoi ? Et comment ? Pour comprendre.")).toEqual({
      titre: "Pourquoi ? Et comment ?",
      aide: "Pour comprendre.",
      puces: [],
    });
  });

  it("contre-témoin : une question simple reste intacte", () => {
    expect(decouperQuestion("Combien de personnes à former ?")).toEqual({
      titre: "Combien de personnes à former ?",
      aide: null,
      puces: [],
    });
    expect(decouperQuestion("Décrivez votre besoin")).toEqual({
      titre: "Décrivez votre besoin",
      aide: null,
      puces: [],
    });
  });

  it("une parenthèse à un seul élément n'est pas une liste", () => {
    expect(decouperQuestion("Avez-vous un financement (OPCO) ?")).toEqual({
      titre: "Avez-vous un financement (OPCO) ?",
      aide: null,
      puces: [],
    });
  });

  it("la forme des questions préparées (« ? (a / b) ») donne des puces", () => {
    expect(decouperQuestion("Quelle modalité préférez-vous ? (distanciel / présentiel)")).toEqual({
      titre: "Quelle modalité préférez-vous ?",
      aide: null,
      puces: ["Distanciel", "Présentiel"],
    });
  });

  it("la réponse enregistrée : puces jointes par « , », puis le texte libre", () => {
    expect(composerReponse(["Devis", "CRM"], "  une dizaine  ")).toBe("Devis, CRM\nune dizaine");
    expect(composerReponse([], "texte seul")).toBe("texte seul");
    expect(composerReponse(["Devis"], "")).toBe("Devis");
    expect(composerReponse([], "  ")).toBe("");
  });
});
