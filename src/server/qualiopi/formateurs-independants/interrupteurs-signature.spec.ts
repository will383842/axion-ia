/**
 * Interrupteurs du socle de signature (lot S6a) — registre pur.
 */

import { describe, it, expect } from "vitest";

import {
  CLES_INTERRUPTEURS_SIGNATURE,
  cleSettingSignature,
  estCleProtegee,
  etatsParDefaut,
  etatsSignatureDepuisLignes,
  etatsSignatureParDefaut,
  lireValeurSignature,
  dateAllumageSignature,
  prealablesManquantsSignature,
} from "./interrupteurs";

describe("interrupteurs du socle de signature", () => {
  it("cinq clés, chacune protégée de l'éditeur générique", () => {
    expect(CLES_INTERRUPTEURS_SIGNATURE.map(cleSettingSignature).sort()).toEqual(
      [
        "formateurs.suite_contrat_cadre",
        "signature.alertes_hors_jeton",
        "signature.copie_partielle",
        "signature.exemplaire_captation",
        "signature.exemplaire_contrat_travail",
      ].sort(),
    );
    for (const c of CLES_INTERRUPTEURS_SIGNATURE) {
      expect(estCleProtegee(cleSettingSignature(c))).toBe(true);
    }
    expect(estCleProtegee("Signature.copie_partielle")).toBe(true);
  });

  it("absent ou illisible : ARRÊTÉ", () => {
    expect(Object.values(etatsSignatureParDefaut()).every((v) => v === false)).toBe(true);
    expect(lireValeurSignature(undefined)).toEqual({ valeur: false, lisible: false });
    expect(lireValeurSignature({ actif: "true" })).toEqual({ valeur: false, lisible: false });
    expect(lireValeurSignature([true])).toEqual({ valeur: false, lisible: false });
    expect(lireValeurSignature({ actif: true })).toEqual({ valeur: true, lisible: true });
    expect(etatsSignatureDepuisLignes([])).toEqual(etatsSignatureParDefaut());
    expect(
      etatsSignatureDepuisLignes([
        { key: "signature.copie_partielle", value: { actif: true } },
        { key: "formateurs.suite_contrat_cadre", value: "oui" },
      ]),
    ).toMatchObject({ copie_partielle: true, suite_contrat_cadre: false });
  });

  it("la copie partielle exige la validation des textes ; couper n'exige rien", () => {
    const etats = etatsParDefaut();
    expect(prealablesManquantsSignature("copie_partielle", true, etats)).toHaveLength(1);
    expect(
      prealablesManquantsSignature("copie_partielle", true, { ...etats, textes_valides: true }),
    ).toEqual([]);
    for (const c of CLES_INTERRUPTEURS_SIGNATURE) {
      expect(prealablesManquantsSignature(c, false, etats)).toEqual([]);
    }
  });
});

describe("date d'allumage (`signature.exemplaire_captation`)", () => {
  const MAJ = new Date("2026-10-10T12:00:00Z");
  it("arrêté, absent ou illisible : pas de date", () => {
    expect(dateAllumageSignature(undefined, MAJ)).toBeNull();
    expect(dateAllumageSignature({ actif: false, allumeLe: MAJ.toISOString() }, MAJ)).toBeNull();
    expect(dateAllumageSignature({ actif: "true" }, MAJ)).toBeNull();
  });
  it("allumé : `allumeLe`, sinon la date du réglage", () => {
    expect(
      dateAllumageSignature({ actif: true, allumeLe: "2026-10-09T08:00:00.000Z" }, MAJ),
    ).toEqual(new Date("2026-10-09T08:00:00.000Z"));
    expect(dateAllumageSignature({ actif: true }, MAJ)).toEqual(MAJ);
    expect(dateAllumageSignature({ actif: true, allumeLe: "n'importe" }, MAJ)).toEqual(MAJ);
  });
});
