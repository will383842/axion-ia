import { describe, expect, it } from "vitest";
import {
  DELAI_DEMANDE_JOURS,
  DELAI_REPONSE_JOURS,
  DELAI_VIREMENT_JOURS,
  calculerEcheances,
  demandeHorsDelai,
  estReputeeAcceptee,
} from "../echeances";

describe("constantes (art. 47.10)", () => {
  it("30 / 15 / 30 jours", () => {
    expect([DELAI_DEMANDE_JOURS, DELAI_REPONSE_JOURS, DELAI_VIREMENT_JOURS]).toEqual([30, 15, 30]);
  });
});

describe("calculerEcheances", () => {
  it("sans autre date : seule l'échéance du rapport (lundi 2026-12-01 → 2026-12-15)", () => {
    const r = calculerEcheances({ dateJournee: "2026-12-01" });
    expect(r).toEqual([
      { type: "rapport", date: "2026-12-15", faite: false, libelle: expect.any(String) },
    ]);
    expect(calculerEcheances({ dateJournee: "2026-12-01" })).toHaveLength(1);
  });
  it("journée le 2026-12-18 : rapport le 2027-01-05", () => {
    expect(calculerEcheances({ dateJournee: "2026-12-18" })[0]!.date).toBe("2027-01-05");
  });
  it("rapport remis : fin de demande = remise + 30 j, rapport faite", () => {
    const r = calculerEcheances({ dateJournee: "2026-12-01", rapportRemisLe: "2026-12-10" });
    expect(r.map((e) => [e.type, e.date, e.faite])).toEqual([
      ["rapport", "2026-12-15", true],
      ["fin_demande", "2027-01-09", false],
    ]);
  });
  it("demande reçue : réponse = demande + 15 j, fin_demande faite", () => {
    const r = calculerEcheances({
      dateJournee: "2026-12-01",
      rapportRemisLe: "2026-12-10",
      demandeRecueLe: "2026-12-20",
    });
    expect(r.find((e) => e.type === "fin_demande")!.faite).toBe(true);
    expect(r.find((e) => e.type === "reponse")).toMatchObject({ date: "2027-01-04", faite: false });
    expect(r.find((e) => e.type === "virement")).toBeUndefined();
  });
  it("remboursement décidé : virement = décision + 30 j, faite si virementLe", () => {
    const base = {
      dateJournee: "2026-12-01",
      rapportRemisLe: "2026-12-10",
      demandeRecueLe: "2026-12-20",
      decision: "remboursement" as const,
      decisionLe: "2026-12-28",
    };
    const r = calculerEcheances(base);
    expect(r.find((e) => e.type === "reponse")!.faite).toBe(true);
    expect(r.find((e) => e.type === "virement")).toMatchObject({
      date: "2027-01-27",
      faite: false,
    });
    const paye = calculerEcheances({ ...base, virementLe: "2027-01-20" });
    expect(paye.find((e) => e.type === "virement")!.faite).toBe(true);
  });
  it("refus : pas de virement", () => {
    const r = calculerEcheances({
      dateJournee: "2026-12-01",
      rapportRemisLe: "2026-12-10",
      demandeRecueLe: "2026-12-20",
      decision: "refus",
      decisionLe: "2026-12-28",
    });
    expect(r.find((e) => e.type === "virement")).toBeUndefined();
  });
  it("sans réponse : virement = réponse + 30 j seulement une fois la réponse dépassée", () => {
    const d = {
      dateJournee: "2026-12-01",
      rapportRemisLe: "2026-12-10",
      demandeRecueLe: "2026-12-20",
    };
    expect(calculerEcheances(d, "2027-01-04").find((e) => e.type === "virement")).toBeUndefined();
    expect(calculerEcheances(d, "2027-01-05").find((e) => e.type === "virement")).toMatchObject({
      date: "2027-02-03",
    });
  });
  it("trié par date", () => {
    const r = calculerEcheances({
      dateJournee: "2026-12-01",
      rapportRemisLe: "2026-12-10",
      demandeRecueLe: "2026-12-20",
      decision: "remboursement",
      decisionLe: "2026-12-28",
    });
    const dates = r.map((e) => e.date);
    expect(dates).toEqual([...dates].sort());
    expect(r.map((e) => e.type)).toEqual(["rapport", "reponse", "fin_demande", "virement"]);
  });
});

describe("estReputeeAcceptee", () => {
  const d = {
    dateJournee: "2026-12-01",
    rapportRemisLe: "2026-12-10",
    demandeRecueLe: "2026-12-20",
  };
  it("faux le jour même de l'échéance de réponse, vrai le lendemain", () => {
    expect(estReputeeAcceptee(d, "2027-01-04")).toBe(false);
    expect(estReputeeAcceptee(d, "2027-01-05")).toBe(true);
  });
  it("faux sans demande ou si une décision est datée", () => {
    expect(estReputeeAcceptee({ dateJournee: "2026-12-01" }, "2030-01-01")).toBe(false);
    expect(estReputeeAcceptee({ ...d, decisionLe: "2026-12-30" }, "2030-01-01")).toBe(false);
  });
});

describe("réponse tardive (art. 47.10 f)", () => {
  const d = {
    dateJournee: "2026-12-01",
    rapportRemisLe: "2026-12-10",
    demandeRecueLe: "2026-12-20",
  };
  it("refus daté après l'échéance : réputée acceptée, virement au 2027-02-03, Réponse non faite", () => {
    const t = { ...d, decision: "refus" as const, decisionLe: "2027-01-10" };
    expect(estReputeeAcceptee(t, "2027-01-10")).toBe(true);
    const r = calculerEcheances(t);
    expect(r.find((e) => e.type === "virement")).toMatchObject({ date: "2027-02-03" });
    expect(r.find((e) => e.type === "reponse")!.faite).toBe(false);
  });
  it("remboursement tardif : virement = échéance de réponse + 30 j, pas décision + 30 j", () => {
    const r = calculerEcheances({ ...d, decision: "remboursement", decisionLe: "2027-01-20" });
    expect(r.find((e) => e.type === "virement")).toMatchObject({ date: "2027-02-03" });
  });
  it("réponse à temps : non acceptée, échéance Réponse faite, pas de virement pour un refus", () => {
    const t = { ...d, decision: "refus" as const, decisionLe: "2027-01-03" };
    expect(estReputeeAcceptee(t, "2027-03-01")).toBe(false);
    const r = calculerEcheances(t, "2027-03-01");
    expect(r.find((e) => e.type === "reponse")!.faite).toBe(true);
    expect(r.find((e) => e.type === "virement")).toBeUndefined();
  });
  it("réponse le jour même de l'échéance : à temps", () => {
    expect(estReputeeAcceptee({ ...d, decisionLe: "2027-01-04" }, "2027-03-01")).toBe(false);
  });
});

describe("demandeHorsDelai", () => {
  const base = { dateJournee: "2026-12-01", rapportRemisLe: "2026-12-10" };
  it("vrai si la demande arrive après remise + 30 j (2027-01-09), faux sinon", () => {
    expect(demandeHorsDelai({ ...base, demandeRecueLe: "2027-01-10" })).toBe(true);
    expect(demandeHorsDelai({ ...base, demandeRecueLe: "2027-01-09" })).toBe(false);
    expect(demandeHorsDelai(base)).toBe(false);
  });
  it("porté par l'échéance fin_demande sans changer les dates", () => {
    const r = calculerEcheances({ ...base, demandeRecueLe: "2027-01-10" });
    const f = r.find((e) => e.type === "fin_demande")!;
    expect(f).toMatchObject({ date: "2027-01-09", demandeHorsDelai: true });
    expect(r.find((e) => e.type === "reponse")!.date).toBe("2027-01-25");
  });
});
