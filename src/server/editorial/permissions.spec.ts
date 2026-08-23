/**
 * Console éditoriale — tests de la matrice rôles → permissions (§4).
 *
 * 🔑 Le protocole exige **un test par cellule REFUSÉE** : « une permission
 * non testée est une permission absente ». La matrice fait 13 actions × 5
 * rôles = 65 cellules ; elles sont toutes vérifiées, dans les deux sens, par
 * une table qui transcrit le §4 **indépendamment** de l'implémentation.
 *
 * C'est le point important : si la table de test se contentait de relire
 * `MATRICE`, elle passerait quoi qu'on y écrive. Elle est donc recopiée à la
 * main depuis le plan, et c'est cette redondance qui garde.
 */

import { describe, it, expect } from "vitest";
import {
  peut,
  actionsDe,
  messageRefus,
  filtreParDefaut,
  roleDeduitDepuisAdmin,
  ROLES_EDITORIAUX,
  ACTIONS_EDITORIALES,
  type ActionEditoriale,
  type RoleEditorial,
} from "./permissions";

/**
 * Le §4, recopié à la main. `1` = autorisé, `0` = refusé.
 * Colonnes, dans l'ordre : admin · stratège · production · montage · lecture.
 */
const TABLEAU_DU_PLAN: Record<ActionEditoriale, [number, number, number, number, number]> = {
  voir: [1, 1, 1, 1, 1],
  "publication.ecrire": [1, 1, 1, 0, 0],
  "publication.valider": [1, 1, 0, 0, 0],
  "publication.marquerPublie": [1, 1, 1, 0, 0],
  "asset.ecrire": [1, 1, 1, 1, 0],
  "asset.valider": [1, 1, 1, 0, 0],
  "idee.capturer": [1, 1, 1, 1, 1],
  "idee.promouvoir": [1, 1, 1, 0, 0],
  "invite.gerer": [1, 1, 1, 0, 0],
  "metrique.saisir": [1, 1, 1, 0, 0],
  "reglages.gerer": [1, 0, 0, 0, 0],
  "equipe.gerer": [1, 0, 0, 0, 0],
  supprimer: [1, 0, 0, 0, 0],
};

const ORDRE: RoleEditorial[] = ["admin", "stratege", "production", "montage", "lecture"];

describe("la matrice, cellule par cellule", () => {
  it("couvre exactement les 13 actions du §4", () => {
    expect(ACTIONS_EDITORIALES.sort()).toEqual(Object.keys(TABLEAU_DU_PLAN).sort());
  });

  it("couvre exactement les 5 rôles du §4", () => {
    expect([...ROLES_EDITORIAUX].sort()).toEqual([...ORDRE].sort());
  });

  // 65 cellules, une assertion chacune, nommées pour qu'un échec DISE laquelle.
  for (const [action, attendus] of Object.entries(TABLEAU_DU_PLAN) as [
    ActionEditoriale,
    [number, number, number, number, number],
  ][]) {
    for (let i = 0; i < ORDRE.length; i += 1) {
      const role = ORDRE[i]!;
      const autorise = attendus[i] === 1;
      it(`${autorise ? "AUTORISE" : "🔴 REFUSE"} « ${action} » à « ${role} »`, () => {
        expect(peut(role, action)).toBe(autorise);
      });
    }
  }
});

describe("les refus qui comptent le plus", () => {
  it("🔴 `montage` ne valide PAS une publication", () => {
    // Critère du lot 4, et principe du protocole : on ne valide pas son
    // propre travail.
    expect(peut("montage", "publication.valider")).toBe(false);
  });

  it("🔴 `montage` ne valide PAS un asset — c'est le sien", () => {
    expect(peut("montage", "asset.valider")).toBe(false);
    // …mais il a bien le droit d'en créer et d'en modifier.
    expect(peut("montage", "asset.ecrire")).toBe(true);
  });

  it("🔴 `production` ne VALIDE pas une publication", () => {
    expect(peut("production", "publication.ecrire")).toBe(true);
    expect(peut("production", "publication.valider")).toBe(false);
  });

  it("🔴 personne hors `admin` ne touche aux réglages, à l'équipe, ni ne supprime", () => {
    for (const role of ORDRE.filter((r) => r !== "admin")) {
      expect(peut(role, "reglages.gerer"), role).toBe(false);
      expect(peut(role, "equipe.gerer"), role).toBe(false);
      expect(peut(role, "supprimer"), role).toBe(false);
    }
  });

  it("`lecture` ne peut RIEN muter, sauf capturer une idée", () => {
    const permises = actionsDe("lecture");
    expect(permises.sort()).toEqual(["idee.capturer", "voir"]);
  });
});

describe("messageRefus", () => {
  it("cite l'action, le rôle ET les rôles autorisés — un refus muet est un échec", () => {
    const m = messageRefus("montage", "publication.valider");
    expect(m).toContain("publication.valider");
    expect(m).toContain("montage");
    expect(m).toContain("admin");
    expect(m).toContain("stratege");
  });

  it("produit un message pour chaque cellule refusée, jamais vide", () => {
    for (const action of ACTIONS_EDITORIALES) {
      for (const role of ORDRE) {
        if (peut(role, action)) continue;
        expect(messageRefus(role, action).length, `${role}/${action}`).toBeGreaterThan(30);
      }
    }
  });
});

describe("filtreParDefaut", () => {
  it("🔴 n'ouvre à `montage` que SA file", () => {
    expect(filtreParDefaut("montage").responsableMoi).toBe(true);
  });

  it("n'impose ce filtre à personne d'autre", () => {
    for (const role of ORDRE.filter((r) => r !== "montage")) {
      expect(filtreParDefaut(role).responsableMoi, role).toBe(false);
    }
  });
});

describe("roleDeduitDepuisAdmin — l'amorçage", () => {
  it("donne `admin` éditorial à un super_admin ou un admin", () => {
    expect(roleDeduitDepuisAdmin("super_admin")).toBe("admin");
    expect(roleDeduitDepuisAdmin("admin")).toBe("admin");
  });

  it("🔴 ne donne JAMAIS mieux que `lecture` au reste", () => {
    // La déduction est un amorçage, pas une porte dérobée : un `editor` du
    // reste de la console n'hérite pas des droits éditoriaux.
    for (const r of ["editor", "reader", "", null, undefined, "bidon"]) {
      expect(roleDeduitDepuisAdmin(r as string | null | undefined), String(r)).toBe("lecture");
    }
  });
});
