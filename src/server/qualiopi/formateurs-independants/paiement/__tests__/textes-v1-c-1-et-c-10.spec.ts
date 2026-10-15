// @vitest-environment node

/**
 * Vérification 1, V1-C-1 (décision : GARDER le blocage, ALIGNER les textes).
 *
 * Pendant la vérification d'un changement d'IBAN (au plus tôt 48 h), le virement est
 * BLOQUÉ (ADR 0066, `gardeVirementMission`). Les textes adressés au formateur et à la
 * console ne promettent plus qu'il « continue sur l'ancien compte » : ils disent qu'il
 * est mis en attente, puis versé sur le nouveau compte.
 */

import { describe, expect, it } from "vitest";

import { TEXTES_FORMATEUR } from "@/lib/email/templates/formateur-independant-textes";

import { INTERRUPTEURS_SIGNATURE } from "../../interrupteurs";
import { gardeVirementMission } from "../virement-mission";

describe("V1-C-1 — changement d'IBAN : le texte dit ce que fait le code", () => {
  it("F43 annonce la mise en attente puis le versement sur le nouveau compte", () => {
    const texte = TEXTES_FORMATEUR["formateur-iban-changement"].variantes
      .flatMap((v) => v.paragraphes)
      .join(" ");
    expect(texte).not.toMatch(/ancien compte/);
    expect(texte).toMatch(/mis en attente/);
    expect(texte).toMatch(/nouveau compte/);
    expect(texte).toMatch(/48 heures/);
  });

  it("l'aide de l'interrupteur ne promet plus l'ancien compte", () => {
    const aide = INTERRUPTEURS_SIGNATURE.changement_coordonnees.aide;
    expect(aide).not.toMatch(/ancien compte/);
    expect(aide).toMatch(/mis en attente/);
  });

  it("le code, lui, est inchangé : une demande en attente bloque le virement", () => {
    const v = gardeVirementMission({
      derniereJournee: "2038-07-27",
      echeance: "2038-08-26",
      aujourdhui: "2038-08-03",
      maintenant: new Date("2038-08-03T08:00:00Z"),
      totalTtcCents: 70_000,
      attestationsValidesJusquau: [],
      vigilanceExigible: false,
      demandeIbanEnAttente: true,
      dernierChangementIban: null,
      ibanEmpreinteActuelle: "e1",
      ibanEmpreinteAffichee: "e1",
      finPourDeces: false,
    });
    expect(v.autorise).toBe(false);
    expect(v.motifs).toContain("compte_bancaire_a_valider");
  });
});

describe("V1-C-10 — F35 ne propose plus la feuille papier (reportée)", () => {
  it("le texte de F35 renvoie à l'espace seulement", () => {
    const texte = TEXTES_FORMATEUR["formateur-feuilles-manquantes"].variantes
      .flatMap((v) => v.paragraphes)
      .join(" ");
    expect(texte).not.toMatch(/papier/i);
    expect(texte).toMatch(/depuis votre espace/);
  });
});
