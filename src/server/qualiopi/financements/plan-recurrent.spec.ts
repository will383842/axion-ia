/**
 * Tests plan-recurrent — calcul PUR de la prochaine génération (clamping fin
 * de mois, périodicités multiples). La génération DB suit les patterns
 * éprouvés (numérotation retry, verrou optimiste) couverts ailleurs.
 */

import { describe, it, expect } from "vitest";
import { calculerProchaineGeneration, dateDepartDansLePasse } from "./facture-libre-pur";

const d = (iso: string) => new Date(iso);

describe("calculerProchaineGeneration", () => {
  it("mensuel : avance d'un mois en gardant le jour", () => {
    expect(calculerProchaineGeneration(d("2026-07-01T00:00:00Z"), 1).toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    );
    expect(calculerProchaineGeneration(d("2026-07-15T09:30:00Z"), 1).toISOString()).toBe(
      "2026-08-15T09:30:00.000Z",
    );
  });

  it("clamp fin de mois : 31 janv. + 1 mois → 28 févr. (pas de dérive vers mars)", () => {
    expect(calculerProchaineGeneration(d("2027-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2027-02-28T00:00:00.000Z",
    );
  });

  it("clamp année bissextile : 31 janv. 2028 + 1 mois → 29 févr. 2028", () => {
    expect(calculerProchaineGeneration(d("2028-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2028-02-29T00:00:00.000Z",
    );
  });

  it("trimestriel : 30 nov. + 3 mois → 28/29 févr. (clamp), 31 oct. + 3 → 31 janv.", () => {
    expect(calculerProchaineGeneration(d("2026-11-30T00:00:00Z"), 3).toISOString()).toBe(
      "2027-02-28T00:00:00.000Z",
    );
    expect(calculerProchaineGeneration(d("2026-10-31T00:00:00Z"), 3).toISOString()).toBe(
      "2027-01-31T00:00:00.000Z",
    );
  });

  it("passage d'année : 15 déc. + 1 mois → 15 janv. de l'année suivante", () => {
    expect(calculerProchaineGeneration(d("2026-12-15T00:00:00Z"), 1).toISOString()).toBe(
      "2027-01-15T00:00:00.000Z",
    );
  });
});

describe("jour d'ancrage (pas de glissement après un mois court)", () => {
  it("🔴 31 janv. mensuel : 28 févr. puis 31 mars (et non 28 mars)", () => {
    const fev = calculerProchaineGeneration(d("2027-01-31T00:00:00Z"), 1, 31);
    expect(fev.toISOString()).toBe("2027-02-28T00:00:00.000Z");
    expect(calculerProchaineGeneration(fev, 1, 31).toISOString()).toBe("2027-03-31T00:00:00.000Z");
  });
  it("🔴 31 janv. trimestriel puis suite : jamais de dérive du jour", () => {
    let cur = d("2027-01-31T00:00:00Z");
    const jours: number[] = [];
    for (let i = 0; i < 6; i++) {
      cur = calculerProchaineGeneration(cur, 1, 31);
      jours.push(cur.getUTCDate());
    }
    expect(jours).toEqual([28, 31, 30, 31, 30, 31]);
  });
  it("sans ancrage : comportement historique inchangé", () => {
    expect(calculerProchaineGeneration(d("2027-02-28T00:00:00Z"), 1).toISOString()).toBe(
      "2027-03-28T00:00:00.000Z",
    );
  });
});

describe("dateDepartDansLePasse", () => {
  const maintenant = d("2027-05-10T15:00:00Z");
  it("jour antérieur : refusé", () => {
    expect(dateDepartDansLePasse(d("2027-05-09T23:00:00Z"), maintenant)).toBe(true);
  });
  it("aujourd'hui (même plus tôt dans la journée) ou futur : accepté", () => {
    expect(dateDepartDansLePasse(d("2027-05-10T00:00:00Z"), maintenant)).toBe(false);
    expect(dateDepartDansLePasse(d("2027-06-01T00:00:00Z"), maintenant)).toBe(false);
  });
});
