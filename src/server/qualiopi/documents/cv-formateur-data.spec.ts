/**
 * Tests — cv-formateur-data.ts (fiche formateur, ind. 21).
 *
 * L'enjeu de ces tests n'est pas cosmétique : l'indicateur 21 est à
 * non-conformité MAJEURE même en cas de manquement partiel. Une section
 * « compétences » vide sur la fiche censée les démontrer est un défaut de
 * preuve, pas un défaut d'affichage.
 */

import { describe, it, expect } from "vitest";
import {
  parseDomainesCompetences,
  buildCvFormateurData,
  formatDateFr,
  type TrainerCvSource,
} from "./cv-formateur-data";

const BASE: TrainerCvSource = {
  nom: "Jullin",
  prenom: "Williams",
  email: "contact@axion-ia.com",
  telephone: null,
  statut: "dirigeant",
  cvUrl: null,
  domainesCompetences: [],
  dateEmbauche: null,
  sousTraitantNda: null,
  sousTraitantVerifieAt: null,
};

describe("parseDomainesCompetences", () => {
  it("accepte la forme CHAÎNE (celle réellement en production)", () => {
    const r = parseDomainesCompetences([
      "IA générative",
      "Formation professionnelle",
      "Conformité & AI Act",
    ]);
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual({ domaine: "IA générative", niveauMaitrise: "", verifiedAt: "" });
    expect(r.map((d) => d.domaine)).toContain("Conformité & AI Act");
  });

  it("accepte la forme OBJET documentée au schéma", () => {
    const r = parseDomainesCompetences([
      { domaine: "RAG", niveauMaitrise: "expert", verifiedAt: "2026-01-15T00:00:00.000Z" },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]?.domaine).toBe("RAG");
    expect(r[0]?.niveauMaitrise).toBe("expert");
    expect(r[0]?.verifiedAt).not.toBe("");
  });

  it("accepte un mélange des deux formes", () => {
    const r = parseDomainesCompetences(["IA générative", { domaine: "RAG" }]);
    expect(r.map((d) => d.domaine)).toEqual(["IA générative", "RAG"]);
  });

  it("écarte les entrées vides, nulles et non exploitables", () => {
    const r = parseDomainesCompetences(["", "   ", null, 42, {}, { domaine: "  " }, { autre: 1 }]);
    expect(r).toHaveLength(0);
  });

  it("entrée non tableau → liste vide (jamais une exception)", () => {
    expect(parseDomainesCompetences(null)).toEqual([]);
    expect(parseDomainesCompetences(undefined)).toEqual([]);
    expect(parseDomainesCompetences("IA")).toEqual([]);
    expect(parseDomainesCompetences({ domaine: "IA" })).toEqual([]);
  });
});

describe("formatDateFr", () => {
  it("date absente → chaîne vide", () => {
    expect(formatDateFr(null)).toBe("");
    expect(formatDateFr(undefined)).toBe("");
  });

  it("date présente → non vide", () => {
    expect(formatDateFr(new Date("2026-07-20T10:00:00Z"))).not.toBe("");
  });
});

describe("buildCvFormateurData", () => {
  const MAINTENANT = new Date("2026-07-20T10:00:00Z");

  it("cas réel production : compétences en chaînes → fiche non vide", () => {
    const data = buildCvFormateurData(
      {
        ...BASE,
        domainesCompetences: ["IA générative", "Formation professionnelle", "Conformité & AI Act"],
      },
      ["Bien démarrer avec l'IA", "IA pour les RH"],
      MAINTENANT,
    );
    // C'est l'assertion qui compte : sans tolérance aux chaînes, ce tableau
    // serait vide et la preuve de l'indicateur 21 disparaîtrait du document.
    expect(data.domainesCompetences).toHaveLength(3);
    expect(data.formationsHabilitees).toHaveLength(2);
    expect(data.nom).toBe("Jullin");
    expect(data.statut).toBe("dirigeant");
  });

  it("champs optionnels absents → chaînes vides, jamais null ni undefined", () => {
    const data = buildCvFormateurData(BASE, [], MAINTENANT);
    expect(data.telephone).toBe("");
    expect(data.dateEmbauche).toBe("");
    expect(data.sousTraitantNda).toBe("");
    expect(data.sousTraitantVerifieAt).toBe("");
  });

  it("le champ d'habilitation AFEST a DISPARU de la fiche (bloc retiré le 2026-08-10)", () => {
    // Le 1-to-1 est du conseil, hors Qualiopi : la fiche exportée ne porte
    // plus aucune trace d'habilitation AFEST.
    const data = buildCvFormateurData(BASE, [], MAINTENANT);
    expect(Object.keys(data)).not.toContain("afestHabiliteAt");
  });

  it("cvJoint reflète la présence d'un cvUrl", () => {
    expect(buildCvFormateurData(BASE, [], MAINTENANT).cvJoint).toBe(false);
    expect(
      buildCvFormateurData({ ...BASE, cvUrl: "/api/qualiopi/documents/x" }, [], MAINTENANT).cvJoint,
    ).toBe(true);
  });

  it("la date d'édition est celle injectée (aucun new Date() caché)", () => {
    const data = buildCvFormateurData(BASE, [], MAINTENANT);
    expect(data.dateEdition).toBe(formatDateFr(MAINTENANT));
  });
});
