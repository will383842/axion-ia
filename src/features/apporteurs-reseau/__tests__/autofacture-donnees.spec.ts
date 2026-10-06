import { describe, expect, it } from "vitest";

import {
  ajouterJoursOuvres,
  designationCommission,
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
  it("parrainage : ni prix facturé, ni prix public, ni palier du filleul sur la ligne (art. 4.6)", () => {
    const [l] = lignesAutofacture(
      [
        {
          id: "p",
          activite: "formation",
          palier: "formation-generale-1j",
          parrainage: true,
          montantCents: 1_500,
          factureHtCents: 123_456,
          prixPublicHtCents: 200_000,
        },
      ],
      "octobre 2026",
    );
    expect(l!.designation).toBe("Commission de parrainage — relevé de octobre 2026");
    expect(l!.designation).not.toMatch(/prix|palier|1\s?234|2\s?000/i);
    expect(l!.montantHtCents).toBe(1_500);
  });
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

describe("autofacture : prix public, prix facturé, échéance, reprise (art. 4.1 bis, 5.3, 4.5)", () => {
  it("la désignation porte le prix public et le prix facturé, la commission est le montant de la ligne", () => {
    const d = designationCommission(
      {
        id: "a",
        activite: "formation",
        palier: "formation-generale-1j",
        parrainage: false,
        montantCents: 40_000,
        prixPublicHtCents: 190_000,
        factureHtCents: 152_000,
      },
      "octobre 2026",
    );
    expect(d).toContain("prix public 1 900,00 € HT".replace(" ", " "));
    expect(d).toContain("prix facturé 1 520,00 € HT");
    expect(d).toContain("palier formation-generale-1j");
  });
  it("sans prix public (audit, intégration) : seul le prix facturé est cité", () => {
    const d = designationCommission(
      {
        id: "a",
        activite: "audit",
        palier: null,
        parrainage: false,
        montantCents: 1,
        factureHtCents: 500_000,
      },
      "octobre 2026",
    );
    expect(d).toContain("prix facturé");
    expect(d).not.toContain("prix public");
  });
  it("échéance : dix jours ouvrés après l'émission, pas le jour même", () => {
    // Lundi 5 octobre 2026 + 10 jours ouvrés = lundi 19 octobre.
    expect(
      ajouterJoursOuvres(new Date("2026-10-05T10:00:00Z"), 10).toISOString().slice(0, 10),
    ).toBe("2026-10-19");
    // Vendredi 9 octobre + 10 jours ouvrés = vendredi 23 octobre (les week-ends ne comptent pas).
    expect(
      ajouterJoursOuvres(new Date("2026-10-09T10:00:00Z"), 10).toISOString().slice(0, 10),
    ).toBe("2026-10-23");
    const r = construireDonneesAutofacture({ ...base, apporteur });
    expect(r.ok && r.data.dateEcheance !== r.data.dateEmission).toBe(true);
    expect(r.ok && r.data.dateEcheance).toContain("19 octobre 2026");
  });
  it("une reprise est une ligne négative qui vient en déduction du total", () => {
    const avecReprise = [
      ...commissions.slice(0, 2),
      {
        id: "r",
        activite: "reprise",
        palier: null,
        parrainage: false,
        montantCents: -5_000,
        statut: "reprise",
      },
    ];
    const l = lignesAutofacture(avecReprise, "octobre 2026");
    expect(l).toHaveLength(3);
    expect(totalHtCents(l)).toBe(8_500);
    expect(l[2]!.designation).toContain("Reprise");
    const r = construireDonneesAutofacture({
      ...base,
      apporteur,
      commissions: avecReprise,
      totalAttenduCents: 8_500,
    });
    expect(r.ok).toBe(true);
  });
});
