import { describe, expect, it } from "vitest";
import { lireCandidatureSalariee, lireCvCandidat } from "../cv-candidat";

describe("lireCvCandidat — le JSON vient de la base, il ne doit jamais casser la fiche", () => {
  it("rien à lire → null (fiche sans CV)", () => {
    expect(lireCvCandidat(null)).toBeNull();
    expect(lireCvCandidat({})).toBeNull();
    expect(lireCvCandidat({ cv: "texte" })).toBeNull();
    expect(lireCvCandidat({ cv: {} })).toBeNull();
  });

  it("lit un bloc complet, et écarte les valeurs de mauvais type", () => {
    const cv = lireCvCandidat({
      cv: {
        fichier: {
          storagePath: "/var/data/cv/u/cv.pdf",
          nomOriginal: "cv.pdf",
          tailleOctets: 2048,
        },
        extrait: {
          email: "a@b.fr",
          experienceCommercialeAnnees: "cinq",
          experiences: [{ poste: "Commercial", entreprise: "ACME" }, { lieu: "Lyon" }, 42],
          formations: [{ diplome: "BTS NDRC", annee: 2019 }],
          competences: ["Négociation", 3, " "],
        },
        analyse: { profilApporteur: "excellent", pointsForts: ["Réseau"], avis: "Oui." },
      },
    });
    expect(cv?.fichier?.tailleOctets).toBe(2048);
    expect(cv?.extrait?.experienceCommercialeAnnees).toBeNull();
    expect(cv?.extrait?.experiences).toHaveLength(1);
    expect(cv?.extrait?.formations[0]?.annee).toBe("2019");
    expect(cv?.extrait?.competences).toEqual(["Négociation"]);
    // Un profil hors barème ne s'affiche pas plutôt que de mentir.
    expect(cv?.analyse?.profilApporteur).toBeNull();
    expect(cv?.analyse?.avis).toBe("Oui.");
  });

  it("un fichier sans chemin n'est pas téléchargeable", () => {
    expect(
      lireCvCandidat({ cv: { fichier: { nomOriginal: "cv.pdf" }, analyse: {} } })?.fichier,
    ).toBeNull();
  });
});

describe("lireCandidatureSalariee", () => {
  it("ne s'affiche qu'avec un canal", () => {
    expect(lireCandidatureSalariee({ candidatureSalariee: { annonce: "x" } })).toBeNull();
    expect(lireCandidatureSalariee({ candidatureSalariee: { canal: "indeed" } })).toEqual({
      canal: "indeed",
      annonce: null,
    });
  });
});
