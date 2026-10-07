import { describe, expect, it } from "vitest";

import {
  ajouterMois,
  calculerCommission,
  commandeCouverte,
  dateConfirmationTacite,
  etatVigilance,
  finDeProtection,
  ibanValide,
  jugerAdmission,
  manquesPourSigner,
  motifDeProlongation,
  normaliserNaf,
  partParrainage,
  sirenValide,
} from "../regles";

const d = (s: string) => new Date(`${s}T10:00:00.000Z`);

describe("réseau d'apporteurs — règles du contrat v2", () => {
  it("6 mois de protection, au même quantième, et fin de mois tenue", () => {
    expect(finDeProtection(d("2026-01-15")).toISOString().slice(0, 10)).toBe("2026-07-15");
    expect(ajouterMois(d("2026-08-31"), 6).toISOString().slice(0, 10)).toBe("2027-02-28");
  });

  it("confirmation réputée acquise 30 jours après le premier message", () => {
    expect(dateConfirmationTacite(d("2026-10-05")).toISOString().slice(0, 10)).toBe("2026-11-04");
  });

  it("prolongation : une seule fois, sur des faits de la Société", () => {
    const terme = d("2026-06-30");
    expect(
      motifDeProlongation({
        deja: false,
        devisEnCours: true,
        dernierEchangeAt: null,
        financementEnCours: false,
        terme,
      }),
    ).toBe("devis_en_cours");
    expect(
      motifDeProlongation({
        deja: false,
        devisEnCours: false,
        dernierEchangeAt: d("2026-06-15"),
        financementEnCours: false,
        terme,
      }),
    ).toBe("echange_recent");
    expect(
      motifDeProlongation({
        deja: false,
        devisEnCours: false,
        dernierEchangeAt: d("2026-05-15"),
        financementEnCours: false,
        terme,
      }),
    ).toBeNull();
    expect(
      motifDeProlongation({
        deja: false,
        devisEnCours: false,
        dernierEchangeAt: null,
        financementEnCours: true,
        terme,
      }),
    ).toBe("financement_en_cours");
    expect(
      motifDeProlongation({
        deja: true,
        devisEnCours: true,
        dernierEchangeAt: null,
        financementEnCours: true,
        terme,
      }),
    ).toBeNull();
  });

  it("une commande n'est couverte qu'entre la présentation et la fin de la protection, une fois confirmée", () => {
    const base = { recueAt: d("2026-01-10"), protegeeJusquAt: d("2026-07-15") };
    expect(commandeCouverte({ ...base, confirmee: true, signeeAt: d("2026-05-01") })).toBe(true);
    expect(commandeCouverte({ ...base, confirmee: true, signeeAt: d("2026-08-01") })).toBe(false);
    expect(commandeCouverte({ ...base, confirmee: false, signeeAt: d("2026-05-01") })).toBe(false);
  });

  it("formation : forfait réduit au prorata de la remise, jamais augmenté", () => {
    expect(
      calculerCommission({
        activite: "formation",
        palier: "formation-generale-1j",
        factureHtCents: 152_000,
      }),
    ).toEqual({
      statut: "calculee",
      montantCents: 40_000,
      palier: "formation-generale-1j",
      prixPublicCents: 190_000,
    });
    const plusCher = calculerCommission({
      activite: "formation",
      palier: "formation-secteur-2j",
      factureHtCents: 500_000,
    });
    expect(plusCher.statut === "calculee" && plusCher.montantCents).toBe(100_000);
    expect(
      calculerCommission({ activite: "formation", palier: null, factureHtCents: 190_000 }),
    ).toEqual({ statut: "a_qualifier" });
  });

  it("audit 30 %, intégration 15 %, 1-to-1 30 %, web aucune", () => {
    const m = (activite: "audit" | "implementation" | "un_a_un") => {
      const r = calculerCommission({ activite, factureHtCents: 190_000 });
      return r.statut === "calculee" ? r.montantCents : -1;
    };
    expect(m("audit")).toBe(57_000);
    expect(m("implementation")).toBe(28_500);
    expect(m("un_a_un")).toBe(57_000);
    expect(calculerCommission({ activite: "site_web", factureHtCents: 100_000 })).toEqual({
      statut: "aucune",
    });
    expect(calculerCommission({ activite: null, factureHtCents: 100_000 })).toEqual({
      statut: "a_qualifier",
    });
  });

  it("parrainage : 10 % pendant les 6 mois qui suivent la signature du filleul", () => {
    const filleulSigneAt = d("2026-01-01");
    expect(
      partParrainage({
        commissionFilleulCents: 50_000,
        filleulSigneAt,
        commandeSigneeAt: d("2026-06-30"),
      }),
    ).toBe(5_000);
    expect(
      partParrainage({
        commissionFilleulCents: 50_000,
        filleulSigneAt,
        commandeSigneeAt: d("2026-07-02"),
      }),
    ).toBe(0);
  });

  it("vigilance : demandée à l'approche de 5 000 €, seul le versement au-delà attend", () => {
    expect(
      etatVigilance({ cumulCents: 300_000, nouvelleCents: 50_000, piecesValides: false }),
    ).toEqual({ demander: false, attendre: false });
    expect(
      etatVigilance({ cumulCents: 380_000, nouvelleCents: 100_000, piecesValides: false }),
    ).toEqual({ demander: true, attendre: false });
    expect(
      etatVigilance({ cumulCents: 480_000, nouvelleCents: 50_000, piecesValides: false }),
    ).toEqual({ demander: true, attendre: true });
    expect(
      etatVigilance({ cumulCents: 480_000, nouvelleCents: 50_000, piecesValides: true }),
    ).toEqual({ demander: false, attendre: false });
  });

  it("admission : refus nommés, professions à revoir signalées", () => {
    expect(jugerAdmission({ active: true, francaise: true, naf: "70.22Z" })).toEqual({
      ok: true,
      aRevoir: false,
    });
    expect(jugerAdmission({ active: false, francaise: true, naf: "70.22Z" })).toEqual({
      ok: false,
      motif: "siren_inactif",
    });
    expect(jugerAdmission({ active: true, francaise: true, naf: "6910Z" })).toEqual({
      ok: false,
      motif: "profession_exclue",
    });
    expect(jugerAdmission({ active: true, francaise: true, naf: "69.20Z" })).toEqual({
      ok: true,
      aRevoir: true,
    });
    expect(normaliserNaf("69.20z")).toBe("69.20Z");
  });

  it("contrôles de saisie : SIREN (Luhn) et IBAN (modulo 97)", () => {
    expect(sirenValide("732829320")).toBe(true);
    expect(sirenValide("732829321")).toBe(false);
    expect(ibanValide("FR76 3000 6000 0112 3456 7890 189")).toBe(true);
    expect(ibanValide("FR76 3000 6000 0112 3456 7890 188")).toBe(false);
  });

  it("ce qui manque pour signer", () => {
    expect(
      manquesPourSigner({
        siren: null,
        statutJuridique: null,
        regimeTva: "assujetti",
        numeroTva: null,
        iban: null,
        piecesDeposees: ["rib"],
      }),
    ).toEqual([
      "votre numéro SIREN",
      "votre statut",
      "votre numéro de TVA",
      "votre IBAN",
      "pièce d'identité",
    ]);
    expect(
      manquesPourSigner({
        siren: "732829320",
        statutJuridique: "micro_entrepreneur",
        regimeTva: "franchise_293b",
        numeroTva: null,
        iban: "FR7630006000011234567890189",
        piecesDeposees: ["identite", "rib"],
      }),
    ).toEqual([]);
  });
});

describe("07/10 (ordre de Will) : signature impossible sans SIREN valide", () => {
  it("un SIREN de 9 chiffres à la clé fausse compte comme manquant", async () => {
    const { manquesPourSigner } = await import("../regles");
    const base = {
      statutJuridique: "micro_entrepreneur",
      regimeTva: "franchise_293b" as const,
      numeroTva: null,
      iban: "saisi",
      piecesDeposees: ["identite", "rib"] as const,
    };
    expect(manquesPourSigner({ ...base, siren: "123456789" })).toContain("votre numéro SIREN");
    expect(manquesPourSigner({ ...base, siren: null })).toContain("votre numéro SIREN");
    expect(manquesPourSigner({ ...base, siren: "732829320" })).not.toContain("votre numéro SIREN");
  });
});
