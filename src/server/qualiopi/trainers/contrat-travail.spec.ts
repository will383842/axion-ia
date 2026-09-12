/**
 * Tests — éligibilité au contrat de travail.
 *
 * 🔑 CE QUI SE TESTE ICI EST UN REFUS. Un contrat de travail incomplet n'est pas
 * « un peu moins bon » : une mention manquante déclenche un régime supplétif
 * toujours plus favorable au salarié, et deux omissions sur un CDD le
 * requalifient en CDI. Les tests qui comptent sont donc ceux qui vérifient que
 * la pièce n'est PAS produite.
 */

import { describe, expect, it } from "vitest";

import {
  motifSpecimenContrat,
  plafondLegalEssaiMois,
  verifierEligibiliteContrat,
  type SalarieContrat,
} from "./contrat-travail";

function salarie(over: Partial<SalarieContrat> = {}): SalarieContrat {
  return {
    statut: "salarie",
    nom: "Roux",
    prenom: "Camille",
    dateNaissance: new Date("1990-04-12T00:00:00.000Z"),
    lieuNaissance: "Grenoble",
    adressePersonnelle: "4 rue des Écoles, 38000 Grenoble",
    dateEmbauche: new Date("2026-10-01T00:00:00.000Z"),
    contratType: "cdi",
    contratPoste: "Formateur en intelligence artificielle",
    contratClassification: "Technicien — niveau C, coefficient 200",
    contratDureeHebdoHeures: 35,
    contratPeriodeEssaiMois: 2,
    contratLieuTravail: "11 Avenue Paul Verlaine, 38100 Grenoble",
    contratDateFin: null,
    contratMotifCdd: null,
    fixeMensuelBrutCents: 200_000,
    ...over,
  };
}

function refusDe(s: SalarieContrat): string[] {
  const v = verifierEligibiliteContrat(s);
  return v.eligible ? [] : [...v.refus];
}

describe("verifierEligibiliteContrat — un CDI complet", () => {
  it("accepte un dossier complet", () => {
    expect(verifierEligibiliteContrat(salarie())).toEqual({ eligible: true });
  });

  it("🔴 REFUSE à un sous-traitant, et dit pourquoi c'est dangereux", () => {
    // Établir un contrat de travail à un indépendant créerait de toutes pièces
    // le lien de subordination que tout le domaine s'emploie à ne pas avoir.
    const refus = refusDe(salarie({ statut: "sous_traitant" }));
    expect(refus).toContain("pas_un_salarie");
  });

  it("refuse à un dirigeant — mandat social, pas contrat de travail", () => {
    expect(refusDe(salarie({ statut: "dirigeant" }))).toContain("pas_un_salarie");
  });

  it("🔴 rend TOUS les motifs à la fois, pas le premier", () => {
    // Sur un contrat de travail, chaque mention manquante a une conséquence
    // propre : les découvrir une par une fait franchir quatre obstacles en
    // quatre jours au lieu d'un.
    const refus = refusDe(
      salarie({
        contratPoste: null,
        contratClassification: "  ",
        contratLieuTravail: null,
        fixeMensuelBrutCents: null,
      }),
    );
    expect(refus).toEqual(
      expect.arrayContaining([
        "poste_absent",
        "classification_absente",
        "lieu_travail_absent",
        "remuneration_absente",
      ]),
    );
  });

  it("🔑 la DURÉE manquante est refusée — un temps partiel muet est présumé plein", () => {
    // Art. L.3123-6 : un contrat à temps partiel qui n'énonce pas la durée est
    // présumé à temps complet, et c'est à l'employeur de prouver le contraire.
    // L'omission ne crée donc pas un flou : elle crée une dette.
    expect(refusDe(salarie({ contratDureeHebdoHeures: null }))).toContain("duree_absente");
    expect(refusDe(salarie({ contratDureeHebdoHeures: 0 }))).toContain("duree_absente");
  });

  it("refuse une identité incomplète", () => {
    expect(refusDe(salarie({ dateNaissance: null }))).toContain("identite_incomplete");
    expect(refusDe(salarie({ adressePersonnelle: " " }))).toContain("identite_incomplete");
  });
});

describe("le CDD, et les deux omissions qui le requalifient", () => {
  const cdd = (over: Partial<SalarieContrat> = {}) =>
    salarie({
      contratType: "cdd",
      contratDateFin: new Date("2027-03-31T00:00:00.000Z"),
      contratMotifCdd: "Accroissement temporaire d'activité — déploiement du catalogue IA.",
      ...over,
    });

  it("accepte un CDD avec terme et motif", () => {
    expect(verifierEligibiliteContrat(cdd())).toEqual({ eligible: true });
  });

  it("🔴 REFUSE un CDD sans terme — il serait réputé à durée indéterminée", () => {
    expect(refusDe(cdd({ contratDateFin: null }))).toContain("cdd_sans_terme");
  });

  it("🔴 REFUSE un CDD sans motif — requalification en CDI", () => {
    expect(refusDe(cdd({ contratMotifCdd: "   " }))).toContain("cdd_sans_motif");
  });

  it("refuse un terme antérieur à l'entrée en fonction", () => {
    expect(refusDe(cdd({ contratDateFin: new Date("2026-09-01T00:00:00.000Z") }))).toContain(
      "cdd_terme_avant_debut",
    );
  });

  it("🔑 CONTRE-TÉMOIN : un CDI n'a PAS besoin de terme ni de motif", () => {
    // Sans lui, les trois refus ci-dessus resteraient verts si la règle exigeait
    // un terme de TOUT LE MONDE — on mesurerait une exigence générale au lieu
    // d'une exigence propre au CDD.
    expect(
      verifierEligibiliteContrat(salarie({ contratDateFin: null, contratMotifCdd: null })),
    ).toEqual({ eligible: true });
  });
});

describe("le SPÉCIMEN, quand la convention collective manque", () => {
  it("🔴 sans convention, la pièce est marquée et le motif est écrit", () => {
    const motif = motifSpecimenContrat(null);
    expect(motif).not.toBeNull();
    expect(motif).toMatch(/classification/i);
  });

  it("un libellé vide vaut absence", () => {
    expect(motifSpecimenContrat({ libelle: "  ", idcc: "1516" })).not.toBeNull();
  });

  it("avec convention renseignée, aucun marquage", () => {
    expect(
      motifSpecimenContrat({
        libelle: "Convention collective nationale des organismes de formation",
        idcc: "1516",
      }),
    ).toBeNull();
  });
});

describe("plafondLegalEssaiMois", () => {
  it("rend le plafond LÉGAL par catégorie", () => {
    expect(plafondLegalEssaiMois("Cadre — position 2.1")).toBe(4);
    expect(plafondLegalEssaiMois("Technicien niveau C")).toBe(3);
    expect(plafondLegalEssaiMois("Employé niveau B")).toBe(2);
  });

  it("🔑 rend `null` quand la classification ne permet pas de trancher", () => {
    // Mieux vaut ne rien dire que se tromper de catégorie : une période d'essai
    // trop longue est nulle, et le salarié réputé confirmé depuis le départ.
    expect(plafondLegalEssaiMois("Niveau 3, coefficient 210")).toBeNull();
    expect(plafondLegalEssaiMois(null)).toBeNull();
    expect(plafondLegalEssaiMois("   ")).toBeNull();
  });
});
