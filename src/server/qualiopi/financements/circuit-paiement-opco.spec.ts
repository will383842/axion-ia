/**
 * Lot A8c — « il faut que les deux cas fonctionnent » (Williams, 04/10/2026).
 *
 * Depuis la réforme du 1/10/2026, une session financée par un OPCO suit l'un
 * de deux circuits :
 *   · SUBROGATION retenue → l'OPCO paie sa part à l'organisme, l'entreprise le
 *     reste à charge éventuel : deux factures possibles ;
 *   · REMBOURSEMENT → l'entreprise paie TOUT, l'OPCO la rembourse : une seule
 *     facture, à l'entreprise, jamais à l'OPCO.
 *
 * 🔴 Le défaut constaté à l'audit : la page Financement présélectionnait
 * « OPCO » comme destinataire dès que le financement était OPCO, subrogation
 * ou pas — et, sans créance au dossier, l'émission l'acceptait.
 */
import { describe, it, expect } from "vitest";
import {
  circuitPaiementSession,
  destinataireFactureParDefaut,
  refusDestinataireFacture,
  factureOuvreLaTransmissionRemboursement,
} from "./circuit-paiement-opco";

describe("circuitPaiementSession", () => {
  it("OPCO + subrogation retenue → subrogation", () => {
    expect(circuitPaiementSession({ financementType: "opco", opcoSubrogation: true })).toBe(
      "subrogation",
    );
    expect(circuitPaiementSession({ financementType: "mixte", opcoSubrogation: true })).toBe(
      "subrogation",
    );
  });

  it("OPCO sans subrogation → remboursement de l'entreprise", () => {
    expect(circuitPaiementSession({ financementType: "opco", opcoSubrogation: false })).toBe(
      "remboursement",
    );
    expect(circuitPaiementSession({ financementType: "mixte", opcoSubrogation: false })).toBe(
      "remboursement",
    );
  });

  it("hors OPCO → hors_opco, même si une subrogation résiduelle traîne", () => {
    expect(circuitPaiementSession({ financementType: "direct", opcoSubrogation: true })).toBe(
      "hors_opco",
    );
    expect(circuitPaiementSession({ financementType: null, opcoSubrogation: false })).toBe(
      "hors_opco",
    );
    expect(circuitPaiementSession({ financementType: "cpf", opcoSubrogation: false })).toBe(
      "hors_opco",
    );
  });
});

describe("destinataireFactureParDefaut", () => {
  it("subrogation → OPCO", () => {
    expect(destinataireFactureParDefaut({ financementType: "opco", opcoSubrogation: true })).toBe(
      "opco",
    );
  });

  it("🔴 OPCO SANS subrogation → l'ENTREPRISE (c'était « opco »)", () => {
    expect(destinataireFactureParDefaut({ financementType: "opco", opcoSubrogation: false })).toBe(
      "entreprise",
    );
  });

  it("France Travail, CPF et direct gardent leur défaut", () => {
    expect(
      destinataireFactureParDefaut({ financementType: "france_travail", opcoSubrogation: false }),
    ).toBe("france_travail");
    expect(destinataireFactureParDefaut({ financementType: "cpf", opcoSubrogation: false })).toBe(
      "stagiaire",
    );
    expect(
      destinataireFactureParDefaut({ financementType: "direct", opcoSubrogation: false }),
    ).toBe("entreprise");
  });
});

describe("refusDestinataireFacture", () => {
  it("🔴 remboursement : une facture à l'OPCO est refusée, et le refus le dit", () => {
    const refus = refusDestinataireFacture("opco", {
      financementType: "opco",
      opcoSubrogation: false,
    });
    expect(refus).not.toBeNull();
    expect(refus).toContain("l'entreprise");
    expect(refus).toContain("rembourse");
  });

  it("subrogation : facture à l'OPCO admise, à l'entreprise aussi (reste à charge)", () => {
    const s = { financementType: "opco", opcoSubrogation: true };
    expect(refusDestinataireFacture("opco", s)).toBeNull();
    expect(refusDestinataireFacture("entreprise", s)).toBeNull();
  });

  it("remboursement : la facture à l'entreprise est admise", () => {
    expect(
      refusDestinataireFacture("entreprise", { financementType: "opco", opcoSubrogation: false }),
    ).toBeNull();
  });

  it("hors OPCO : une facture à l'OPCO est refusée (aucun OPCO ne doit rien)", () => {
    expect(
      refusDestinataireFacture("opco", { financementType: "direct", opcoSubrogation: false }),
    ).not.toBeNull();
  });

  it("ne se mêle pas des autres financeurs", () => {
    expect(
      refusDestinataireFacture("france_travail", {
        financementType: "france_travail",
        opcoSubrogation: false,
      }),
    ).toBeNull();
  });
});

describe("factureOuvreLaTransmissionRemboursement", () => {
  const base = {
    destinataire: "entreprise" as const,
    subrogation: false,
    avoirDeId: null,
    session: { financementType: "opco", opcoSubrogation: false },
  };

  it("remboursement, facture entreprise soldée → oui", () => {
    expect(factureOuvreLaTransmissionRemboursement(base)).toBe(true);
  });

  it("subrogation → non (l'OPCO est payé par l'organisme, rien à rembourser)", () => {
    expect(
      factureOuvreLaTransmissionRemboursement({
        ...base,
        session: { financementType: "opco", opcoSubrogation: true },
      }),
    ).toBe(false);
  });

  it("facture adressée à l'OPCO → non", () => {
    expect(factureOuvreLaTransmissionRemboursement({ ...base, destinataire: "opco" })).toBe(false);
  });

  it("financement direct → non", () => {
    expect(
      factureOuvreLaTransmissionRemboursement({
        ...base,
        session: { financementType: "direct", opcoSubrogation: false },
      }),
    ).toBe(false);
  });

  it("sans session (facture libre) ou avoir → non", () => {
    expect(factureOuvreLaTransmissionRemboursement({ ...base, session: null })).toBe(false);
    expect(factureOuvreLaTransmissionRemboursement({ ...base, avoirDeId: "x" })).toBe(false);
  });
});
