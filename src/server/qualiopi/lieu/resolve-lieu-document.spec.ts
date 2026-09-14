/**
 * Tests — lieu imprimé sur les documents légaux.
 *
 * Le défaut corrigé ici : cinq gabarits annonçaient l'adresse de l'ORGANISME
 * comme lieu de déroulement, y compris pour une formation donnée chez le client.
 */

import { describe, it, expect } from "vitest";

import {
  defautLieuDocument,
  resolveLieuDocument,
  resolveLieuConvocation,
} from "./resolve-lieu-document";
import type { LieuFields } from "./format-lieu";

const IDENTITE = {
  adresseExercice: "10 rue de l'Exercice, 38000 Grenoble",
  adresseSiege: "1 rue du Siège, 38000 Grenoble",
};

/**
 * 🔴 I17-01 (audit initial Qualiopi, 2026-09-14) — le repli sur l'adresse de
 * l'organisme était SILENCIEUX. Une session présentielle ou hybride sans lieu
 * imprimait la domiciliation sur la convention, la convocation et la feuille
 * d'émargement, et aucune alerte ne le disait. Le prédicat ci-dessous est ce que
 * lit l'alerte `session_sans_lieu` : il doit dire EXACTEMENT quand le repli joue.
 */
describe("defautLieuDocument — le prédicat que lit l'alerte « session sans lieu »", () => {
  it("🔴 aucun champ de lieu : le document retombera sur l'adresse de l'organisme", () => {
    expect(defautLieuDocument({})).toBe("aucun_lieu");
    expect(
      defautLieuDocument({ lieuType: null, lieuAdresse: "  ", lieuVille: null, lieuSalle: "" }),
    ).toBe("aucun_lieu");
  });

  it("sur site sans adresse ni ville : le document n'imprimera que « Sur site »", () => {
    expect(defautLieuDocument({ lieuType: "sur_site" })).toBe("sur_site_sans_adresse");
    expect(
      defautLieuDocument({
        lieuType: "sur_site",
        lieuIntitule: "Siège du client",
        lieuSalle: "B2",
      }),
    ).toBe("sur_site_sans_adresse");
  });

  it("témoins de non-vacuité : un lieu réel ne fait rien lever", () => {
    expect(defautLieuDocument({ lieuType: "sur_site", lieuAdresse: "5 rue des Docks" })).toBeNull();
    expect(defautLieuDocument({ lieuType: "sur_site", lieuVille: "Saint-Étienne" })).toBeNull();
    expect(defautLieuDocument({ lieuType: "nos_locaux" })).toBeNull();
    expect(defautLieuDocument({ lieuVille: "Saint-Étienne" })).toBeNull();
    expect(
      defautLieuDocument({ lieuType: "distanciel", lieuVisioUrl: "https://meet.google.com/x" }),
    ).toBeNull();
  });

  it("🔑 « aucun_lieu » coïncide EXACTEMENT avec le repli de resolveLieuDocument", () => {
    // Deux prédicats jumeaux divergent au premier changement. On vérifie donc,
    // cas par cas, que l'alerte lève si et seulement si le document imprime
    // l'adresse de l'organisme.
    const cas: LieuFields[] = [
      {},
      { lieuType: null },
      { lieuSalle: "  " },
      { lieuSalle: "B2" },
      { lieuIntitule: "Salle Fraunces" },
      { lieuVisioUrl: "https://meet.google.com/abc" },
      { lieuVisioUrl: "lien à venir" },
      { lieuType: "sur_site" },
      { lieuType: "nos_locaux" },
      { lieuType: "distanciel" },
      { lieuCodePostal: "42000" },
    ];
    for (const c of cas) {
      const repli = resolveLieuDocument(c, IDENTITE) === IDENTITE.adresseExercice;
      expect(defautLieuDocument(c) === "aucun_lieu", JSON.stringify(c)).toBe(repli);
    }
  });
});

describe("resolveLieuDocument", () => {
  // 🔴 Le test qui porte tout le chantier.
  it("imprime le lieu RÉEL de la session, pas l'adresse de l'organisme", () => {
    const lieu = resolveLieuDocument(
      {
        lieuType: "sur_site",
        lieuAdresse: "5 rue des Docks",
        lieuCodePostal: "42000",
        lieuVille: "Saint-Étienne",
      },
      IDENTITE,
    );
    expect(lieu).toContain("Saint-Étienne");
    expect(lieu).not.toContain("Grenoble");
  });

  it("session sans lieu : repli sur l'adresse d'exercice (comportement historique)", () => {
    expect(resolveLieuDocument({}, IDENTITE)).toBe(IDENTITE.adresseExercice);
  });

  it("sans adresse d'exercice : repli sur le siège", () => {
    expect(resolveLieuDocument({}, { adresseSiege: IDENTITE.adresseSiege })).toBe(
      IDENTITE.adresseSiege,
    );
  });

  it("aucune adresse connue : « — », jamais une chaîne vide", () => {
    expect(resolveLieuDocument({}, {})).toBe("—");
  });

  // Un lieu partiellement rempli reste un lieu : on ne retombe pas sur l'adresse
  // de l'organisme au prétexte qu'il manque le code postal.
  it("un seul champ renseigné suffit à primer sur l'adresse de l'organisme", () => {
    expect(resolveLieuDocument({ lieuVille: "Saint-Étienne" }, IDENTITE)).toContain(
      "Saint-Étienne",
    );
  });

  it("distanciel : n'expose que l'hôte de la visio, jamais le lien complet", () => {
    const lieu = resolveLieuDocument(
      { lieuType: "distanciel", lieuVisioUrl: "https://meet.google.com/abc-defg-hij" },
      IDENTITE,
    );
    expect(lieu).toContain("meet.google.com");
    expect(lieu).not.toContain("abc-defg-hij");
  });
});

describe("resolveLieuConvocation", () => {
  it("renvoie le lieu réel quand il existe", () => {
    expect(resolveLieuConvocation({ lieuVille: "Saint-Étienne" }, IDENTITE)).toContain(
      "Saint-Étienne",
    );
  });

  // « Lieu : — » sur une convocation est pire que pas de ligne du tout : le
  // stagiaire lit que l'information a été cherchée et qu'elle n'existe pas.
  it("renvoie undefined plutôt que « — » quand rien n'est connu", () => {
    expect(resolveLieuConvocation({}, {})).toBeUndefined();
  });

  it("conserve le repli sur l'adresse de l'organisme s'il y en a une", () => {
    expect(resolveLieuConvocation({}, IDENTITE)).toBe(IDENTITE.adresseExercice);
  });
});
