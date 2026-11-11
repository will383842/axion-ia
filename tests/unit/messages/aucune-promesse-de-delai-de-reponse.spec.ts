// AUCUNE PROMESSE DE DÉLAI DE RÉPONSE DANS LES MESSAGES (Williams, 11/11/2026).
//
// « Il ne faut pas dire réponse sous 48 h, ça me limite trop. » Les fichiers de
// messages (fr et en) ne contiennent plus aucune promesse de délai de réponse à
// un contact. Un délai de LIVRAISON (rapport, devis) n'est pas visé ici.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROMESSE =
  /r[ée]ponse\s+(?:humaine\s+)?(?:sous|en moins de)\s+\d|r[ée]pondons?\s+sous\s+\d|reply\s+within\s+\d|repl(?:y|ies)\s+within\s+\d|respon[sd]e?\s+within\s+\d|\d+\s?(?:business|working)[\s-]hours?/i;

describe("les messages ne promettent aucun délai de réponse", () => {
  for (const locale of ["fr", "en"] as const) {
    it(`${locale}.json ne contient aucune promesse « réponse sous 48 h »`, () => {
      const brut = readFileSync(join(process.cwd(), "src", "messages", `${locale}.json`), "utf8");
      const fautes = brut.split("\n").filter((ligne) => PROMESSE.test(ligne));
      expect(fautes).toEqual([]);
    });
  }
});
