// @vitest-environment node

/** L12d, L12k, L12m — règles pures du virement, de la facture déposée et du brouillon mensuel. */

import { describe, expect, it } from "vitest";

import { controlerFactureDeposee, numeroFactureNormalise } from "../facture-deposee";
import { alerteReleveNonValide, brouillonMensuelAPreparer } from "../releve-mensuel-auto";
import { gardeVirementMission, ibanFin4, type ContexteVirementMission } from "../virement-mission";

const E = "a".repeat(64);
const base: ContexteVirementMission = {
  derniereJournee: "2026-11-05",
  echeance: "2026-12-05",
  aujourdhui: "2026-12-04",
  maintenant: new Date("2026-12-04T10:00:00Z"),
  totalTtcCents: 35_000,
  attestationsValidesJusquau: ["2027-01-31"],
  demandeIbanEnAttente: false,
  dernierChangementIban: null,
  ibanEmpreinteActuelle: E,
  ibanEmpreinteAffichee: E,
  finPourDeces: false,
};

describe("L12d — garde du virement d'un relevé de mission", () => {
  it("tout est en ordre : autorisé, aucun retard", () => {
    expect(gardeVirementMission(base)).toEqual({
      autorise: true,
      motifs: [],
      retard: { joursDeRetard: 0, penalitesCents: 0, indemniteRecouvrementCents: 0 },
    });
  });

  it("S14 : attestation échue à la date de la mission → suspendu ; valide à la mission, échue au paiement (S14b) → libre", () => {
    expect(
      gardeVirementMission({ ...base, attestationsValidesJusquau: ["2026-10-31"] }).motifs,
    ).toEqual(["attestation_urssaf_echue_a_la_mission"]);
    expect(
      gardeVirementMission({ ...base, attestationsValidesJusquau: ["2026-11-20"] }).autorise,
    ).toBe(true);
    expect(gardeVirementMission({ ...base, attestationsValidesJusquau: [] }).autorise).toBe(false);
  });

  it("S17 : demande d'IBAN en attente → « compte bancaire à valider » ; validé il y a moins de 48 h depuis la demande → attendre", () => {
    expect(gardeVirementMission({ ...base, demandeIbanEnAttente: true }).motifs).toEqual([
      "compte_bancaire_a_valider",
    ]);
    const recent = {
      demandeA: new Date("2026-12-03T09:00:00Z"),
      valideA: new Date("2026-12-03T10:00:00Z"),
    };
    expect(gardeVirementMission({ ...base, dernierChangementIban: recent }).motifs).toEqual([
      "nouvel_iban_moins_de_48h",
    ]);
    expect(
      gardeVirementMission({
        ...base,
        dernierChangementIban: recent,
        maintenant: new Date("2026-12-05T09:00:00Z"),
        aujourdhui: "2026-12-05",
      }).autorise,
    ).toBe(true);
  });

  it("empreinte relue au clic différente de celle affichée, ou IBAN absent : refus", () => {
    expect(gardeVirementMission({ ...base, ibanEmpreinteAffichee: "b".repeat(64) }).motifs).toEqual(
      ["iban_change_depuis_l_affichage"],
    );
    expect(gardeVirementMission({ ...base, ibanEmpreinteActuelle: null }).motifs).toEqual([
      "iban_absent",
    ]);
  });

  it("virement après l'échéance : le supplément légal est CALCULÉ pour affichage (40 €, pénalités à la main sans taux BCE)", () => {
    const v = gardeVirementMission({
      ...base,
      aujourdhui: "2026-12-10",
      maintenant: new Date("2026-12-10T10:00:00Z"),
    });
    expect(v.autorise).toBe(true);
    expect(v.retard).toEqual({
      joursDeRetard: 5,
      penalitesCents: null,
      indemniteRecouvrementCents: 4_000,
    });
  });

  it("ne garde que les 4 derniers caractères de l'IBAN", () => {
    expect(ibanFin4("FR76 3000 6000 0112 3456 7890 189")).toBe("0189");
  });
});

describe("L12k — facture déposée", () => {
  const r = { totalTtcCents: 70_000, derniereJournee: "2026-11-06", aujourdhui: "2026-11-20" };
  it("conforme : numéro normalisé, montant égal au dû, date entre la mission et aujourd'hui", () => {
    expect(
      controlerFactureDeposee(
        { numero: " f-001 ", montantTtcCents: 70_000, dateFacture: "2026-11-20" },
        r,
      ),
    ).toEqual({
      conforme: true,
      refus: [],
      numero: "F-001",
    });
    expect(numeroFactureNormalise("  ab-12 ")).toBe("AB-12");
  });
  it("refus : numéro absent, montant différent, date future ou d'avant la mission", () => {
    expect(
      controlerFactureDeposee({ numero: "", montantTtcCents: 70_001, dateFacture: "2026-11-21" }, r)
        .refus,
    ).toEqual(["numero_absent", "montant_non_conforme", "date_future"]);
    expect(
      controlerFactureDeposee(
        { numero: "F", montantTtcCents: 70_000, dateFacture: "2026-11-01" },
        r,
      ).refus,
    ).toEqual(["date_avant_la_mission"]);
  });
});

describe("L12m — brouillon du relevé mensuel (non branché)", () => {
  it("le 1er du mois (Paris) seulement : le mois écoulé ; janvier → décembre de l'année d'avant", () => {
    expect(brouillonMensuelAPreparer(new Date("2026-11-01T07:00:00Z"))).toEqual({
      year: 2026,
      month: 10,
    });
    expect(brouillonMensuelAPreparer(new Date("2026-12-31T23:30:00Z"))).toEqual({
      year: 2026,
      month: 12,
    });
    expect(brouillonMensuelAPreparer(new Date("2027-01-01T08:00:00Z"))).toEqual({
      year: 2026,
      month: 12,
    });
    expect(brouillonMensuelAPreparer(new Date("2026-11-02T08:00:00Z"))).toBeNull();
  });
  it("alerte à J+5 s'il reste un relevé non validé ; rien avant, rien si tout est validé", () => {
    expect(alerteReleveNonValide(new Date("2026-11-05T09:00:00Z"), ["brouillon"])).toBe(false);
    expect(alerteReleveNonValide(new Date("2026-11-06T09:00:00Z"), ["brouillon", "valide"])).toBe(
      true,
    );
    expect(alerteReleveNonValide(new Date("2026-11-06T09:00:00Z"), ["valide", "paye"])).toBe(false);
  });
});
