import { describe, expect, it } from "vitest";

import {
  ECHEANCE_JOURS,
  dateEncaissementRetenue,
  echeancePaiement,
  etatEcheances,
  objectifVirement,
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
  periodeLibelle: "commissions exigibles au 5 octobre 2026",
  dateEmission: new Date("2026-10-05T10:00:00Z"),
  organisme,
  commissions,
  totalAttenduCents: 13_500,
};

describe("autofacture apporteur", () => {
  it("parrainage : ni prix facturé, ni prix public, ni palier du filleul sur la ligne (art. 4.6)", () => {
    const [l] = lignesAutofacture([
      {
        id: "p",
        activite: "formation",
        palier: "formation-generale-1j",
        parrainage: true,
        montantCents: 1_500,
        factureHtCents: 123_456,
        prixPublicHtCents: 200_000,
      },
    ]);
    expect(l!.designation).toBe("Parrainage (art. 4.6)");
    expect(l!.designation).not.toMatch(/prix|palier|1\s?234|2\s?000/i);
    expect(l!.montantHtCents).toBe(1_500);
  });
  it("une ligne par commission chiffrée, total en centimes", () => {
    const l = lignesAutofacture(commissions);
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
    const d = designationCommission({
      id: "a",
      activite: "formation",
      palier: "formation-generale-1j",
      parrainage: false,
      montantCents: 40_000,
      prixPublicHtCents: 190_000,
      factureHtCents: 152_000,
    });
    expect(d).toContain("prix public 1 900,00 € HT".replace(" ", " "));
    expect(d).toContain("prix facturé 1 520,00 € HT");
    expect(d).toContain("palier formation-generale-1j");
  });
  it("sans prix public (audit, intégration) : seul le prix facturé est cité", () => {
    const d = designationCommission({
      id: "a",
      activite: "audit",
      palier: null,
      parrainage: false,
      montantCents: 1,
      factureHtCents: 500_000,
    });
    expect(d).toContain("prix facturé");
    expect(d).not.toContain("prix public");
  });
  it("échéance imprimée : trente jours calendaires après l'émission (5 octobre -> 4 novembre)", () => {
    expect(ECHEANCE_JOURS).toBe(30);
    const r = construireDonneesAutofacture({ ...base, apporteur });
    expect(r.ok && r.data.dateEcheance).toContain("4 novembre 2026");
    expect(r.ok && r.data.dateEcheance !== r.data.dateEmission).toBe(true);
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
    const l = lignesAutofacture(avecReprise);
    expect(l).toHaveLength(3);
    expect(totalHtCents(l)).toBe(8_500);
    expect(l[2]!.designation).toContain("avoir");
    const r = construireDonneesAutofacture({
      ...base,
      apporteur,
      commissions: avecReprise,
      totalAttenduCents: 8_500,
    });
    expect(r.ok).toBe(true);
  });
});

describe("désignation d'une commission de conférence", () => {
  it("« Commission d'apport — conférence », sans palier de formation", () => {
    const d = designationCommission({
      id: "k",
      activite: "conference",
      palier: "conference",
      parrainage: false,
      statut: "versee",
      montantCents: 50_000,
      factureHtCents: 210_000,
      prixPublicHtCents: null,
    } as never);
    expect(d).toContain("Commission d'apport — conférence");
    expect(d).not.toContain("palier");
    expect(d).not.toMatch(/relevé/);
  });
});

describe("objectif de virement (2 jours ouvrés) et échéance (30 jours)", () => {
  const jour = (d: Date) => d.toISOString().slice(0, 10);
  it("client qui paie un mardi : objectif jeudi", () => {
    expect(jour(objectifVirement(new Date("2026-10-06T09:00:00Z")))).toBe("2026-10-08");
  });
  it("client qui paie un vendredi : objectif mardi (le week-end ne compte pas)", () => {
    expect(jour(objectifVirement(new Date("2026-10-09T09:00:00Z")))).toBe("2026-10-13");
  });
  it("client qui paie la veille d'un férié (jeudi 24/12/2026, Noël vendredi) : objectif mardi 29", () => {
    expect(jour(objectifVirement(new Date("2026-12-24T09:00:00Z")))).toBe("2026-12-29");
  });
  it("échéance : 30 jours calendaires, week-ends compris", () => {
    expect(jour(echeancePaiement(new Date("2026-10-06T09:00:00Z")))).toBe("2026-11-05");
  });
  it("virement le jour 5 : objectif dépassé (orange), aucun marqueur rouge", () => {
    const e = etatEcheances(new Date("2026-10-06T09:00:00Z"), new Date("2026-10-11T09:00:00Z"));
    expect(e.objectifDepasse).toBe(true);
    expect(e.echeanceDepassee).toBe(false);
  });
  it("avant l'objectif : aucun marqueur", () => {
    const e = etatEcheances(new Date("2026-10-06T09:00:00Z"), new Date("2026-10-08T15:00:00Z"));
    expect(e.objectifDepasse).toBe(false);
    expect(e.echeanceDepassee).toBe(false);
  });
  it("le jour 31 : l'échéance de trente jours est dépassée (rouge)", () => {
    const e = etatEcheances(new Date("2026-10-06T09:00:00Z"), new Date("2026-11-06T09:00:00Z"));
    expect(e.echeanceDepassee).toBe(true);
  });
  it("le jour 30 lui-même : pas encore rouge", () => {
    const e = etatEcheances(new Date("2026-10-06T09:00:00Z"), new Date("2026-11-05T20:00:00Z"));
    expect(e.echeanceDepassee).toBe(false);
  });
});

describe("avoir, parrainage, dates (validation juridique)", () => {
  const date = (d: Date) => d.toISOString().slice(0, 10);
  it("une reprise s'imprime comme un AVOIR d'autofacturation, avec renvoi à l'autofacture d'origine", () => {
    const d = designationCommission({
      id: "r",
      activite: "reprise",
      palier: "reprise-de:x",
      parrainage: false,
      statut: "reprise",
      montantCents: -5_000,
      origineNumero: "AXI-APP-2026-0003",
      origineMois: "2026-09",
    });
    expect(d).toContain("Autofacturation — avoir");
    expect(d).toContain("AXI-APP-2026-0003");
    expect(d).toContain("septembre 2026");
  });
  it("parrainage : une ligne unique, ni filleul, ni commande, ni prix, ni commission du filleul", () => {
    const d = designationCommission({
      id: "p",
      activite: "formation",
      palier: "formation-generale-1j",
      parrainage: true,
      montantCents: 1_500,
      factureHtCents: 123_456,
      prixPublicHtCents: 200_000,
    });
    expect(d).toBe("Parrainage (art. 4.6)");
  });
  it("encaissement constaté un samedi : retenu le lundi, objectif le mercredi", () => {
    const samedi = new Date("2026-10-10T10:00:00Z");
    expect(date(dateEncaissementRetenue(samedi))).toBe("2026-10-12");
    expect(date(objectifVirement(samedi))).toBe("2026-10-14");
  });
  it("encaissement constaté un jour ouvré : retenu ce jour-là", () => {
    expect(date(dateEncaissementRetenue(new Date("2026-10-06T09:00:00Z")))).toBe("2026-10-06");
  });
  it("la pièce est datée du jour d'établissement et porte la date de prestation, les pénalités restent au gabarit", () => {
    const r = construireDonneesAutofacture({
      ...base,
      apporteur,
      dateEmission: new Date("2026-10-10T10:00:00Z"),
    });
    expect(r.ok && r.data.dateEmission).toContain("10 octobre 2026");
    expect(r.ok && r.data.datePrestation).toContain("12 octobre 2026");
  });
});
