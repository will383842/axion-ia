// B3 : le payload stocké d'une relance de devis ne garde pas le lien de signature en clair.
import { describe, expect, it } from "vitest";
import {
  cleLienSignature,
  GABARITS_AVEC_LIEN_SIGNATURE,
  masquerLienSignaturePayload,
} from "../masquer-lien-signature-payload";

const JETON = "Xk3vQ9mZpL2rT8wYb5nC1dFh7JsAe4UgOiRq6VtM0Ha";
const LIEN = `https://axion-ia.com/fr/portail/signer/${JETON}`;

describe("relance-devis-client dans les gabarits à lien", () => {
  it("est listé, sous la clé signatureUrl", () => {
    expect(GABARITS_AVEC_LIEN_SIGNATURE).toContain("relance-devis-client");
    expect(cleLienSignature("relance-devis-client")).toBe("signatureUrl");
  });
  it("masque le lien, garde les autres clés", () => {
    const r = masquerLienSignaturePayload("relance-devis-client", {
      numero: "D-1",
      signatureUrl: LIEN,
    });
    expect(r.modifie).toBe(true);
    const p = r.payload as Record<string, string>;
    expect(p.numero).toBe("D-1");
    expect(p.signatureUrl).not.toContain(JETON);
    expect(p.signatureUrl).toContain("[masqué]");
  });
  it("sans lien : inchangé", () => {
    expect(masquerLienSignaturePayload("relance-devis-client", { numero: "D-1" }).modifie).toBe(
      false,
    );
  });
});
