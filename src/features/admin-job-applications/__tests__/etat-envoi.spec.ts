import { describe, it, expect } from "vitest";
import {
  LIBELLE_ENVOYE_EN_ATTENTE,
  LIBELLE_REMISE_CONFIRMEE,
  phaseApresSondage,
} from "../etat-envoi";

describe("phaseApresSondage", () => {
  it("🔴 `sent` n'est pas une remise confirmée", () => {
    expect(phaseApresSondage("sent")).toBe("envoye");
  });
  it("seule une remise réelle donne « remise »", () => {
    expect(phaseApresSondage("delivered")).toBe("remise");
  });
  it("échecs et attente", () => {
    expect(phaseApresSondage("failed")).toBe("echec");
    expect(phaseApresSondage("bounced")).toBe("echec");
    expect(phaseApresSondage("pending")).toBeNull();
  });
  it("libellés", () => {
    expect(LIBELLE_ENVOYE_EN_ATTENTE).toBe("Envoyé, en attente de confirmation.");
    expect(LIBELLE_REMISE_CONFIRMEE).toBe("Remise confirmée.");
  });
});
