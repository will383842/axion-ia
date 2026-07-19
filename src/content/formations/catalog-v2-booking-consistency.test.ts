// Test d'invariant — le catalogue formations est DÉCOUPLÉ du calendrier de
// réservation (refonte 2026-07, maintenu par la refonte 2026-07-19).
//
// Contexte : /reserver est supprimé (301 → /appel) ; les formations passent
// par appel / contact, PAS par le calendrier. La refonte 2026-07-19 rend les
// prix PUBLICS (fixes par groupe) mais ne réintroduit PAS le booking. On
// verrouille les invariants :
//   1. le catalogue compte 22 entrées (21 formations + 1 séminaire) ;
//   2. chaque formation catégorisée a un prix public (tranche unique 2-15) ;
//      le séminaire reste « Sur devis » ;
//   3. aucune formation n'est réservable via le calendrier (appel/devis only).
// (Le retrait complet du moteur de booking legacy est un chantier séparé.)

import { describe, expect, it } from "vitest";
import {
  FORMATIONS_V2,
  getFormationsV2,
  getFormationV2Brackets,
  getSeminairesV2,
} from "./catalog-v2";
import { findBookableBySlug } from "@/content/booking-catalog";

describe("catalog — prix publics, découplé du calendrier", () => {
  it("le catalogue compte 22 entrées (21 formations + 1 séminaire)", () => {
    expect(FORMATIONS_V2).toHaveLength(22);
  });

  it("chaque formation catégorisée expose la tranche unique 2-15 ; séminaire sur devis", () => {
    for (const f of getFormationsV2()) {
      expect(getFormationV2Brackets(f), f.slugFr).toEqual(["2-15"]);
    }
    for (const s of getSeminairesV2()) {
      expect(getFormationV2Brackets(s), s.slugFr).toHaveLength(0);
    }
  });

  it("aucune formation n'est réservable via le calendrier (appel / devis uniquement)", () => {
    for (const f of FORMATIONS_V2) {
      expect(
        findBookableBySlug(f.slugFr),
        `formation ne doit PAS être réservable via le calendrier : ${f.slugFr}`,
      ).toBeUndefined();
    }
  });
});
