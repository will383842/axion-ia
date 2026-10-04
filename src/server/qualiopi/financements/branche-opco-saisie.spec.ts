/**
 * Lot OPCO A7b — saisie du bloc « Branche et OPCO » (module PUR).
 *
 * Témoins : l'enveloppe saisie en euros part en CENTIMES ENTIERS ; un seul OPCO
 * part (le typé) ; rien ne part quand rien n'a changé ; « — » remet l'OPCO en
 * inféré ; un particulier n'envoie aucun champ d'employeur.
 */

import { describe, expect, it } from "vitest";
import {
  chargeBrancheOpco,
  eurosVersCentimes,
  saisieInitiale,
  type BrancheOpcoInitiale,
} from "./branche-opco-saisie";

const VIDE: BrancheOpcoInitiale = {
  idcc: null,
  taille: null,
  opco: null,
  effectif: null,
  enveloppeCents: null,
  numeroAdherent: null,
  adhesionMobilites: null,
  versementVolontaire: null,
};

describe("eurosVersCentimes", () => {
  it.each([
    ["1500", 150_000],
    ["1 500,50", 150_050],
    ["1 500,5", 150_050],
    ["1500.05", 150_005],
    ["0", 0],
    ["  12 000 € ", 1_200_000],
  ])("« %s » → %i centimes", (saisie, attendu) => {
    expect(eurosVersCentimes(saisie)).toBe(attendu);
  });

  it("une saisie vide rend null (effacer)", () => {
    expect(eurosVersCentimes("  ")).toBeNull();
  });

  it.each(["-3", "abc", "12,345", "1.2.3", "1e5"])("« %s » est refusé", (saisie) => {
    expect(eurosVersCentimes(saisie)).toBe("invalide");
  });

  it("le résultat est toujours un entier (pas d'erreur de virgule flottante)", () => {
    const c = eurosVersCentimes("19,99");
    expect(c).toBe(1999);
    expect(Number.isInteger(c)).toBe(true);
  });
});

describe("chargeBrancheOpco", () => {
  it("rien n'a changé : charge vide", () => {
    const initial: BrancheOpcoInitiale = {
      ...VIDE,
      opco: "atlas",
      effectif: 7,
      enveloppeCents: 300_000,
      numeroAdherent: "A-12",
      adhesionMobilites: true,
      versementVolontaire: false,
    };
    const r = chargeBrancheOpco(initial, saisieInitiale(initial), { estParticulier: false });
    expect(r).toEqual({ charge: {} });
  });

  it("enveloppe en euros → `opcoEnveloppeAnnuelleCents` en centimes entiers", () => {
    const r = chargeBrancheOpco(
      VIDE,
      { ...saisieInitiale(VIDE), enveloppeEuros: "2 500,40" },
      { estParticulier: false },
    );
    expect(r).toEqual({ charge: { opcoEnveloppeAnnuelleCents: 250_040 } });
  });

  it("enveloppe illisible : erreur, rien ne part", () => {
    const r = chargeBrancheOpco(
      VIDE,
      { ...saisieInitiale(VIDE), enveloppeEuros: "beaucoup" },
      { estParticulier: false },
    );
    expect("erreur" in r).toBe(true);
  });

  it("vider une enveloppe connue l'efface (null)", () => {
    const initial = { ...VIDE, enveloppeCents: 100_000 };
    const r = chargeBrancheOpco(
      initial,
      { ...saisieInitiale(initial), enveloppeEuros: "" },
      { estParticulier: false },
    );
    expect(r).toEqual({ charge: { opcoEnveloppeAnnuelleCents: null } });
  });

  it("l'OPCO choisi part dans le champ TYPÉ `opco`, jamais dans le texte libre", () => {
    const r = chargeBrancheOpco(
      VIDE,
      { ...saisieInitiale(VIDE), opco: "uniformation" },
      { estParticulier: false },
    );
    expect(r).toEqual({ charge: { opco: "uniformation" } });
  });

  it("« — » remet l'OPCO en inféré : `opco` ET `opcoIdentifie` à null", () => {
    const initial = { ...VIDE, opco: "akto" as const };
    const r = chargeBrancheOpco(
      initial,
      { ...saisieInitiale(initial), opco: "" },
      { estParticulier: false },
    );
    expect(r).toEqual({ charge: { opco: null, opcoIdentifie: null } });
  });

  it("effectif saisi → nombre ; « 007 » pour 7 n'est pas un changement", () => {
    const initial = { ...VIDE, effectif: 7 };
    expect(
      chargeBrancheOpco(
        initial,
        { ...saisieInitiale(initial), effectif: "007" },
        { estParticulier: false },
      ),
    ).toEqual({ charge: {} });
    expect(
      chargeBrancheOpco(
        initial,
        { ...saisieInitiale(initial), effectif: "12" },
        { estParticulier: false },
      ),
    ).toEqual({ charge: { effectif: 12 } });
  });

  it("n° d'adhérent, offre Mobilités et versement volontaire", () => {
    const r = chargeBrancheOpco(
      VIDE,
      {
        ...saisieInitiale(VIDE),
        numeroAdherent: " ADH-77 ",
        adhesionMobilites: "oui",
        versementVolontaire: "non",
      },
      { estParticulier: false },
    );
    expect(r).toEqual({
      charge: {
        opcoNumeroAdherent: "ADH-77",
        opcoAdhesionOffreMobilites: true,
        opcoVersementVolontaire: false,
      },
    });
  });

  it("revenir à « non renseigné » efface (null), jamais « non »", () => {
    const initial = { ...VIDE, adhesionMobilites: true, numeroAdherent: "X" };
    const r = chargeBrancheOpco(
      initial,
      { ...saisieInitiale(initial), adhesionMobilites: "", numeroAdherent: "" },
      { estParticulier: false },
    );
    expect(r).toEqual({ charge: { opcoAdhesionOffreMobilites: null, opcoNumeroAdherent: null } });
  });

  it("un particulier n'envoie aucun champ d'employeur, même saisi", () => {
    const r = chargeBrancheOpco(
      VIDE,
      {
        ...saisieInitiale(VIDE),
        opco: "akto",
        effectif: "3",
        enveloppeEuros: "100",
        numeroAdherent: "N",
        adhesionMobilites: "oui",
        versementVolontaire: "oui",
      },
      { estParticulier: true },
    );
    expect(r).toEqual({ charge: {} });
  });
});
