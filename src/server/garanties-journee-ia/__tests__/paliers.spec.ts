import { describe, expect, it } from "vitest";
import { alerteVoulue, CODES_GARANTIE_JI, palierPour, texteAlerte } from "../paliers";

describe("palierPour", () => {
  const AUJ = "2026-12-12"; // samedi : les paliers tombent aussi le week-end
  it.each([
    ["2026-12-20", null],
    ["2026-12-18", null],
    ["2026-12-17", "J-5"],
    ["2026-12-15", "J-5"],
    ["2026-12-14", "J-2"],
    ["2026-12-13", "J-2"],
    ["2026-12-12", "J0"],
    ["2026-12-11", "depassee"],
    ["2026-01-01", "depassee"],
  ])("%s → %s", (date, palier) => {
    expect(palierPour(date, AUJ)).toBe(palier);
  });
});

describe("alerteVoulue", () => {
  const AUJ = "2026-12-12";
  it("niveaux : J-5 info, J-2 et J0 important, dépassée critique", () => {
    const n = (date: string) =>
      alerteVoulue("d1", "ACME", { type: "rapport", date, faite: false }, AUJ)?.niveau;
    expect(n("2026-12-17")).toBe("info");
    expect(n("2026-12-14")).toBe("important");
    expect(n("2026-12-12")).toBe("important");
    expect(n("2026-12-01")).toBe("critique");
  });
  it("code par échéance ; aucune alerte pour fin_demande, une échéance faite ou lointaine", () => {
    expect(alerteVoulue("d", "A", { type: "reponse", date: AUJ, faite: false }, AUJ)?.code).toBe(
      "garantie_ji_reponse",
    );
    expect(alerteVoulue("d", "A", { type: "virement", date: AUJ, faite: false }, AUJ)?.code).toBe(
      "garantie_ji_remboursement",
    );
    expect(
      alerteVoulue("d", "A", { type: "fin_demande", date: AUJ, faite: false }, AUJ),
    ).toBeNull();
    expect(alerteVoulue("d", "A", { type: "rapport", date: AUJ, faite: true }, AUJ)).toBeNull();
    expect(
      alerteVoulue("d", "A", { type: "rapport", date: "2027-01-30", faite: false }, AUJ),
    ).toBeNull();
  });
  it("les trois codes émis sont exactement ceux du catalogue attendu", () => {
    expect([...CODES_GARANTIE_JI].sort()).toEqual([
      "garantie_ji_rapport",
      "garantie_ji_remboursement",
      "garantie_ji_reponse",
    ]);
  });
});

describe("texteAlerte", () => {
  it("J0 de la réponse : « sans réponse écrite aujourd'hui, la demande sera réputée acceptée »", () => {
    expect(texteAlerte("reponse", "J0", "2026-12-12", "ACME").message).toContain(
      "Sans réponse écrite aujourd'hui, la demande sera réputée acceptée.",
    );
  });
  it("dépassée : réputée acceptée, virement dû", () => {
    expect(texteAlerte("reponse", "depassee", "2026-12-01", "ACME").message).toContain(
      "réputée acceptée : le virement est dû",
    );
  });
  it("demande hors délai : aucune acceptation tacite, Will tranche (rembourser, refuser ou avoir)", () => {
    for (const palier of ["J0", "depassee"] as const) {
      const m = texteAlerte("reponse", palier, "2026-12-12", "ACME", true).message;
      expect(m).toContain("aucune acceptation tacite");
      expect(m).toContain("rembourser, refuser ou offrir un avoir");
      expect(m).not.toContain("réputée acceptée");
      expect(m).not.toContain("virement est dû");
    }
  });
  it("alerteVoulue propage « à trancher » de l'échéance", () => {
    const v = alerteVoulue(
      "d",
      "A",
      { type: "reponse", date: "2026-12-12", faite: false, aTrancher: true },
      "2026-12-12",
    );
    expect(v?.message).toContain("aucune acceptation tacite");
  });
  it("stable : même palier, mêmes textes (aucun compteur de jours qui changerait chaque matin)", () => {
    expect(texteAlerte("rapport", "depassee", "2026-12-01", "ACME")).toEqual(
      texteAlerte("rapport", "depassee", "2026-12-01", "ACME"),
    );
    expect(texteAlerte("rapport", "depassee", "2026-12-01", "ACME").message).not.toMatch(
      /\d+ jours? de retard/,
    );
  });
});
