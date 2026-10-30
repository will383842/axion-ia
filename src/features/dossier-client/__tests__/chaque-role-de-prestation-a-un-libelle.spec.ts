/**
 * Chaque valeur de l'énumération Prisma `RoleDansProjet` a un libellé.
 *
 * Mutation qui fait rougir : ajouter une valeur à l'énumération sans l'ajouter
 * à `LIBELLE_ROLE_PROJET`. Contre-témoin : les deux valeurs du lot C3 y figurent.
 */

import { describe, expect, it } from "vitest";

import { RoleDansProjet } from "../../../../prisma/generated/client";
import { LIBELLE_ROLE_PROJET } from "../libelles";

describe("libellés des rôles dans une prestation", () => {
  it("couvre exactement les valeurs de l'énumération", () => {
    expect(Object.keys(LIBELLE_ROLE_PROJET).sort()).toEqual(Object.values(RoleDansProjet).sort());
  });

  it("nomme les rôles influenceur et bloqueur sans le mot « projet »", () => {
    expect(LIBELLE_ROLE_PROJET.influenceur).toBe("influence la décision");
    expect(LIBELLE_ROLE_PROJET.bloqueur).toBe("freine la décision");
    for (const libelle of Object.values(LIBELLE_ROLE_PROJET)) {
      expect(libelle).not.toMatch(/projet/i);
    }
  });
});
