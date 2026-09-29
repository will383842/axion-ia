/**
 * Le message d'information se copie (PR 5, V7-08) : le bouton du panneau copie
 * un texte qui dit ce qui est enregistré, par qui c'est traité (OpenAI, États-
 * Unis, clauses contractuelles types, pas d'entraînement), combien de temps le
 * son est gardé (30 jours au plus) et que la personne peut refuser ou retirer
 * son accord. Il ne promet ni « le son reste sur » un poste, ni un autre
 * prestataire. Texte À RELIRE PAR WILL avant l'ouverture (point d'arrêt §8.1).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  messageInformation,
  phraseAnnonce,
} from "../../../extensions/enregistreur-meet/lib/message-information.js";
import { DOSSIER_EXTENSION } from "./outils";

describe("le message d'information se copie", () => {
  it("le texte dit l'essentiel, sans promesse fausse", () => {
    const m = messageInformation();
    for (const attendu of [
      "enregistré",
      "OpenAI",
      "États-Unis",
      "entraîner",
      "30 jours",
      "refuser",
      "retirer",
    ]) {
      expect(m).toContain(attendu);
    }
    for (const interdit of ["Mistral", "Anthropic", "Claude", "le son reste sur", "gratuit"]) {
      expect(m).not.toContain(interdit);
    }
  });

  it("la phrase d'annonce demande l'accord", () => {
    expect(phraseAnnonce()).toMatch(/d'accord \?$/);
  });

  it("le panneau porte le bouton et copie ce texte-là", () => {
    const html = readFileSync(join(DOSSIER_EXTENSION, "panneau.html"), "utf8");
    const js = readFileSync(join(DOSSIER_EXTENSION, "panneau.js"), "utf8");
    expect(html).toContain("Copier le message d'information");
    expect(js).toMatch(/navigator\.clipboard\.writeText\(messageInformation\(\)\)/);
  });
});
