/**
 * LA PROVENANCE D'UNE CANDIDATURE — ce qu'on écrit, et ce qu'on refuse d'écrire.
 *
 * Deux pannes possibles, et elles ne se ressemblent pas :
 *
 * **La candidature perdue.** Les colonnes sont bornées (`VarChar(120)`, `(160)`,
 * `(255)`). Un lien publicitaire avec un `utm_campaign` de trois mille
 * caractères ferait échouer l'INSERT au fond de la pile ; le candidat verrait
 * « une erreur est survenue » et n'y reviendrait pas. On tronque : une
 * provenance approximative vaut mieux qu'un candidat perdu.
 *
 * **Le chiffre inventé.** Écrire « direct » quand on ne sait pas fabriquerait un
 * canal qui n'existe pas et qui dominerait le classement dès la première
 * semaine. `null` doit rester `null` jusqu'à l'écran, où il s'affiche
 * « Provenance inconnue » — jamais « Direct ».
 */

import { describe, it, expect } from "vitest";

import {
  borner,
  cheminSeul,
  libelleCanal,
  provenanceDepuisLeTunnel,
  LIBELLE_PROVENANCE_INCONNUE,
  MAX_CAMPAGNE,
  MAX_SOURCE,
} from "../provenance";

describe("le bornage des valeurs", () => {
  it("tronque au lieu de refuser — une candidature ne se perd pas sur un lien trop long", () => {
    const long = "a".repeat(MAX_CAMPAGNE + 500);
    const p = provenanceDepuisLeTunnel({ utm_campaign: long });
    expect(p.utmCampaign).toHaveLength(MAX_CAMPAGNE);
  });

  it("rend null sur le vide et sur les espaces — jamais une chaîne vide", () => {
    // 🔴 Une chaîne vide en base créerait un CANAL nommé « », distinct de
    // « inconnu », et l'écran le compterait comme une provenance connue.
    expect(borner("   ", MAX_SOURCE)).toBeNull();
    expect(borner("", MAX_SOURCE)).toBeNull();
    expect(borner(undefined, MAX_SOURCE)).toBeNull();
  });

  it("laisse intacte une valeur normale", () => {
    expect(borner("  leboncoin ", MAX_SOURCE)).toBe("leboncoin");
  });
});

describe("le chemin d'arrivée", () => {
  it("retire la chaîne de requête", () => {
    // 🔑 Elle porte les UTM (qui ont leurs colonnes) et parfois un identifiant
    // de session publicitaire — un quasi-identifiant qu'on n'a aucune raison de
    // garder deux ans dans un dossier de candidature.
    expect(cheminSeul("/fr/carrieres/formateur?utm_source=leboncoin&gclid=abc")).toBe(
      "/fr/carrieres/formateur",
    );
  });

  it("retire aussi l'ancre", () => {
    expect(cheminSeul("/fr/carrieres#postuler")).toBe("/fr/carrieres");
  });

  it("REFUSE une URL absolue — elle ne désigne plus une page du site", () => {
    // Le champ vient du navigateur : un appelant hostile y mettrait n'importe
    // quoi. Un chemin relatif est la seule forme qui ait un sens ici.
    expect(cheminSeul("https://exemple.invalid/piege")).toBeNull();
    expect(cheminSeul("javascript:alert(1)")).toBeNull();
  });

  it("rend null sur l'absence", () => {
    expect(cheminSeul(undefined)).toBeNull();
    expect(cheminSeul("")).toBeNull();
  });
});

describe("ce qu'on écrit quand on ne sait pas", () => {
  it("rend QUATRE null sur un cookie absent — aucune valeur inventée", () => {
    expect(provenanceDepuisLeTunnel({})).toEqual({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      landingPath: null,
    });
  });

  it("l'écran dit « inconnue », JAMAIS « direct »", () => {
    // 🔴 Les deux ne disent pas la même chose : « direct » affirme que la
    // personne a tapé l'adresse, « inconnue » dit qu'on n'a pas su. Confondre
    // les deux ferait conclure qu'un canal marche alors qu'on ne mesure rien.
    expect(libelleCanal(null)).toBe(LIBELLE_PROVENANCE_INCONNUE);
    expect(libelleCanal(null)).not.toMatch(/direct/i);
  });

  it("rend le canal tel quel quand il est connu", () => {
    expect(libelleCanal("leboncoin")).toBe("leboncoin");
  });
});
