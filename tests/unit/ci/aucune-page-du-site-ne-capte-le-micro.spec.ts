/**
 * ⛔ AUCUNE PAGE DU SITE NE CAPTE LE MICRO (chantier visio, PR 7).
 *
 * La dictée passe par l'EXTENSION (micro autorisé dans ses options, jeton
 * d'appareil, mêmes routes chiffrées), jamais par une page du site : aucune
 * page, aucun composant ne demande le micro ni la reconnaissance vocale du
 * navigateur (qui enverrait la voix à un tiers non déclaré).
 *
 * Mutation qui rougit : un `navigator.mediaDevices.getUserMedia` ou un
 * `SpeechRecognition` dans `src/app/**` ou `src/components/**`.
 * Contre-témoin : le scanner trouve bien `getUserMedia` dans l'extension (un
 * scanner aveugle serait vert pour de mauvaises raisons).
 * Angle mort : une bibliothèque tierce qui le ferait sans que le mot figure
 * dans nos sources.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const MOTIFS = /\bgetUserMedia\b|\bSpeechRecognition\b|\bwebkitSpeechRecognition\b/;

function sources(dossier: string): string[] {
  if (!existsSync(dossier)) throw new Error(`Balayage inopérant : ${dossier} introuvable.`);
  return readdirSync(dossier).flatMap((n) => {
    const c = join(dossier, n);
    if (statSync(c).isDirectory()) return n === "__tests__" ? [] : sources(c);
    return /\.(ts|tsx|js|jsx)$/.test(n) && !/\.(spec|test)\./.test(n) ? [c] : [];
  });
}

describe("⛔ aucune page du site ne capte le micro", () => {
  it.each(["src/app", "src/components", "src/features"])(
    "%s : ni micro ni reconnaissance vocale",
    (d) => {
      const fautifs = sources(join(process.cwd(), d))
        .filter((f) => MOTIFS.test(readFileSync(f, "utf8")))
        .map((f) => relative(process.cwd(), f).split("\\").join("/"));
      expect(fautifs).toEqual([]);
    },
  );

  it("contre-témoin : l'extension, elle, capte le micro (le scanner voit)", () => {
    const f = sources(join(process.cwd(), "extensions/enregistreur-meet")).filter((x) =>
      MOTIFS.test(readFileSync(x, "utf8")),
    );
    expect(f.length).toBeGreaterThan(0);
  });
});
