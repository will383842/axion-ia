import { describe, expect, it } from "vitest";
import {
  eurosEnCentimes,
  PLAFOND_AVOIR_HT_CENTS,
  refusDecision,
  refusDemande,
  refusVirement,
  verifierMontantAvoir,
} from "../regles";

const d = { dateJournee: "2026-12-01", rapportRemisLe: "2026-12-03", demandeRecueLe: "2026-12-10" };

describe("refusDecision", () => {
  it("accepte un remboursement après la demande", () => {
    expect(refusDecision(d, { decision: "remboursement", decisionLe: "2026-12-12" })).toBeNull();
  });
  it("refuse sans demande reçue, pour les trois décisions", () => {
    for (const decision of ["remboursement", "refus", "avoir"] as const) {
      expect(
        refusDecision(
          { ...d, demandeRecueLe: null },
          { decision, decisionLe: "2026-12-12", motif: "Motif suffisamment long" },
        ),
      ).toMatch(/demande/);
    }
  });
  it("accepte un avoir sans note, et les trois décisions sur une demande hors délai", () => {
    const horsDelai = { ...d, demandeRecueLe: "2027-02-20" };
    expect(refusDecision(horsDelai, { decision: "avoir", decisionLe: "2027-02-22" })).toBeNull();
    expect(
      refusDecision(horsDelai, { decision: "remboursement", decisionLe: "2027-02-22" }),
    ).toBeNull();
    expect(
      refusDecision(horsDelai, {
        decision: "refus",
        decisionLe: "2027-02-22",
        motif: "Demande hors délai, refusée",
      }),
    ).toBeNull();
  });
  it("refuse une décision antérieure à la demande", () => {
    expect(refusDecision(d, { decision: "remboursement", decisionLe: "2026-12-09" })).toMatch(
      /précéder/,
    );
  });
  it("exige un motif pour un refus", () => {
    expect(
      refusDecision(d, { decision: "refus", decisionLe: "2026-12-12", motif: "court" }),
    ).toMatch(/motif/);
    expect(
      refusDecision(d, {
        decision: "refus",
        decisionLe: "2026-12-12",
        motif: "Seuil atteint, total constaté 6 000 €",
      }),
    ).toBeNull();
  });
  it("verrouille après le virement", () => {
    expect(
      refusDecision(
        { ...d, virementLe: "2026-12-20" },
        { decision: "refus", decisionLe: "2026-12-12", motif: "Seuil atteint ici" },
      ),
    ).toMatch(/virement/);
  });
});

describe("refusVirement", () => {
  it("dû après une décision de remboursement", () => {
    expect(
      refusVirement(
        { ...d, decision: "remboursement", decisionLe: "2026-12-12" },
        "2026-12-20",
        "2026-12-21",
      ),
    ).toBeNull();
  });
  it("dû si la demande est réputée acceptée (aucune décision, 15 j dépassés)", () => {
    expect(refusVirement(d, "2027-01-05", "2027-01-05")).toBeNull();
  });
  it("jamais dû sans décision ni acceptation tacite, ni après un refus", () => {
    expect(refusVirement(d, "2026-12-15", "2026-12-15")).toMatch(/Aucun remboursement/);
    expect(
      refusVirement(
        { ...d, decision: "refus", decisionLe: "2026-12-12" },
        "2026-12-15",
        "2026-12-15",
      ),
    ).toMatch(/Aucun remboursement/);
  });
  it("refuse un virement antérieur à la décision", () => {
    expect(
      refusVirement(
        { ...d, decision: "remboursement", decisionLe: "2026-12-12" },
        "2026-12-11",
        "2026-12-21",
      ),
    ).toMatch(/précéder/);
  });
});

describe("refusDemande / eurosEnCentimes", () => {
  it("la demande suppose le rapport remis, et ne le précède pas", () => {
    expect(refusDemande({ dateJournee: "2026-12-01" }, "2026-12-10")).toMatch(/rapport/);
    expect(refusDemande(d, "2026-12-02")).toMatch(/précéder/);
    expect(refusDemande(d, "2026-12-10")).toBeNull();
    expect(refusDemande(d, null)).toBeNull();
  });
  it("convertit les euros en centimes entiers", () => {
    expect(eurosEnCentimes("1 234,50")).toBe(123450);
    expect(eurosEnCentimes("0.1")).toBe(10);
    expect(eurosEnCentimes("19.999")).toBeNull();
    expect(eurosEnCentimes("abc")).toBeNull();
    expect(eurosEnCentimes("-5")).toBeNull();
  });
});

describe("avoir et demande hors délai", () => {
  it("plafonne l'avoir à 4 470 € HT", () => {
    expect(PLAFOND_AVOIR_HT_CENTS).toBe(447_000);
    expect(verifierMontantAvoir(447_000)).toEqual({ ok: true, cents: 447_000 });
    expect(verifierMontantAvoir(447_001).ok).toBe(false);
    expect(verifierMontantAvoir(0).ok).toBe(false);
    expect(verifierMontantAvoir(null).ok).toBe(false);
  });
  it("hors délai : jamais de virement dû sans décision de remboursement", () => {
    const h = {
      dateJournee: "2026-12-01",
      rapportRemisLe: "2026-12-03",
      demandeRecueLe: "2027-02-20",
    };
    expect(refusVirement(h, "2027-04-01", "2027-04-01")).toMatch(/Aucun remboursement/);
    expect(
      refusVirement(
        { ...h, decision: "avoir", decisionLe: "2027-02-22" },
        "2027-03-01",
        "2027-03-01",
      ),
    ).toMatch(/Aucun remboursement/);
    expect(
      refusVirement(
        { ...h, decision: "remboursement", decisionLe: "2027-02-22" },
        "2027-03-01",
        "2027-03-01",
      ),
    ).toBeNull();
  });
});
