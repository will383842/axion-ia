import { describe, expect, it } from "vitest";
import { MESSAGES_ERREUR, MESSAGES_OK, messageErreur, messageOk } from "../messages";

describe("messages : des listes fermées par code", () => {
  it("un code connu rend son message", () => {
    expect(messageOk("fiche_creee")).toBe(MESSAGES_OK.fiche_creee);
    expect(messageErreur("motif_long")).toBe(MESSAGES_ERREUR.motif_long);
  });

  it("un code inconnu, vide ou absent ne rend RIEN (jamais le texte de l'adresse)", () => {
    const faux = ["", "un texte au choix", "<b>x</b>", "constructor", "__proto__", "toString"];
    for (const code of faux) {
      expect(messageOk(code), code).toBeNull();
      expect(messageErreur(code), code).toBeNull();
    }
    expect(messageOk(undefined)).toBeNull();
    expect(messageErreur(null)).toBeNull();
  });

  it("un code d'erreur n'est pas un code de succès, et inversement", () => {
    expect(messageOk("role")).toBeNull();
    expect(messageErreur("relancee")).toBeNull();
  });

  it("aucun mot interdit dans les textes de la console", () => {
    const tout = [...Object.values(MESSAGES_OK), ...Object.values(MESSAGES_ERREUR)]
      .join(" ")
      .toLowerCase();
    for (const mot of [
      "grenoble",
      "candidat",
      "réserv",
      "inscri",
      "devis",
      "prix",
      "événement",
      "garanti",
      "obligatoire",
      "effacer",
      "supprimer",
    ]) {
      expect(tout, mot).not.toContain(mot);
    }
  });
});
