/**
 * ⛔ UN RENDEZ-VOUS TRAITÉ EN RETARD NE VOIT PAS LE FUTUR.
 *
 * Si le compte rendu du rendez-vous du 6 octobre est produit APRÈS que celui
 * du 20 octobre a été validé (panne, réextraction), `<deja_connu>` ne doit
 * contenir QUE ce qui était su avant le 6 : les faits validés constatés
 * avant le début de la rencontre, d'une autre rencontre — jamais les siens,
 * jamais ceux d'après.
 *
 * Mutation qui rougit : dans `faitsDejaConnus`, retirer le filtre sur
 * `constateLe` → le fait du 20 octobre entre. Contre-témoin : le fait du
 * 1er septembre y est. Angle mort : un fait validé À LA MAIN (note manuelle)
 * daté d'avant mais écrit après passe — c'est sa date de constat qui compte.
 */

import { describe, expect, it } from "vitest";

import { faitsDejaConnus, type FaitDeLaBase } from "../../contexte";

function f(id: string, constate: string, p: Partial<FaitDeLaBase> = {}): FaitDeLaBase {
  return {
    id,
    type: "budget",
    cle: "global",
    portee: "entreprise",
    projetId: null,
    statut: "valide",
    suivi: null,
    enonce: id,
    constateLe: new Date(constate),
    rencontreId: `r-${id}`,
    ...p,
  };
}

describe("un rendez-vous traité en retard ne voit pas le futur", () => {
  const rencontre = { id: "r-du-6", debut: new Date("2026-10-06T10:00:00Z") };
  const faits = [
    f("passe", "2026-09-01T10:00:00Z"),
    f("futur", "2026-10-20T10:00:00Z"),
    f("elle-meme", "2026-10-06T10:00:00Z", { rencontreId: "r-du-6" }),
    f("propose-passe", "2026-09-02T10:00:00Z", { statut: "propose" }),
  ];

  it("seul le fait validé d'avant, d'une autre rencontre", () => {
    expect(faitsDejaConnus(faits, rencontre).map((x) => x.id)).toEqual(["passe"]);
  });
});
