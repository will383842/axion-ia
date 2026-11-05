import { describe, it, expect } from "vitest";
import {
  etapeSuiviDevis,
  peutDemarrerLivraison,
  peutMarquerLivre,
  FENETRE_LIVRES_JOURS,
} from "./suivi-livraison";

const T0 = new Date("2026-11-01T10:00:00Z");
const MAINT = new Date("2026-11-05T10:00:00Z");

describe("etapeSuiviDevis", () => {
  it("devis signé par le client, contreseing attendu → a_contresigner", () => {
    expect(etapeSuiviDevis({ statut: "envoye", aContresigner: true }, MAINT)).toBe(
      "a_contresigner",
    );
  });
  it("devis accepté sans début de livraison → null (pas encore suivi)", () => {
    expect(etapeSuiviDevis({ statut: "accepte" }, MAINT)).toBeNull();
  });
  it("devis accepté avec début de livraison → en_livraison", () => {
    expect(etapeSuiviDevis({ statut: "accepte", livraisonDebutAt: T0 }, MAINT)).toBe(
      "en_livraison",
    );
    expect(etapeSuiviDevis({ statut: "transforme_convention", livraisonDebutAt: T0 }, MAINT)).toBe(
      "en_livraison",
    );
  });
  it("livré récemment → livre ; livré au-delà de la fenêtre → null", () => {
    expect(etapeSuiviDevis({ statut: "accepte", livraisonDebutAt: T0, livreAt: T0 }, MAINT)).toBe(
      "livre",
    );
    const vieux = new Date(MAINT.getTime() - (FENETRE_LIVRES_JOURS + 1) * 86400000);
    expect(
      etapeSuiviDevis({ statut: "accepte", livraisonDebutAt: vieux, livreAt: vieux }, MAINT),
    ).toBeNull();
  });
  it("un devis refusé, brouillon ou envoyé non signé n'a pas d'étape de livraison", () => {
    for (const statut of ["refuse", "brouillon"]) {
      expect(etapeSuiviDevis({ statut, livraisonDebutAt: T0 }, MAINT)).toBeNull();
    }
    expect(etapeSuiviDevis({ statut: "envoye" }, MAINT)).toBeNull();
  });
});

describe("transitions", () => {
  it("démarrer : devis accepté, pas encore démarré", () => {
    expect(peutDemarrerLivraison({ statut: "accepte" })).toBe(true);
    expect(peutDemarrerLivraison({ statut: "accepte", livraisonDebutAt: T0 })).toBe(false);
    expect(peutDemarrerLivraison({ statut: "envoye" })).toBe(false);
  });
  it("livrer : seulement après le début, une seule fois", () => {
    expect(peutMarquerLivre({ statut: "accepte" })).toBe(false);
    expect(peutMarquerLivre({ statut: "accepte", livraisonDebutAt: T0 })).toBe(true);
    expect(peutMarquerLivre({ statut: "accepte", livraisonDebutAt: T0, livreAt: T0 })).toBe(false);
  });
});
