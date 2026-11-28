// Garde du lien de signature AU RENDU : fonction pure `lienSignatureRefuseAuRendu`.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ site: "https://axion-ia.com" }));
vi.mock("@/lib/site-url", () => ({
  get SITE_URL() {
    return h.site;
  },
}));

import { lienSignatureRefuseAuRendu } from "../lien-signature";

const AUTRE = { signatureUrl: "https://autre.example/fr/portail/signer/a.b" };
const BON = { signatureUrl: "https://axion-ia.com/fr/portail/signer/a.b" };

beforeEach(() => {
  h.site = "https://axion-ia.com";
});

describe("lienSignatureRefuseAuRendu", () => {
  it("G1 — lien d'une autre origine sur un gabarit de devis : refusé", () => {
    expect(lienSignatureRefuseAuRendu("devis-envoi", AUTRE)).toBe(true);
    expect(lienSignatureRefuseAuRendu("relance-devis-client", AUTRE)).toBe(true);
  });
  it("G2 — autre gabarit, lien valide, lien absent / null / vide : permis", () => {
    expect(lienSignatureRefuseAuRendu("contact-confirmed", AUTRE)).toBe(false);
    expect(lienSignatureRefuseAuRendu("devis-envoi", BON)).toBe(false);
    for (const v of [undefined, null, "", "  "]) {
      expect(lienSignatureRefuseAuRendu("devis-envoi", { signatureUrl: v })).toBe(false);
    }
    expect(lienSignatureRefuseAuRendu("devis-envoi", {})).toBe(false);
    expect(lienSignatureRefuseAuRendu("devis-envoi", null)).toBe(false);
  });
  it("G3 — lien en http sur le domaine réel : refusé", () => {
    expect(
      lienSignatureRefuseAuRendu("devis-envoi", {
        signatureUrl: "http://axion-ia.com/fr/portail/signer/a.b",
      }),
    ).toBe(true);
  });
  it("G4 — SITE_URL local : la garde est inactive (comportement actuel conservé)", () => {
    for (const site of ["http://localhost:3000", "http://127.0.0.1:3000"]) {
      h.site = site;
      expect(lienSignatureRefuseAuRendu("devis-envoi", AUTRE)).toBe(false);
    }
  });
  it("G5 — SITE_URL en http mais non local : lien https du même hôte → permis (seul l'hôte est comparé) ; autre hôte → refusé", () => {
    h.site = "http://axion-ia.com";
    expect(lienSignatureRefuseAuRendu("devis-envoi", BON)).toBe(false);
    expect(lienSignatureRefuseAuRendu("devis-envoi", AUTRE)).toBe(true);
  });
});
