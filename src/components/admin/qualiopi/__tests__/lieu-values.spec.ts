/**
 * Tests — passerelle formulaire ↔ Server Action pour le lieu de déroulement.
 */

import { describe, it, expect } from "vitest";

import {
  LIEU_VALUES_VIDE,
  lieuPayload,
  lieuValuesDepuisSession,
} from "@/components/admin/qualiopi/lieu-values";

describe("lieuValuesDepuisSession", () => {
  it("convertit les null de la base en chaînes vides pour les champs contrôlés", () => {
    expect(
      lieuValuesDepuisSession({
        lieuType: null,
        lieuIntitule: null,
        lieuAdresse: null,
        lieuCodePostal: null,
        lieuVille: null,
        lieuSalle: null,
        lieuVisioUrl: null,
      }),
    ).toEqual(LIEU_VALUES_VIDE);
  });

  it("reprend les valeurs existantes", () => {
    const v = lieuValuesDepuisSession({ lieuType: "sur_site", lieuVille: "Saint-Étienne" });
    expect(v.lieuType).toBe("sur_site");
    expect(v.lieuVille).toBe("Saint-Étienne");
  });

  // Une valeur d'enum inconnue (migration, écriture directe en base) ne doit pas
  // se retrouver dans un <select> qui ne la propose pas : le champ afficherait
  // alors la première option sans que personne n'ait choisi quoi que ce soit.
  it("neutralise un type de lieu hors enum", () => {
    expect(lieuValuesDepuisSession({ lieuType: "ancien_format" }).lieuType).toBe("");
  });
});

describe("lieuPayload", () => {
  // 🔴 `lieuType: ""` DOIT partir : c'est ce qui permet de revenir à
  // « — Non précisé — ». Omettre la clé signifierait « ne touche pas », et le
  // type saisi par erreur resterait en base pour toujours.
  it("émet toutes les clés, y compris un type vide", () => {
    const p = lieuPayload({ ...LIEU_VALUES_VIDE, lieuVille: "Saint-Étienne" });
    expect(p["lieuType"]).toBe("");
    expect(p["lieuVille"]).toBe("Saint-Étienne");
    expect(Object.keys(p)).toHaveLength(7);
  });

  it("aller-retour base → formulaire → charge utile sans perte", () => {
    const initial = {
      lieuType: "sur_site",
      lieuIntitule: "Siège du client",
      lieuAdresse: "5 rue des Docks",
      lieuCodePostal: "42000",
      lieuVille: "Saint-Étienne",
      lieuSalle: "B2",
      lieuVisioUrl: null,
    };
    const p = lieuPayload(lieuValuesDepuisSession(initial));
    expect(p["lieuIntitule"]).toBe("Siège du client");
    expect(p["lieuSalle"]).toBe("B2");
    expect(p["lieuVisioUrl"]).toBe("");
  });
});
