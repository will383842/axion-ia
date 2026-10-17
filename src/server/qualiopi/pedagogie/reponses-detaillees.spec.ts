import { describe, expect, it } from "vitest";
import { contenuDeLaVersion } from "./questionnaire-contenu";
import { detaillerReponses } from "./reponses-detaillees";

const OBJ = ["Rédiger un prompt", "Vérifier une réponse"];

describe("réponses lues QUESTION PAR QUESTION (O4)", () => {
  it("chaud v2 : chaque question, avec son libellé et sa réponse lisible", () => {
    const l = detaillerReponses({
      type: "satisfaction_chaud",
      contenu: contenuDeLaVersion("satisfaction_chaud", 2),
      reponses: {
        noteContenu: 4,
        noteFormateur: 5,
        noteOrganisation: 3,
        acquisParObjectif: { "Rédiger un prompt": 3, "Vérifier une réponse": 2 },
        commentaire: "Très utile.",
      },
      noteGlobale: 4,
      objectifs: OBJ,
    });
    const par = Object.fromEntries(l.map((x) => [x.id, x]));
    expect(par["noteGlobale"]!.reponse).toBe("4 / 5");
    expect(par["noteContenu"]!.libelle).toMatch(/contenu/);
    expect(par["noteContenu"]!.reponse).toBe("4 / 5");
    expect(par["acquisParObjectif"]!.lignes).toEqual([
      { libelle: "Rédiger un prompt", reponse: "Je maîtrise" },
      { libelle: "Vérifier une réponse", reponse: "Quelques notions" },
    ]);
    expect(par["commentaire"]!.reponse).toBe("Très utile.");
  });

  it("une question sans réponse se lit « Non renseigné », jamais 0 ni « non »", () => {
    const l = detaillerReponses({
      type: "satisfaction_chaud",
      contenu: contenuDeLaVersion("satisfaction_chaud", 2),
      reponses: {},
      noteGlobale: null,
      objectifs: OBJ,
    });
    expect(l.every((x) => x.reponse === null || x.lignes !== undefined)).toBe(true);
    expect(l.find((x) => x.id === "noteContenu")!.reponse).toBeNull();
    // Les objectifs restent listés, non renseignés.
    expect(l.find((x) => x.id === "acquisParObjectif")!.lignes!.map((x) => x.reponse)).toEqual([
      null,
      null,
    ]);
  });

  it("v1 (envoi antérieur au versionnage) : lu avec les questions de l'époque", () => {
    const l = detaillerReponses({
      type: "satisfaction_froid",
      contenu: contenuDeLaVersion("satisfaction_froid", 1),
      reponses: { commentaire: "Ok" },
      noteGlobale: 3,
      objectifs: OBJ,
    });
    expect(l.map((x) => x.id)).toEqual(["noteGlobale", "commentaire"]);
  });

  it("sans version (contenu null) : repli sur la version 1 du type", () => {
    const l = detaillerReponses({
      type: "positionnement",
      contenu: null,
      reponses: { fonction: "DAF", besoinAdaptation: false },
      noteGlobale: null,
      objectifs: OBJ,
    });
    expect(l.find((x) => x.id === "fonction")!.reponse).toBe("DAF");
    expect(l.find((x) => x.id === "besoinAdaptation")!.reponse).toBe("Non");
  });

  it("une réponse hors barème n'est pas inventée", () => {
    const l = detaillerReponses({
      type: "satisfaction_chaud",
      contenu: contenuDeLaVersion("satisfaction_chaud", 2),
      reponses: { noteContenu: 9, acquisParObjectif: { "Rédiger un prompt": 7 } },
      noteGlobale: null,
      objectifs: OBJ,
    });
    expect(l.find((x) => x.id === "noteContenu")!.reponse).toBeNull();
    expect(l.find((x) => x.id === "acquisParObjectif")!.lignes![0]!.reponse).toBeNull();
  });

  it("🔴 ne restitue JAMAIS la précision de santé, ni en clair ni chiffrée", () => {
    const l = detaillerReponses({
      type: "positionnement",
      contenu: contenuDeLaVersion("positionnement", 1),
      reponses: {
        besoinAdaptation: true,
        detailAdaptation: "dyslexie sévère",
        detailAdaptationChiffre: "enc:v1:abc",
      },
      noteGlobale: null,
      objectifs: OBJ,
    });
    const sortie = JSON.stringify(l);
    expect(sortie).not.toContain("dyslexie");
    expect(sortie).not.toContain("enc:v1");
    expect(l.find((x) => x.id === "besoinAdaptation")!.reponse).toBe("Oui");
  });

  it("une valeur textuelle est bornée pour l'affichage", () => {
    const l = detaillerReponses({
      type: "satisfaction_chaud",
      contenu: contenuDeLaVersion("satisfaction_chaud", 1),
      reponses: { commentaire: "x".repeat(5000) },
      noteGlobale: null,
      objectifs: [],
    });
    expect(l.find((x) => x.id === "commentaire")!.reponse!.length).toBeLessThanOrEqual(2001);
  });
});
