import { describe, expect, it } from "vitest";
import { assainirReponses } from "./assainir-reponses";

describe("assainirReponses (chaud / froid v2)", () => {
  it("garde les réponses du contenu et rien d'autre", () => {
    const r = assainirReponses("satisfaction_chaud", 2, {
      noteContenu: 4,
      noteFormateur: 5,
      acquisParObjectif: { "Rédiger un prompt": 3 },
      commentaire: "  Bien.  ",
      detailAdaptation: "ne doit pas passer",
      inconnue: "x",
    });
    expect(r).toEqual({
      noteContenu: 4,
      noteFormateur: 5,
      acquisParObjectif: { "Rédiger un prompt": 3 },
      commentaire: "Bien.",
    });
  });

  it("écarte une note hors barème et un acquis hors 1-3", () => {
    const r = assainirReponses("satisfaction_chaud", 2, {
      noteContenu: 9,
      noteOrganisation: 2.5,
      acquisParObjectif: { A: 4, B: 0, C: 2 },
    });
    expect(r).toEqual({ acquisParObjectif: { C: 2 } });
  });

  it("froid : un choix hors liste est écarté", () => {
    expect(assainirReponses("satisfaction_froid", 2, { miseEnPratique: "Jamais !" })).toEqual({});
    expect(assainirReponses("satisfaction_froid", 2, { miseEnPratique: "Pas encore" })).toEqual({
      miseEnPratique: "Pas encore",
    });
  });

  it("borne le texte et le nombre d'objectifs", () => {
    const acquis = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`O${i}`, 2]));
    const r = assainirReponses("satisfaction_chaud", 2, {
      commentaire: "x".repeat(5000),
      acquisParObjectif: acquis,
    });
    expect((r!["commentaire"] as string).length).toBe(2000);
    expect(Object.keys(r!["acquisParObjectif"] as object)).toHaveLength(50);
  });

  it("entrée qui n'est pas un objet : {}", () => {
    expect(assainirReponses("satisfaction_chaud", 2, null)).toEqual({});
    expect(assainirReponses("satisfaction_chaud", 2, [1, 2])).toEqual({});
  });

  it("version sans contenu connu : renvoie null (l'appelant ne touche à rien)", () => {
    expect(assainirReponses("satisfaction_chaud", 9, { commentaire: "x" })).toBeNull();
  });
});
