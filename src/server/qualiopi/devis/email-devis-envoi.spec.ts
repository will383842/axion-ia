import { describe, expect, it } from "vitest";

import { formulesDepuisMetadata, payloadDevisEnvoi } from "./email-devis-envoi";
import { offreFictive } from "./offre-fixtures.spec-util";
import { vueFormules } from "./vue-formules";

const base = {
  clientNom: "Acme",
  numero: "AXI-DEV-2026-001",
  montantLabel: "1 000,00 € HT",
  dateValiditeLabel: "06/12/2026",
};

describe("payloadDevisEnvoi", () => {
  it("devis classique : contenu historique inchangé", () => {
    expect(payloadDevisEnvoi({ ...base, montantTotalHtCents: 100000 })).toEqual({
      clientNom: "Acme",
      numero: "AXI-DEV-2026-001",
      montantLabel: "1 000,00 € HT",
      dateValiditeLabel: "06/12/2026",
    });
  });

  it("deux formules : annonce 2, n'annonce AUCUN montant (total 0 avant le choix)", () => {
    const p = payloadDevisEnvoi({
      ...base,
      montantTotalHtCents: 0,
      formules: vueFormules(offreFictive()),
    });
    expect(p["nbFormules"]).toBe(2);
    expect(p["libellesFormules"]).toEqual([
      "Formule A · Achat",
      "Formule B · Mise en place + abonnement",
    ]);
    expect(p).not.toHaveProperty("montantLabel");
    expect(JSON.stringify(p)).not.toMatch(/token|jeton/i);
  });

  it("une seule formule : pas de mention « 2 formules », et AUCUN montant unique annoncé", () => {
    const o = offreFictive();
    o.formulesProposees = ["achat"];
    const p = payloadDevisEnvoi({
      ...base,
      montantTotalHtCents: 100000,
      formules: vueFormules(o),
    });
    expect(p).not.toHaveProperty("nbFormules");
    expect(p).not.toHaveProperty("montantLabel");
  });

  it("UNE formule abonnement : le total (mise en service) ne sous-annonce pas le prix", () => {
    const o = offreFictive();
    o.formulesProposees = ["abonnement"];
    const p = payloadDevisEnvoi({
      ...base,
      montantTotalHtCents: 30000,
      montantLabel: "300,00 € HT",
      formules: vueFormules(o),
    });
    expect(p).not.toHaveProperty("montantLabel");
  });

  it("relit les formules figées dans la pièce envoyée (renvoi)", () => {
    const vue = vueFormules(offreFictive());
    const relu = formulesDepuisMetadata({ renderData: { data: { formules: vue } } });
    expect(relu?.formules).toHaveLength(2);
    expect(formulesDepuisMetadata({ renderData: { data: {} } })).toBeUndefined();
    expect(formulesDepuisMetadata(null)).toBeUndefined();
  });

  it("devisAFormules : aucun montant annoncé même sans formules lisibles", () => {
    const p = payloadDevisEnvoi({
      clientNom: "C",
      numero: "N",
      montantTotalHtCents: 90000,
      montantLabel: "900,00 € HT",
      dateValiditeLabel: "01/01/2027",
      devisAFormules: true,
    });
    expect(p).not.toHaveProperty("montantLabel");
  });
});
