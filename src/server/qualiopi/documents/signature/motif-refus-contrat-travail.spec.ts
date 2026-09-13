// @vitest-environment node

/**
 * Tests — le motif du refus DÉPEND DE QUI LIT.
 *
 * 🔴 Le défaut (recette du 13/09) : un seul texte était rendu aux deux lecteurs,
 * et il était écrit pour l'OPÉRATEUR — « Complétez le paramètre manquant,
 * établissez à nouveau le contrat, puis signez-le. » Le salarié le lisait dans
 * son espace personnel, sur son propre contrat de travail : une consigne qu'il
 * ne peut pas exécuter, qui lui expose un défaut de configuration interne, et
 * qui le laisse croire que c'est à lui d'agir.
 *
 * 🔑 La branche `!habilite` faisait DÉJÀ dépendre son texte du lecteur. Le
 * spécimen était le seul motif à ne pas le faire.
 */

import { describe, it, expect } from "vitest";

import { raisonDuRefus } from "./motif-refus-contrat-travail";

const SALARIE = { pourPartie: "formateur" as const, trainerId: "trn-1" };
const EMPLOYEUR = { pourPartie: "axionia" as const, role: "super_admin" };

describe("spécimen — deux lecteurs, deux textes", () => {
  it("🔴 au SALARIÉ : aucune consigne qu'il ne peut pas exécuter", () => {
    const m = raisonDuRefus({
      estSpecimen: true,
      estTitulaire: true,
      habilite: false,
      lecteur: SALARIE,
    });
    expect(m).toContain("aucune démarche");
    expect(m).toMatch(/ne signez rien/i);
    // ⛔ Les mots du geste INTERNE ne doivent pas lui parvenir.
    expect(m).not.toMatch(/SPÉCIMEN/);
    expect(m).not.toMatch(/convention collective/i);
    expect(m).not.toMatch(/Complétez/i);
  });

  it("🔑 à l'EMPLOYEUR : le geste correctif, nommé", () => {
    // Témoin discriminant. Sans lui, remplacer le texte par celui du salarié
    // dans les deux branches passerait le test ci-dessus, et l'opérateur
    // perdrait la seule phrase qui dit quoi faire.
    const m = raisonDuRefus({
      estSpecimen: true,
      estTitulaire: false,
      habilite: true,
      lecteur: EMPLOYEUR,
    });
    expect(m).toContain("SPÉCIMEN");
    expect(m).toMatch(/convention collective/i);
    expect(m).toMatch(/établissez à nouveau/i);
  });

  it("⚠️ le spécimen passe AVANT « vous avez déjà signé »", () => {
    // L'ordre n'est pas cosmétique : annoncer d'abord « vous avez déjà signé »
    // ferait croire que tout va bien sur un contrat qui n'est pas opposable.
    const m = raisonDuRefus({
      estSpecimen: true,
      estTitulaire: true,
      habilite: true,
      lecteur: SALARIE,
    });
    expect(m).not.toMatch(/déjà signé/i);
  });
});

describe("les autres motifs restent ce qu'ils étaient", () => {
  it("le salarié qui a déjà signé voit sa preuve nommée", () => {
    const m = raisonDuRefus({
      estSpecimen: false,
      estTitulaire: true,
      habilite: false,
      lecteur: SALARIE,
    });
    expect(m).toMatch(/déjà signé/i);
    expect(m).toMatch(/empreinte/i);
  });

  it("un non-habilité apprend QUI peut engager l'organisme", () => {
    const m = raisonDuRefus({
      estSpecimen: false,
      estTitulaire: false,
      habilite: false,
      lecteur: EMPLOYEUR,
    });
    expect(m).toMatch(/administrateur|dirigeant/i);
  });
});
