/**
 * Fiche L11-S2 — le repli « à préciser » n'apparaît jamais dans une alerte interne.
 */

import { describe, expect, it } from "vitest";

import {
  NOM_OPCO_A_PRECISER,
  nomOpcoDuClient,
} from "@/server/qualiopi/financements/opco-referentiel";

import { nomTiersLisible } from "./nom-organisme-tiers";

describe("nomTiersLisible", () => {
  it("le repli est remplacé par une phrase neutre", () => {
    const texte = nomTiersLisible(NOM_OPCO_A_PRECISER);
    expect(texte).toBe("l'organisme tiers (non renseigné sur la fiche client)");
    expect(texte).not.toMatch(/opco|à préciser/i);
  });

  it("un nom reconnu est rendu tel quel", () => {
    expect(nomTiersLisible("Atlas")).toBe("Atlas");
    expect(nomTiersLisible("OPCO EP")).toBe("OPCO EP");
  });

  it("la valeur du repli est inchangée (factures et pièces s'en servent)", () => {
    expect(NOM_OPCO_A_PRECISER).toBe("OPCO (à préciser)");
    expect(nomOpcoDuClient(null)).toBe(NOM_OPCO_A_PRECISER);
  });
});
