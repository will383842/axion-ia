import { describe, expect, it } from "vitest";

import { lireReponseQuestionnaire } from "../reponse-questionnaire";

describe("lireReponseQuestionnaire", () => {
  it("lit une réponse complète, attestation comprise", () => {
    const r = lireReponseQuestionnaire({
      commun: {
        prenom: "Julie",
        intitule: "Développeuse",
        presentation: "Texte",
        langues: ["français", "anglais"],
        lieu: { citySlug: "lyon" },
        apport: "Un projet",
      },
      categorie: { exemple: "Un cas concret", vide: "  " },
      consentements: { photo: true, linkedin: false },
      attestation: { version: "team-attestation-v1", at: "2026-11-20T10:00:00.000Z" },
    });
    expect(r.prenom).toBe("Julie");
    expect(r.langues).toEqual(["français", "anglais"]);
    expect(r.lieu).toBe("lyon");
    expect(r.categorie).toEqual([["exemple", "Un cas concret"]]);
    expect(r.consentements).toEqual({ photo: true, linkedin: false });
    expect(r.attestation).toEqual({
      version: "team-attestation-v1",
      at: "2026-11-20T10:00:00.000Z",
    });
  });

  it.each([
    null,
    undefined,
    42,
    "x",
    [],
    { commun: 3, categorie: [], attestation: { version: 1 } },
  ])("ne casse pas sur une forme inattendue (%j)", (entree) => {
    const r = lireReponseQuestionnaire(entree);
    expect(r.prenom).toBeNull();
    expect(r.langues).toEqual([]);
    expect(r.categorie).toEqual([]);
    expect(r.attestation).toBeNull();
    expect(r.consentements).toEqual({ photo: false, linkedin: false });
  });
});
