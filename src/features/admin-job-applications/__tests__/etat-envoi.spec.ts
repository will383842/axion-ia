import { describe, it, expect } from "vitest";
import { LIBELLE_ENVOYE, LIBELLE_TRAITEMENT_LONG, phaseApresSondage } from "../etat-envoi";

describe("phaseApresSondage", () => {
  it("🔴 `sent` donne « envoyé », jamais une remise", () => {
    expect(phaseApresSondage("sent")).toBe("envoye");
    expect(LIBELLE_ENVOYE).not.toMatch(/remise|remis|délivr/i);
  });
  it("échecs et attente", () => {
    expect(phaseApresSondage("failed")).toBe("echec");
    expect(phaseApresSondage("bounced")).toBe("echec");
    expect(phaseApresSondage("pending")).toBeNull();
  });
  it("un statut inconnu ne tranche rien", () => {
    expect(phaseApresSondage("delivered")).toBeNull();
  });
  it("libellés", () => {
    expect(LIBELLE_ENVOYE).toMatch(/^Envoyé/);
    expect(LIBELLE_TRAITEMENT_LONG).toMatch(/vérifiez la frise avant de renvoyer/);
  });
});
