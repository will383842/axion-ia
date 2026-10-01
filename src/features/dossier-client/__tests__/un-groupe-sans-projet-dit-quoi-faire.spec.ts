/**
 * V1-03 (relecture du lot B) : le refus d'un groupe de faits sans projet
 * choisi doit ATTEINDRE Will. `messageAffichable` ne laisse passer que les
 * erreurs métier déclarées (S4) ; sans `ErreurChoixDeGroupe` dans la liste,
 * Will lisait « L'opération a échoué. Réessayez. » au lieu de la consigne.
 */
import { describe, expect, it, vi } from "vitest";

// `message-affichable` tire `acces` (session) : hors sujet ici.
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { MESSAGE_ERREUR_GENERIQUE, messageAffichable } from "../message-affichable";
import { ErreurChoixDeGroupe } from "../projets-evoques";

describe("un groupe sans projet dit quoi faire", () => {
  it("le message « Choisissez un projet » arrive tel quel à l'écran", () => {
    const e = new ErreurChoixDeGroupe("Choisissez un projet pour « Formation IA ».");
    expect(messageAffichable(e)).toBe("Choisissez un projet pour « Formation IA ».");
  });

  it("contre-témoin : une erreur technique reste masquée", () => {
    expect(messageAffichable(new Error("P2002 unique constraint"))).toBe(MESSAGE_ERREUR_GENERIQUE);
  });
});
