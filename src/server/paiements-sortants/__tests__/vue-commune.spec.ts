// @vitest-environment node

/**
 * FAC-9 — la vue commune « Virements à faire » et la DAS 2 commune.
 *
 *   · les deux flux sont mis côte à côte, dans l'ordre de la date cible, sans
 *     qu'aucun montant ne change (contre-calcul : la somme de la vue = la somme
 *     des pièces lues) ;
 *   · la date cible est le dernier jour ouvré au plus tard à l'échéance ;
 *   · les flux apporteurs sont lus par LEUR fonction, inchangée (garde statique) ;
 *   · DAS 2 commune : un seul seuil, avoirs déduits, CSV conforme à l'existant.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { STATUTS_RELEVE_DU } from "@/server/qualiopi/remuneration/echeance";
import { PARAMETRES_ARGENT_FORMATEURS } from "@/server/qualiopi/formateurs-independants/argent/parametres";

import { construireDas2Commune, regrouperRelevesPayes } from "../das2";
import { SEUIL_DAS2_COMMUN_CENTS, STATUTS_RELEVE_A_VIRER } from "../parametres";
import { couleurDe, ordonnerVirements, totauxVirements, type VirementLu } from "../virements";

const v = (o: Partial<VirementLu> & Pick<VirementLu, "flux" | "montantCents">): VirementLu => ({
  pieceId: `${o.flux}-${o.montantCents}`,
  beneficiaireId: "b",
  beneficiaire: "Bénéficiaire",
  reference: null,
  emissionAt: new Date("2026-11-01T10:00:00Z"),
  echeance: null,
  ...o,
});

describe("vue commune — ordre, dates cibles, couleurs", () => {
  it("formateurs par date cible, puis apporteurs sans échéance par ancienneté ; montants intacts", () => {
    const lus: VirementLu[] = [
      v({ flux: "apporteur", montantCents: 12_000, emissionAt: new Date("2026-11-20T10:00:00Z") }),
      v({ flux: "formateur", montantCents: 35_000, echeance: "2026-12-05" }), // samedi → 04/12
      v({ flux: "formateur", montantCents: 112_800, echeance: "2026-12-13" }), // dimanche → 11/12
      v({ flux: "apporteur", montantCents: 8_000, emissionAt: new Date("2026-11-02T10:00:00Z") }),
      v({ flux: "formateur", montantCents: 70_000, echeance: "2026-12-26" }), // 25/12 férié → 24/12
    ];
    const vue = ordonnerVirements(lus, "2026-11-30");
    expect(vue.map((x) => [x.flux, x.montantCents, x.dateCible, x.couleur])).toEqual([
      ["formateur", 35_000, "2026-12-04", "orange"],
      ["formateur", 112_800, "2026-12-11", "a_venir"],
      ["formateur", 70_000, "2026-12-24", "a_venir"],
      ["apporteur", 8_000, null, "sans_echeance"],
      ["apporteur", 12_000, null, "sans_echeance"],
    ]);
    // Contre-calcul : la vue ne crée, ne perd ni ne modifie aucun centime.
    const t = totauxVirements(vue);
    expect(t.total).toBe(lus.reduce((s, x) => s + x.montantCents, 0));
    expect(t.parFlux).toEqual({ apporteur: 20_000, formateur: 217_800 });
  });

  it("rouge une fois la date cible passée", () => {
    expect(couleurDe("2026-12-04", "2026-12-05")).toBe("rouge");
    expect(couleurDe("2026-12-04", "2026-11-28")).toBe("a_venir");
    expect(couleurDe(null, "2026-12-05")).toBe("sans_echeance");
    const vue = ordonnerVirements(
      [v({ flux: "formateur", montantCents: 1, echeance: "2026-12-05" })],
      "2026-12-07",
    );
    expect(totauxVirements(vue).enRetard).toBe(1);
  });
});

describe("vue commune — sources uniques", () => {
  it("les statuts « à virer » sont ceux de l'échéance des relevés", () => {
    expect([...STATUTS_RELEVE_A_VIRER].sort()).toEqual([...STATUTS_RELEVE_DU].sort());
  });

  it("le seuil DAS 2 du paiement par mission EST le paramètre commun", () => {
    expect(PARAMETRES_ARGENT_FORMATEURS.seuilDas2Cents).toBe(SEUIL_DAS2_COMMUN_CENTS);
    expect(SEUIL_DAS2_COMMUN_CENTS).toBe(120_000);
  });

  it("les apporteurs sont lus par leurs fonctions existantes ; rien n'est écrit", () => {
    const src = (f: string) =>
      readFileSync(path.join(process.cwd(), "src/server/paiements-sortants", f), "utf8");
    for (const f of ["virements.ts", "das2.ts"]) {
      expect(src(f), f).not.toMatch(
        /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/,
      );
      expect(src(f), f).not.toMatch(/commissionApporteur/);
      expect(src(f), f).not.toMatch(/from "@\/server\/qualiopi/);
    }
    expect(src("virements.ts")).toMatch(/lireVirementsAFaire\(\)/);
    expect(src("das2.ts")).toMatch(/lignesDas2Apporteurs\(annee\)/);
  });
});

describe("DAS 2 commune", () => {
  it("regroupe par bénéficiaire, avoirs déduits ; seuil strict à 1 200 €", () => {
    const lignes = regrouperRelevesPayes([
      {
        beneficiaireId: "f1",
        flux: "formateur",
        beneficiaire: "Ada",
        siret: "12345678900011",
        adresse: null,
        totalTtcCents: 70_000,
      },
      {
        beneficiaireId: "f1",
        flux: "formateur",
        beneficiaire: "Ada",
        siret: "12345678900011",
        adresse: null,
        totalTtcCents: 70_000,
      },
      {
        beneficiaireId: "f1",
        flux: "formateur",
        beneficiaire: "Ada",
        siret: "12345678900011",
        adresse: null,
        totalTtcCents: -17_500,
      },
      {
        beneficiaireId: "f2",
        flux: "formateur",
        beneficiaire: "Bob",
        siret: null,
        adresse: null,
        totalTtcCents: 120_000,
      },
    ]);
    expect(lignes.map((l) => [l.beneficiaire, l.totalCents, l.pieces, l.siren])).toEqual([
      ["Ada", 122_500, 3, "123456789"],
      ["Bob", 120_000, 1, null],
    ]);
    const csv = construireDas2Commune(2026, [
      ...lignes,
      {
        flux: "apporteur",
        beneficiaire: "Zoé",
        denomination: "ZC",
        siren: "987654321",
        siret: null,
        adresse: "1 rue; A",
        totalCents: 300_000,
        pieces: 2,
      },
    ]);
    const rangs = csv.replace("﻿", "").trim().split("\r\n");
    expect(rangs[0]).toBe(
      "annee;flux;beneficiaire;denomination;siren;siret;adresse;montant_verse_eur;nombre_pieces;a_declarer",
    );
    expect(rangs.slice(1)).toEqual([
      '2026;apporteur;Zoé;ZC;987654321;;"1 rue; A";3000,00;2;oui',
      "2026;formateur;Ada;;123456789;12345678900011;;1225,00;3;oui",
      "2026;formateur;Bob;;;;;1200,00;1;non",
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
  });
});
