// Les origines du guide réseau sont RESTITUÉES à l'export (art. 15).
//
// `exporterGuideReseauPour()` renvoie `{ contacts, origines }` ; la route ne
// rendait que `contacts` et jetait `origines`. Ce test exige que la réponse
// porte les deux, et que les champs internes (HMAC du commentaire, clé de
// dédoublonnage) n'y figurent jamais.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(join(process.cwd(), "src/app/api/gdpr-export/route.ts"), "utf8");
const lecture = readFileSync(join(process.cwd(), "src/lib/rgpd-guide-reseau.ts"), "utf8");

describe("export RGPD — guide réseau", () => {
  it("rend les contacts ET les origines dans la réponse", () => {
    expect(route).toMatch(
      /guideReseau:\s*\{\s*contacts:\s*guideReseau\.contacts,\s*origines:\s*guideReseau\.origines\s*\}/,
    );
  });

  it("n'expose ni commentaireRefHmac ni cleDedoublonnage", () => {
    expect(route).not.toMatch(/commentaireRefHmac|cleDedoublonnage/);
    expect(lecture).not.toMatch(/commentaireRefHmac|cleDedoublonnage/);
  });
});
