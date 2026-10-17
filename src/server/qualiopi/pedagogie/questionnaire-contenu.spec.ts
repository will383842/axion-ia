import { describe, expect, it } from "vitest";
import {
  CONTENUS_QUESTIONNAIRE,
  contenuDeLaVersion,
  lireContenuStocke,
  versionCourante,
} from "./questionnaire-contenu";
import { empreinteContenu } from "./questionnaire-empreinte";

describe("contenus de questionnaire versionnés", () => {
  it("chaud et froid ont une v2 qui évalue les acquis par objectif", () => {
    for (const type of ["satisfaction_chaud", "satisfaction_froid"] as const) {
      expect(versionCourante(type)).toBe(2);
      const v2 = contenuDeLaVersion(type, 2)!;
      expect(v2.questions.some((q) => q.type === "acquis_objectifs")).toBe(true);
    }
  });

  it("la v1 de chaud/froid reste celle de l'époque : note globale + commentaire", () => {
    for (const type of ["satisfaction_chaud", "satisfaction_froid"] as const) {
      const ids = contenuDeLaVersion(type, 1)!.questions.map((q) => q.id);
      expect(ids).toEqual(["noteGlobale", "commentaire"]);
    }
  });

  it("le positionnement couvre les clés que le portail écrit déjà", () => {
    const ids = contenuDeLaVersion("positionnement", 1)!.questions.map((q) => q.id);
    expect(ids).toEqual([
      "fonction",
      "secteur",
      "outilsUtilises",
      "frequenceUsage",
      "niveauParObjectif",
      "attentes",
      "tacheVisee",
      "besoinAdaptation",
    ]);
  });

  it("aucun contenu ne pose de question sur la précision de santé", () => {
    const tout = JSON.stringify(CONTENUS_QUESTIONNAIRE);
    expect(tout).not.toMatch(/detailAdaptation/);
  });

  it("identifiants de question uniques dans chaque version", () => {
    for (const versions of Object.values(CONTENUS_QUESTIONNAIRE)) {
      for (const c of versions) {
        const ids = c.questions.map((q) => q.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("une version inconnue est refusée", () => {
    expect(contenuDeLaVersion("positionnement", 2)).toBeNull();
    expect(contenuDeLaVersion("satisfaction_chaud", 0)).toBeNull();
  });

  it("l'empreinte est un SHA-256 hexadécimal, stable et sensible au contenu", () => {
    const a = empreinteContenu(contenuDeLaVersion("satisfaction_chaud", 2)!);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(empreinteContenu(contenuDeLaVersion("satisfaction_chaud", 2)!));
    expect(a).not.toBe(empreinteContenu(contenuDeLaVersion("satisfaction_chaud", 1)!));
    // L'ordre des clés ne change pas l'empreinte.
    expect(empreinteContenu({ questions: [{ type: "texte", id: "x", libelle: "Y" }] })).toBe(
      empreinteContenu({ questions: [{ libelle: "Y", id: "x", type: "texte" }] }),
    );
  });
});

describe("lireContenuStocke", () => {
  it("relit un contenu enregistré à l'identique (aller-retour JSON)", () => {
    for (const versions of Object.values(CONTENUS_QUESTIONNAIRE)) {
      for (const c of versions) {
        expect(lireContenuStocke(JSON.parse(JSON.stringify(c)))).toEqual(c);
      }
    }
  });

  it.each([
    null,
    "x",
    [],
    {},
    { questions: [] },
    { questions: [{ id: 1, libelle: "a", type: "texte" }] },
    { questions: [{ id: "a", libelle: "a", type: "inconnu" }] },
    { questions: [{ id: "a", libelle: "a", type: "choix" }] },
  ])("refuse une forme invalide (%j)", (json) => {
    expect(lireContenuStocke(json)).toBeNull();
  });
});
