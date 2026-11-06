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

  it("une seule formule : montant annoncé, pas de mention « 2 formules »", () => {
    const o = offreFictive();
    o.formulesProposees = ["achat"];
    const p = payloadDevisEnvoi({
      ...base,
      montantTotalHtCents: 100000,
      formules: vueFormules(o),
    });
    expect(p).not.toHaveProperty("nbFormules");
    expect(p["montantLabel"]).toBe("1 000,00 € HT");
  });

  it("relit les formules figées dans la pièce envoyée (renvoi)", () => {
    const vue = vueFormules(offreFictive());
    const relu = formulesDepuisMetadata({ renderData: { data: { formules: vue } } });
    expect(relu?.formules).toHaveLength(2);
    expect(formulesDepuisMetadata({ renderData: { data: {} } })).toBeUndefined();
    expect(formulesDepuisMetadata(null)).toBeUndefined();
  });
});
