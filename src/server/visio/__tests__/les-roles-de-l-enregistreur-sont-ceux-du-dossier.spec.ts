/**
 * ⛔ LES RÔLES DE L'ENREGISTREUR SONT CEUX DU DOSSIER CLIENT (PR 5, A2).
 *
 * `ROLES_ENREGISTREUR` (lu par le worker, donc sans `@/auth`) doit rester
 * identique à `ROLES_DOSSIER_ECHANGES` (PR 3), la liste de référence. Un rôle
 * ajouté d'un seul côté donnerait l'enregistreur à quelqu'un qui ne peut pas
 * lire les comptes rendus — ou l'inverse.
 *
 * Mutation qui rougit : ajouter `"editor"` à `ROLES_ENREGISTREUR`.
 * Contre-témoin : chaque rôle de la console est jugé de la même façon par les
 * deux prédicats.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));

import { peutVoirLesEchanges, ROLES_DOSSIER_ECHANGES } from "@/features/dossier-client/acces";
import { ROLES_ADMIN } from "@/server/auth/habilitations";
import { roleAutoriseEnregistreur, ROLES_ENREGISTREUR } from "../roles-enregistreur";

describe("⛔ les rôles de l'enregistreur sont ceux du dossier client", () => {
  it("les deux listes sont identiques", () => {
    expect([...ROLES_ENREGISTREUR].sort()).toEqual([...ROLES_DOSSIER_ECHANGES].sort());
  });

  it.each(ROLES_ADMIN)("contre-témoin : « %s » est jugé de la même façon", (role) => {
    expect(roleAutoriseEnregistreur(role)).toBe(peutVoirLesEchanges(role));
  });
});
