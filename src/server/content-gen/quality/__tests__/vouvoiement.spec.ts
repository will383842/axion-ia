/**
 * Lot R6 : contrôle simple du vouvoiement dans le texte généré (OBSERVATION :
 * il n'a aucun effet sur la publication).
 */
import { describe, it, expect } from "vitest";
import { detecterTutoiement } from "../vouvoiement";

describe("detecterTutoiement", () => {
  it("ne signale rien sur un texte au vouvoiement", () => {
    expect(
      detecterTutoiement(
        "<p>Vous pouvez commencer par vos devis. Votre équipe gagne du temps.</p>",
      ),
    ).toEqual({ tutoie: false, occurrences: 0, extrait: "" });
  });

  it.each([
    "Tu peux commencer par tes devis.",
    "Si tu veux gagner du temps, lance un audit. Cet outil est fait pour toi.",
    "Dis-moi si t'as besoin d'aide, car t'es pressé.",
    "Voici tes premières tâches : tu verras le gain.",
    "<p>Alors, qu'est-ce que tu en penses ? Peux-tu essayer ?</p>",
  ])("signale le tutoiement à partir de 2 occurrences : %s", (texte) => {
    const r = detecterTutoiement(texte);
    expect(r.tutoie).toBe(true);
    expect(r.occurrences).toBeGreaterThanOrEqual(2);
    expect(r.extrait.length).toBeGreaterThan(0);
  });

  it("ne signale pas une occurrence isolée (seuil de 2)", () => {
    const r = detecterTutoiement("Cet outil est fait pour toi.");
    expect(r.tutoie).toBe(false);
    expect(r.occurrences).toBe(1);
  });

  it("ne confond pas avec des mots qui contiennent « tu », « ton », « ta » ou « toi »", () => {
    expect(
      detecterTutoiement(
        "Le ton de l'étude, la tuile, un tutoriel, la toile, un tuteur, une statue.",
      ),
    ).toMatchObject({ tutoie: false, occurrences: 0 });
  });

  it.each([
    [
      "guillemets français",
      "<p>Un prompt type : « Tu es un assistant, tu réponds à tes clients » aide.</p>",
    ],
    ["guillemets droits", 'Un prompt type : "Tu es un assistant, tu réponds à tes clients" aide.'],
    [
      "guillemets typographiques",
      "Un prompt type : \u201cTu es un assistant, tu réponds à tes clients\u201d aide.",
    ],
    [
      "apostrophes simples",
      "Un prompt type : 'Tu es un assistant, tu réponds à tes clients' aide.",
    ],
    ["<pre> et <code>", "<pre>tu es tes</pre><code>tu tu tu</code>"],
    ["<blockquote> et <q>", "<blockquote>Tu verras, tu sauras</blockquote><q>tu tu</q>"],
    [
      "<em> et <i>",
      "<p>Le prompt <em>tu es un expert, tu écris</em> et <i>tu tu</i> est cité.</p>",
    ],
    ["<kbd> et <samp>", "<kbd>tu tu</kbd> <samp>tu es tes</samp>"],
    ["mots tout en majuscules", "TU ES TES TOI sont des mots en majuscules."],
  ])("ignore : %s", (_nom, texte) => {
    expect(detecterTutoiement(texte).tutoie).toBe(false);
  });

  it("l'apostrophe d'une élision n'ouvre pas une citation", () => {
    expect(
      detecterTutoiement("L'équipe d'Axion-IA aide l'entreprise ; tu peux, tu dois, tes outils.")
        .tutoie,
    ).toBe(true);
  });

  it("compte les occurrences", () => {
    expect(detecterTutoiement("Tu sais que tu peux. Pour toi.").occurrences).toBe(3);
  });

  it("accepte un texte vide", () => {
    expect(detecterTutoiement("")).toEqual({ tutoie: false, occurrences: 0, extrait: "" });
  });
});
