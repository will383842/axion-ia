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
  it("vingt et une clés, chacune protégée de l'éditeur générique", () => {
    expect(CLES_INTERRUPTEURS_SIGNATURE.map(cleSettingSignature).sort()).toEqual(
      [
        // Lot S2 — affectation et acceptation sûres, livré éteint.
        "formateurs.affectation_sure",
        // Lot S5 — lettre de mission v2, livrée éteinte.
        "formateurs.lettre_v2",
        // Lot L3 — garde de mission aux portes, livrée éteinte.
        "formateurs.garde_mission_portes",
        // Lots L12i et L12h — présentation payée et DAS 2 commun, livrés éteints.
        "formateurs.presentation_payee",
        "formateurs.das2_commun",
        // Lot L14 — fin de collaboration, livrée éteinte.
        "formateurs.fin_collaboration",
        // Lot E (M12) — changement de compte bancaire et d'adresse, livré éteint.
        "formateurs.changement_coordonnees",
        // Lots L11b et L11b-ux — choix du formateur en cartes, livré éteint.
        "formateurs.choix_cartes",
        // Lot L11h — choix suivant et désistement, livrés éteints.
        "formateurs.rang_suivant",
        // Lot L11d — page « Missions », livrée éteinte.
        "formateurs.missions_console",
        // Lots L7b, L9b, L7d — contrat-cadre émis, mise à niveau, nouvelle version, éteints.
        "formateurs.contrat_cadre_emission",
        "formateurs.mise_a_niveau",
        "formateurs.nouvelle_version_contrat",
        "formateurs.suite_contrat_cadre",
        // Lot G2 — bilan de fin de formation du formateur indépendant, livré éteint.
        "formateurs.bilan_fin_formation",
        // Lot 8B — certificat de réalisation créé à la fin de la formation, livré éteint.
        "formateurs.certificat_realisation_auto",
        // Qualiopi ind. 21 — suivi de la qualité pédagogique des intervenants, livré éteint.
        "formateurs.suivi_qualite",
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

  it("la mise à niveau exige le dossier en ligne ; la nouvelle version, les textes validés", () => {
    const etats = etatsParDefaut();
    expect(prealablesManquantsSignature("contrat_cadre_emission", true, etats)).toEqual([]);
    expect(prealablesManquantsSignature("mise_a_niveau", true, etats)).toHaveLength(1);
    expect(
      prealablesManquantsSignature("mise_a_niveau", true, { ...etats, dossier_en_ligne: true }),
    ).toEqual([]);
    expect(prealablesManquantsSignature("nouvelle_version_contrat", true, etats)).toHaveLength(1);
    expect(
      prealablesManquantsSignature("nouvelle_version_contrat", true, {
        ...etats,
        textes_valides: true,
      }),
    ).toEqual([]);
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

describe("correctifs L11b et L11h — préalables du choix en cartes et du rang suivant", () => {
  const etats = etatsParDefaut();
  it("le choix en cartes exige une date de passage au paiement par mission", () => {
    expect(prealablesManquantsSignature("choix_cartes", true, etats)).toHaveLength(1);
    expect(
      prealablesManquantsSignature("choix_cartes", true, {
        ...etats,
        passage_paiement: "2026-12-01",
      }),
    ).toEqual([]);
  });
  it("le rang suivant exige la garde aux portes et l'affectation sûre", () => {
    const sig = etatsSignatureParDefaut();
    const avecTextes = { ...etats, textes_valides: true };
    expect(prealablesManquantsSignature("rang_suivant", true, avecTextes, sig)).toHaveLength(2);
    expect(
      prealablesManquantsSignature("rang_suivant", true, avecTextes, {
        ...sig,
        garde_mission_portes: true,
        affectation_sure: true,
      }),
    ).toEqual([]);
    // États du registre non fournis : le plus strict.
    expect(prealablesManquantsSignature("rang_suivant", true, avecTextes)).toHaveLength(2);
  });
});
