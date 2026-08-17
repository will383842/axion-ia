/**
 * Sous-lot 8G — une estimation de financement mutualisé ne s'imprime pas sans
 * certification.
 *
 * Le test qui doit rougir : **un devis « OPCO » émis sans certification ne doit
 * porter aucun montant de prise en charge**. C'est le constat T8 de l'audit
 * OPCO du 15/08 — un chiffre imprimé sur une offre que le client accepte, pour
 * un financement que l'art. L.6316-1 rend inaccessible.
 */

import { describe, expect, it } from "vitest";
import {
  avertissementEstimationAdmin,
  regimeEstimationMutualisee,
} from "./estimation-certification";

describe("certification obtenue — rien ne change", () => {
  it.each(["opco", "cpf", "france_travail", "direct", "mixte", null, undefined])(
    "laisse passer l'estimation pour %s",
    (financement) => {
      const r = regimeEstimationMutualisee(financement, true);
      expect(r.presentable).toBe(true);
      expect(r.mention).toBeNull();
    },
  );

  it("ne produit aucun avertissement admin", () => {
    expect(avertissementEstimationAdmin("opco", true)).toBeNull();
  });
});

describe("🔴 certification NON obtenue — les fonds mutualisés se taisent", () => {
  it.each(["opco", "cpf", "france_travail"])("retire l'estimation pour %s", (financement) => {
    const r = regimeEstimationMutualisee(financement, false);
    expect(r.presentable).toBe(false);
    expect(r.mention).not.toBeNull();
  });

  it("dit POURQUOI, en citant le texte — sinon le client croit qu'aucun financement n'existe", () => {
    const r = regimeEstimationMutualisee("opco", false);
    expect(r.mention).toContain("L.6316-1");
    expect(r.mention).toContain("certification");
    // Et il annonce que ce n'est pas définitif : le dispositif existe, il n'est
    // pas encore ouvert chez nous.
    expect(r.mention).toContain("dès que la certification sera obtenue");
  });

  it("n'imprime AUCUN montant dans sa mention", () => {
    const mention = regimeEstimationMutualisee("cpf", false).mention ?? "";
    expect(mention).not.toMatch(/\d+\s*€/);
  });

  it("avertit l'admin en distinguant « calculée » de « imprimée »", () => {
    const a = avertissementEstimationAdmin("france_travail", false) ?? "";
    expect(a).toContain("enregistrée");
    expect(a).toContain("NON imprimée");
  });
});

describe("🔴 les financements NON mutualisés ne sont pas visés", () => {
  it.each(["direct", "mixte"])("laisse passer %s même sans certification", (financement) => {
    // `direct` est sur fonds propres ; `mixte` reste finançable pour sa part
    // directe. Les bloquer interdirait une affaire parfaitement licite —
    // c'est le découpage déjà retenu par `validateFinancementMutualiseSansCertification`.
    const r = regimeEstimationMutualisee(financement, false);
    expect(r.presentable).toBe(true);
  });

  it("laisse passer l'absence de financement déclaré", () => {
    expect(regimeEstimationMutualisee(null, false).presentable).toBe(true);
    expect(regimeEstimationMutualisee(undefined, false).presentable).toBe(true);
    expect(regimeEstimationMutualisee("", false).presentable).toBe(true);
  });

  it("laisse passer un libellé inconnu plutôt que de bloquer au hasard", () => {
    expect(regimeEstimationMutualisee("subvention_region", false).presentable).toBe(true);
  });
});

describe("robustesse d'entrée", () => {
  it("reconnaît le financement quelles que soient casse et espaces", () => {
    expect(regimeEstimationMutualisee("  OPCO  ", false).presentable).toBe(false);
    expect(regimeEstimationMutualisee("France_Travail", false).presentable).toBe(false);
  });
});
