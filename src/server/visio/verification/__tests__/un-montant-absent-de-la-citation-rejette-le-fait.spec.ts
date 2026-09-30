/**
 * G4 — UN MONTANT ABSENT DE LA CITATION REJETTE LE FAIT.
 *
 * Tout montant et toute quantité de la valeur doivent être DITS dans une
 * citation du fait — en chiffres ou en lettres (table fermée). Euros ↔
 * centimes contrôlés.
 */

import { describe, expect, it } from "vitest";

import { nombresDuTexte, nombrePresent } from "../g04-valeurs";
import { avec, FAITS, leFait, verifier } from "./outils";

describe("un montant absent de la citation rejette le fait", () => {
  it("4 000 € annoncés, « trois mille » dits → valeur_non_prouvee", () => {
    const b = verifier(
      avec("F02", {
        valeur: { ...FAITS[1]!.valeur, montant_min_cents: 400000, montant_max_cents: 400000 },
      }),
    );
    expect(leFait(b, "F02")).toMatchObject({ statut: "rejete", motif: "valeur_non_prouvee" });
  });

  it("une quantité inventée → valeur_non_prouvee", () => {
    const b = verifier(avec("F01", { valeur: { ...FAITS[0]!.valeur, quantite: 15 } }));
    expect(leFait(b, "F01")).toMatchObject({ statut: "rejete", motif: "valeur_non_prouvee" });
  });

  it("contre-témoin : les nombres en lettres et en chiffres sont lus", () => {
    expect(nombresDuTexte("trois mille euros")).toContain(3000);
    expect(nombresDuTexte("3 000 €")).toContain(3000);
    expect(nombresDuTexte("quatre-vingt-dix")).toContain(90);
    expect(nombrePresent(3000, ["entre 3 et 4 000 euros"])).toBe(true);
    expect(leFait(verifier(FAITS), "F02").statut).toBe("propose");
  });
});
