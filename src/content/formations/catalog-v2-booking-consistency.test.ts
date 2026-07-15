// Test d'invariant — l'offre AXION (catalogue V2) est DÉCOUPLÉE du calendrier
// de réservation (refonte 2026-07).
//
// Contexte : l'ancienne offre miroir­ait les 17 formations dans le booking
// (`INTERVENTION_SLUGS` / `FORMATION_BOOKING` / `booking-catalog`) pour les
// rendre réservables sur `/reserver`. Cette page a été supprimée et la nouvelle
// offre AXION est 100 % « Sur devis » : les formations passent par devis /
// contact, PAS par le calendrier. On verrouille donc le NOUVEL invariant :
//   1. le catalogue compte 15 entrées (14 formations + 1 séminaire) ;
//   2. chaque formation est « Sur devis » (aucun prix matrice, aucune tranche) ;
//   3. aucune formation n'est réservable via le calendrier (devis-only).
// (Le retrait complet du moteur de booking legacy est un chantier séparé.)

import { describe, expect, it } from "vitest";
import { FORMATIONS_V2, getFormationV2Brackets } from "./catalog-v2";
import { findBookableBySlug } from "@/content/booking-catalog";

describe("catalog-v2 — offre AXION « Sur devis », découplée du calendrier", () => {
  it("le catalogue compte 15 entrées (14 formations + 1 séminaire)", () => {
    expect(FORMATIONS_V2).toHaveLength(15);
  });

  it("chaque formation est « Sur devis » (aucun prix matrice, aucune tranche)", () => {
    for (const f of FORMATIONS_V2) {
      expect(f.surDevis, f.slugFr).toBe(true);
      expect(
        getFormationV2Brackets(f),
        `${f.slugFr} ne doit exposer aucune tranche de prix (Sur devis)`,
      ).toHaveLength(0);
    }
  });

  it("aucune formation n'est réservable via le calendrier (devis / contact uniquement)", () => {
    for (const f of FORMATIONS_V2) {
      expect(
        findBookableBySlug(f.slugFr),
        `formation ne doit PAS être réservable via le calendrier : ${f.slugFr}`,
      ).toBeUndefined();
    }
  });
});
