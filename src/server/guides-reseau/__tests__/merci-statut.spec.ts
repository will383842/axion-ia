// @vitest-environment node
// Une seule valeur de mise à l'écart de `merci_statut` : 'ecarte'. L'ancienne graphie 'ecartee'
// (marque d'une adresse opposée) reste LUE comme écartée.
import { describe, it, expect } from "vitest";
import { MERCI_STATUT_ECARTE, MERCI_STATUTS_ECARTES_LUS, merciEstEcarte } from "../merci-statut";

describe("merci_statut — mise à l'écart", () => {
  it("la valeur écrite est 'ecarte'", () => {
    expect(MERCI_STATUT_ECARTE).toBe("ecarte");
  });
  it("les deux graphies sont lues comme écartées", () => {
    expect([...MERCI_STATUTS_ECARTES_LUS].sort()).toEqual(["ecarte", "ecartee"]);
    expect(merciEstEcarte("ecarte")).toBe(true);
    expect(merciEstEcarte("ecartee")).toBe(true);
    expect(merciEstEcarte("a_envoyer")).toBe(false);
  });
});
