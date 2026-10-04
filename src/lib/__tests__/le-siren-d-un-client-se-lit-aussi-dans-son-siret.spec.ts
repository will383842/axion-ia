/**
 * Lot A9 — `sirenDuClient` : LA règle de lecture du SIREN d'une fiche.
 *
 * Remarque de Williams (fiche SCI Invest Sun, SIRET 90143483700018) : la fiche
 * affichait « SIREN à compléter » alors que le SIRET le contenait déjà, et le
 * bouton « Rafraîchir depuis l'INSEE », qui exigeait `client.siren`, ne
 * s'affichait jamais.
 *
 * Mutation qui fait rougir : renvoyer `siren` seul (sans regarder le SIRET), ou
 * préférer le SIRET au SIREN saisi.
 * Contre-témoin : un SIRET à la clé fausse ne donne AUCUN SIREN.
 */

import { describe, expect, it } from "vitest";

import { sirenContreditLeSiret, sirenDuClient } from "@/lib/siret";

describe("sirenDuClient", () => {
  it("SIRET de 14 chiffres sans SIREN → ses 9 premiers chiffres", () => {
    expect(sirenDuClient({ siren: null, siret: "90143483700018" })).toBe("901434837");
  });

  it("le SIRET peut être saisi avec des espaces (copié d'un Kbis)", () => {
    expect(sirenDuClient({ siren: "", siret: "901 434 837 00018" })).toBe("901434837");
  });

  it("un SIREN saisi et valide prime, même s'il contredit le SIRET", () => {
    expect(sirenDuClient({ siren: "732829320", siret: "90143483700018" })).toBe("732829320");
  });

  it("un SIREN saisi invalide est ignoré au profit du SIRET", () => {
    expect(sirenDuClient({ siren: "123", siret: "90143483700018" })).toBe("901434837");
  });

  it("contre-témoin : SIRET à la clé fausse, ou trop court → null", () => {
    expect(sirenDuClient({ siren: null, siret: "90143483700019" })).toBeNull();
    expect(sirenDuClient({ siren: null, siret: "901434837" })).toBeNull();
    expect(sirenDuClient({ siren: null, siret: "00000000000000" })).toBeNull();
  });

  it("ni SIREN ni SIRET → null", () => {
    expect(sirenDuClient({ siren: null, siret: null })).toBeNull();
    expect(sirenDuClient({})).toBeNull();
  });
});

describe("sirenContreditLeSiret", () => {
  it("vrai seulement quand les deux sont valides et différents", () => {
    expect(sirenContreditLeSiret({ siren: "732829320", siret: "90143483700018" })).toBe(true);
    expect(sirenContreditLeSiret({ siren: "901434837", siret: "90143483700018" })).toBe(false);
    expect(sirenContreditLeSiret({ siren: null, siret: "90143483700018" })).toBe(false);
    expect(sirenContreditLeSiret({ siren: "732829320", siret: null })).toBe(false);
  });
});
