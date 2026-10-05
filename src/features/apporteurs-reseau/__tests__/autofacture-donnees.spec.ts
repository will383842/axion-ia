import { describe, expect, it } from "vitest";

import {
  construireDonneesAutofacture,
  lignesAutofacture,
  regimeHonorairesApporteur,
  totalHtCents,
  type ApporteurPourAutofacture,
} from "../autofacture-donnees";

const organisme = { raisonSociale: "Axion IA" } as never;
const apporteur: ApporteurPourAutofacture = {
  nom: "Jeanne Martin",
  denomination: null,
  siren: "ABC",
  adresse: "1 rue des Lilas, 69000 Lyon",
  regimeTva: "franchise_293b",
  numeroTva: null,
  email: null,
};
const commissions = [
  {
    id: "a",
    activite: "formation",
    palier: "formation-generale-1j",
    parrainage: false,
    montantCents: 12_000,
  },
  { id: "b", activite: "formation", palier: null, parrainage: true, montantCents: 1_500 },
  { id: "c", activite: "formation", palier: null, parrainage: false, montantCents: null },
];
const base = {
  numero: "AXI-APP-2026-0001",
  releveLibelle: "octobre 2026",
  dateEmission: new Date("2026-10-05T10:00:00Z"),
  organisme,
  commissions,
  totalAttenduCents: 13_500,
};

describe("autofacture apporteur", () => {
  it("une ligne par commission chiffrée, total en centimes", () => {
    const l = lignesAutofacture(commissions, "octobre 2026");
    expect(l).toHaveLength(2);
    expect(totalHtCents(l)).toBe(13_500);
  });
  it("traduit le régime de TVA", () => {
    expect(regimeHonorairesApporteur("assujetti")).toBe("assujetti_20");
    expect(regimeHonorairesApporteur("franchise_293b")).toBe("franchise_293b");
    expect(regimeHonorairesApporteur(null)).toBeNull();
  });
  it("cite le mandat, la contestation à 30 jours et l'apporteur comme vendeur", () => {
    const r = construireDonneesAutofacture({ ...base, apporteur });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.mandatReference).toContain("annexe 2");
      expect(r.data.delaiContestationJours).toBe(30);
      expect(r.data.sousTraitant.nom).toBe("Jeanne Martin");
      expect(r.data.regimeHonoraires).toBe("franchise_293b");
    }
  });
  it("refuse sans régime, sans identité ou si le total diverge", () => {
    expect(
      construireDonneesAutofacture({ ...base, apporteur: { ...apporteur, regimeTva: null } }).ok,
    ).toBe(false);
    expect(
      construireDonneesAutofacture({ ...base, apporteur: { ...apporteur, siren: null } }).ok,
    ).toBe(false);
    expect(construireDonneesAutofacture({ ...base, apporteur, totalAttenduCents: 1 }).ok).toBe(
      false,
    );
  });
});
