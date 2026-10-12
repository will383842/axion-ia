/**
 * Lot E (M13, M12) — les issues de « Mon dossier » passent par un CODE FERMÉ : un
 * échec de dépôt et un échec de demande de changement ne se confondent pas, et un
 * code inconnu n'affiche rien.
 */

import { describe, expect, it } from "vitest";

import { MESSAGES_CHANGEMENT } from "@/server/qualiopi/formateurs-independants/changements-coordonnees";
import { MESSAGES_DEPOT_FORMATEUR } from "@/server/qualiopi/formateurs-independants/depot";

import { codeDuMessage, messageDuCode } from "../messages";

describe("« Mon dossier » — codes d'issue", () => {
  it("dépôt et changement gardent chacun leur texte", () => {
    expect(messageDuCode(codeDuMessage(MESSAGES_DEPOT_FORMATEUR.erreur))?.texte).toBe(
      MESSAGES_DEPOT_FORMATEUR.erreur,
    );
    expect(
      messageDuCode(codeDuMessage(MESSAGES_CHANGEMENT.erreur, "changement_erreur"))?.texte,
    ).toBe(MESSAGES_CHANGEMENT.erreur);
    expect(messageDuCode(codeDuMessage(MESSAGES_CHANGEMENT.dejaEnCours))?.texte).toBe(
      MESSAGES_CHANGEMENT.dejaEnCours,
    );
  });

  it("code inconnu ou texte libre : rien n'est affiché", () => {
    expect(messageDuCode("<script>")).toBeNull();
    expect(messageDuCode(undefined)).toBeNull();
  });

  it("réussites", () => {
    expect(messageDuCode("recu")?.ok).toBe(true);
    expect(messageDuCode("demande")?.ok).toBe(true);
  });
});
