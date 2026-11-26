import { describe, expect, it } from "vitest";
import {
  aujourdhuiParis,
  etatEcheance,
  jourFr,
  jourIso,
  lignesDeListe,
  type DossierPourListe,
} from "../presentation";

const AUJ = "2026-12-10";

describe("etatEcheance : couleur ET texte", () => {
  const cas: [string, boolean, string, string][] = [
    ["2026-12-05", false, "rouge", "Dépassée de 5 j"],
    ["2026-12-10", false, "rouge", "Aujourd'hui"],
    ["2026-12-11", false, "orange", "Dans 1 j"],
    ["2026-12-12", false, "orange", "Dans 2 j"],
    ["2026-12-13", false, "jaune", "Dans 3 j"],
    ["2026-12-15", false, "jaune", "Dans 5 j"],
    ["2026-12-16", false, "vert", "Dans 6 j"],
    ["2026-12-05", true, "gris", "Clos"],
  ];
  it.each(cas)("%s (faite=%s) → %s « %s »", (date, faite, niveau, texte) => {
    const e = etatEcheance({ date, faite }, AUJ);
    expect(e.niveau).toBe(niveau);
    expect(e.texte).toBe(texte);
  });
});

describe("lignesDeListe", () => {
  const base: DossierPourListe = { id: "a", clientNom: "ACME", dateJournee: "2026-12-01" };
  it("une ligne par échéance ouverte, triée par date, closes masquées par défaut", () => {
    const l = lignesDeListe(
      [
        { ...base, id: "b", clientNom: "Zeta", dateJournee: "2026-12-07" },
        { ...base, rapportRemisLe: "2026-12-03" },
      ],
      AUJ,
    );
    expect(l.map((x) => `${x.clientNom}:${x.echeance.type}`)).toEqual([
      "Zeta:rapport",
      "ACME:fin_demande",
    ]);
    expect(lignesDeListe([{ ...base, rapportRemisLe: "2026-12-03" }], AUJ, true)).toHaveLength(2);
  });
  it("marque « hors délai » une demande reçue après 30 jours, sans acceptation tacite ni virement", () => {
    const l = lignesDeListe(
      [{ ...base, rapportRemisLe: "2026-12-01", demandeRecueLe: "2027-01-15" }],
      "2027-03-01",
    );
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((x) => x.horsDelai)).toBe(true);
    expect(l.every((x) => !x.reputeeAcceptee)).toBe(true);
    expect(l.some((x) => x.echeance.type === "virement")).toBe(false);
  });
  it("une demande dans le délai n'est pas hors délai", () => {
    const l = lignesDeListe(
      [{ ...base, rapportRemisLe: "2026-12-01", demandeRecueLe: "2026-12-20" }],
      AUJ,
    );
    expect(l.every((x) => !x.horsDelai)).toBe(true);
  });
  it("exclut les dossiers archivés", () => {
    expect(lignesDeListe([{ ...base, archiveLe: "2026-12-02T00:00:00.000Z" }], AUJ)).toEqual([]);
  });
  it("signale la demande réputée acceptée, sans rien écrire", () => {
    const l = lignesDeListe(
      [{ ...base, rapportRemisLe: "2026-12-01", demandeRecueLe: "2026-12-02" }],
      "2026-12-20",
    );
    const reponse = l.find((x) => x.echeance.type === "reponse");
    expect(reponse?.reputeeAcceptee).toBe(true);
    expect(reponse?.etat.texte).toMatch(/^Dépassée/);
    expect(l.some((x) => x.echeance.type === "virement")).toBe(true);
  });
});

describe("dates", () => {
  it("aujourdhuiParis prend le jour de Paris, pas celui d'UTC", () => {
    expect(aujourdhuiParis(new Date("2026-12-09T23:30:00Z"))).toBe("2026-12-10");
    expect(aujourdhuiParis(new Date("2026-07-09T22:30:00Z"))).toBe("2026-07-10");
  });
  it("jourIso / jourFr", () => {
    expect(jourIso(new Date("2026-12-10T00:00:00Z"))).toBe("2026-12-10");
    expect(jourIso(null)).toBeNull();
    expect(jourFr("2026-12-10")).toBe("10/12/2026");
    expect(jourFr(null)).toBe("—");
  });
});
