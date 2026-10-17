import { describe, expect, it } from "vitest";
import { conventionSigneePourInscription, type PieceContractuelle } from "./convention-signee";

const piece = (p: Partial<PieceContractuelle> = {}): PieceContractuelle => ({
  type: "convention",
  statutSignature: "signee",
  annuleeAt: null,
  clientId: null,
  traineeId: null,
  ...p,
});
const inscription = { traineeId: "t1", clientId: null };

describe("positionnement bloqué sans convention signée", () => {
  it("aucune pièce, pièce partielle, en attente ou annulée : bloqué", () => {
    expect(conventionSigneePourInscription([], inscription)).toBe(false);
    expect(
      conventionSigneePourInscription([piece({ statutSignature: "partielle" })], inscription),
    ).toBe(false);
    expect(
      conventionSigneePourInscription([piece({ statutSignature: "en_attente" })], inscription),
    ).toBe(false);
    expect(conventionSigneePourInscription([piece({ annuleeAt: new Date() })], inscription)).toBe(
      false,
    );
  });

  it("une autre pièce signée (devis, programme) ne vaut pas convention", () => {
    expect(conventionSigneePourInscription([piece({ type: "programme" })], inscription)).toBe(
      false,
    );
  });

  it("convention, convention tripartite ou contrat signés : libéré", () => {
    for (const type of ["convention", "convention_tripartite", "contrat"]) {
      expect(conventionSigneePourInscription([piece({ type })], inscription), type).toBe(true);
    }
  });

  it("pièce nominative ou d'une autre entreprise : ne couvre pas cette inscription", () => {
    expect(conventionSigneePourInscription([piece({ traineeId: "t2" })], inscription)).toBe(false);
    expect(conventionSigneePourInscription([piece({ traineeId: "t1" })], inscription)).toBe(true);
    expect(
      conventionSigneePourInscription([piece({ clientId: "c2" })], {
        traineeId: "t1",
        clientId: "c1",
      }),
    ).toBe(false);
    expect(
      conventionSigneePourInscription([piece({ clientId: "c1" })], {
        traineeId: "t1",
        clientId: "c1",
      }),
    ).toBe(true);
    // Intra : la convention porte le client de la session, l'inscription n'en a pas.
    expect(conventionSigneePourInscription([piece({ clientId: "c1" })], inscription)).toBe(true);
  });
});
