import { describe, expect, it } from "vitest";
import { eurosEnCentimes, refusDecision, refusDemande, refusVirement } from "../regles";

const d = { dateJournee: "2026-12-01", rapportRemisLe: "2026-12-03", demandeRecueLe: "2026-12-10" };

describe("refusDecision", () => {
  it("accepte un remboursement après la demande", () => {
    expect(refusDecision(d, { decision: "remboursement", decisionLe: "2026-12-12" })).toBeNull();
  });
  it("refuse sans demande reçue (hors non_applicable)", () => {
    expect(
      refusDecision(
        { ...d, demandeRecueLe: null },
        { decision: "remboursement", decisionLe: "2026-12-12" },
      ),
    ).toMatch(/demande/);
    expect(
      refusDecision(
        { ...d, demandeRecueLe: null },
        {
          decision: "non_applicable",
          decisionLe: "2026-12-12",
          motif: "Hors périmètre de la garantie",
        },
      ),
    ).toBeNull();
  });
  it("refuse une décision antérieure à la demande", () => {
    expect(refusDecision(d, { decision: "remboursement", decisionLe: "2026-12-09" })).toMatch(
      /précéder/,
    );
  });
  it("exige un motif hors remboursement", () => {
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
