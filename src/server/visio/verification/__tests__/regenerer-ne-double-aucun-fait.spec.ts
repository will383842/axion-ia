/**
 * ⛔ RÉGÉNÉRER NE DOUBLE AUCUN FAIT.
 *
 * « Réextraire » produit une nouvelle version : ses faits qui redisent, depuis
 * le même endroit de l'appel, un fait DÉJÀ VALIDÉ par Will sont écrits
 * `rejete` (motif `doublon`, lié à l'original) — jamais un second fait
 * valide. Et les faits encore PROPOSÉS de l'ancienne version sont rejetés
 * (`version_remplacee`) par `creerCompteRendu` (prouvé par Gate D).
 *
 * Mutation qui rougit : faire rendre `dedoublonner` ses faits inchangés → le
 * nombre de participants apparaît deux fois. Contre-témoin : un fait nouveau
 * (autre type) reste proposé. Angle mort : le même fait cité à un autre
 * moment de l'appel (> 1 s d'écart) n'est pas un doublon au sens du code ;
 * `consoliderFaits` le montre « confirmé ».
 */

import { describe, expect, it } from "vitest";

import { dedoublonner } from "../../passes-ia";
import { FAITS, verifier } from "./outils";

describe("régénérer ne double aucun fait", () => {
  it("un fait déjà validé au même endroit → rejete/doublon, lié, sans citation", () => {
    const bilan = verifier(FAITS);
    const ecrits = dedoublonner(bilan.faits, [
      { id: "fait-valide-1", type: "nb_participants", cle: "global", citationDebutMs: 25_000 },
    ]);
    const nb = ecrits.find((f) => f.ref === "F01")!;
    expect(nb).toMatchObject({
      statut: "rejete",
      motif: "doublon",
      doublonDeFaitId: "fait-valide-1",
      citation: null,
    });
    expect(ecrits.filter((f) => f.statut !== "rejete")).toHaveLength(FAITS.length - 1);
  });

  it("contre-témoin : sans fait validé, rien n'est touché", () => {
    const bilan = verifier(FAITS);
    expect(dedoublonner(bilan.faits, []).every((f) => f.doublonDeFaitId === null)).toBe(true);
  });
});
