/**
 * Tests dossier-financement — machine à états (transitions autorisées).
 * Le flux DB (verrou optimiste, horodatages) suit le pattern éprouvé
 * updateMany conditionné ; ici on verrouille la TABLE de transitions.
 */

import { describe, it, expect } from "vitest";
import { DOSSIER_TRANSITIONS, isTransitionDossierValide } from "./dossier-financement";
import type { DossierFinancementStatut } from "../../../../prisma/generated/client";

const TOUS: DossierFinancementStatut[] = [
  "a_monter",
  "envoye",
  "accord_recu",
  "refuse",
  "facture",
  "paiement_recu",
  "clos",
];

describe("DOSSIER_TRANSITIONS", () => {
  it("chemin nominal : a_monter → envoye → accord_recu → facture → paiement_recu → clos", () => {
    expect(isTransitionDossierValide("a_monter", "envoye")).toBe(true);
    expect(isTransitionDossierValide("envoye", "accord_recu")).toBe(true);
    expect(isTransitionDossierValide("accord_recu", "facture")).toBe(true);
    expect(isTransitionDossierValide("facture", "paiement_recu")).toBe(true);
    expect(isTransitionDossierValide("paiement_recu", "clos")).toBe(true);
  });

  it("refus : envoye → refuse → (clos | re-envoi après ajustement)", () => {
    expect(isTransitionDossierValide("envoye", "refuse")).toBe(true);
    expect(isTransitionDossierValide("refuse", "clos")).toBe(true);
    expect(isTransitionDossierValide("refuse", "envoye")).toBe(true);
  });

  it("retour en préparation possible tant que non décidé", () => {
    expect(isTransitionDossierValide("envoye", "a_monter")).toBe(true);
  });

  it("clos est terminal : aucune transition sortante", () => {
    expect(DOSSIER_TRANSITIONS.clos).toHaveLength(0);
    for (const cible of TOUS) {
      expect(isTransitionDossierValide("clos", cible)).toBe(false);
    }
  });

  it("aucun saut illégal : pas de a_monter → paiement_recu ni envoye → facture", () => {
    expect(isTransitionDossierValide("a_monter", "paiement_recu")).toBe(false);
    expect(isTransitionDossierValide("a_monter", "accord_recu")).toBe(false);
    expect(isTransitionDossierValide("envoye", "facture")).toBe(false);
    expect(isTransitionDossierValide("accord_recu", "paiement_recu")).toBe(false);
  });

  it("la table couvre tous les statuts (exhaustivité du Record)", () => {
    for (const statut of TOUS) {
      expect(Array.isArray(DOSSIER_TRANSITIONS[statut])).toBe(true);
    }
  });
});
