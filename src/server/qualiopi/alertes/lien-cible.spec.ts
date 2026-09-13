// @vitest-environment node

/**
 * Tests — où mène une alerte, et la garde qui interdit les liens morts.
 *
 * 🔑 LE TEST QUI COMPTE EST CELUI DES ROUTES. Une table de correspondance
 * `type → segment d'URL` est du texte : elle compile, elle s'affiche, et rien ne
 * dit qu'elle désigne un écran qui existe. Un renommage de répertoire la
 * transformerait en collection de liens morts **silencieusement** — et un lien
 * mort est pire que pas de lien : il fait cliquer, il rend une 404, et il
 * apprend à ne plus cliquer sur les autres.
 *
 * Ce fichier va donc lire le DISQUE.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CIBLES_ATTEIGNABLES, lienCible, segmentCible } from "./lien-cible";

const BASE = "/fr/console-secrete";

describe("🔴 chaque route citée EXISTE sur le disque", () => {
  it("la table n'est pas vide — sinon cette garde ne regarde rien", () => {
    // Témoin de prémisse : une table vidée rendrait la boucle sans tour, verte
    // et aveugle.
    expect(CIBLES_ATTEIGNABLES.length).toBeGreaterThanOrEqual(6);
  });

  for (const cible of CIBLES_ATTEIGNABLES) {
    it(`${cible} mène à un écran de détail qui existe`, () => {
      const segment = segmentCible(cible);
      expect(segment).not.toBeNull();
      const chemin = join(
        process.cwd(),
        "src",
        "app",
        "[locale]",
        "(admin)",
        "[adminPrefix]",
        ...(segment as string).split("/"),
        "[id]",
      );
      expect(
        existsSync(chemin),
        `« ${cible} » pointe vers « ${segment}/[id] », qui n'existe pas. L'alerte ` +
          `proposerait un lien mort : elle ferait cliquer, rendrait une 404, et ` +
          `apprendrait à ne plus cliquer sur les autres. Corrigez le segment, ou ` +
          `retirez le type de la table — l'écran retombe alors sur son affichage ` +
          `textuel, qui est honnête.`,
      ).toBe(true);
    });
  }
});

describe("lienCible — ce qu'il compose, et ce qu'il refuse", () => {
  it("compose le lien sous le préfixe admin reçu", () => {
    // ⚠️ Le préfixe de la console est SECRET : un chemin codé en dur ne
    // correspondrait à rien. Il vient toujours de la page.
    expect(lienCible("Trainer", "abc123def", BASE)).toBe(
      "/fr/console-secrete/qualiopi/formateurs/abc123def",
    );
  });

  it("🔑 rend null pour un type SANS écran de détail", () => {
    // Neuf des quinze types émis sont dans ce cas. L'écran garde alors son
    // affichage textuel, qui ne promet rien.
    expect(lienCible("Enrollment", "abc123def", BASE)).toBeNull();
    expect(lienCible("SousTraitant", "abc123def", BASE)).toBeNull();
    expect(lienCible("DocumentGenere", "abc123def", BASE)).toBeNull();
  });

  it("🔴 rend null sur un identifiant VIDE — sinon le lien mène à la LISTE", () => {
    // Le piège : `base/qualiopi/formateurs/` est une URL valide qui affiche la
    // liste. Le lien semblerait mener à la cible et n'y mènerait pas.
    expect(lienCible("Trainer", "", BASE)).toBeNull();
    expect(lienCible("Trainer", "   ", BASE)).toBeNull();
    expect(lienCible("Trainer", null, BASE)).toBeNull();
  });

  it("⚠️ refuse un identifiant qui contient une BARRE ou un espace", () => {
    // Il vient de la base, mais il finit dans une URL : une valeur inattendue
    // composerait un chemin qu'on n'a pas voulu.
    expect(lienCible("Trainer", "abc/../../admin", BASE)).toBeNull();
    expect(lienCible("Trainer", "abc def", BASE)).toBeNull();
    expect(lienCible("Trainer", "ab", BASE)).toBeNull();
  });

  it("ne se laisse pas berner par une clé héritée d'Object.prototype", () => {
    // `SEGMENT_PAR_CIBLE["constructor"]` rendrait une fonction sans le
    // `hasOwnProperty` — et composerait un chemin absurde.
    expect(lienCible("constructor", "abc123def", BASE)).toBeNull();
    expect(lienCible("toString", "abc123def", BASE)).toBeNull();
    expect(segmentCible("__proto__")).toBeNull();
  });

  it("rend null quand le type est absent", () => {
    expect(lienCible(null, "abc123def", BASE)).toBeNull();
    expect(lienCible(undefined, "abc123def", BASE)).toBeNull();
  });
});
