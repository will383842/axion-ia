/**
 * Délai d'accès (indicateur 1 Qualiopi, décision du dirigeant du 02/10/2026) :
 * la base de connaissances de la génération de contenu porte la règle de la
 * source unique, et plus jamais l'ancienne affirmation « 11 jours ouvrés ».
 *
 * Vit dans tests/content-gen/ : seule zone de test autorisée à lire le module
 * content-gen (content-gen:isolation-check, § 4.1bis). Le reste de la règle est
 * gardé par src/content/formations/__tests__/delai-acces-une-seule-regle.spec.tsx.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DELAI_ACCES_FORMES_RETIREES, DELAI_ACCES_PHRASE } from "@/content/formations/delai-acces";
import { KB_INTERVENTIONS_FORMATIONS } from "@/server/content-gen/kb/interventions-formations";

const KB = path.resolve(__dirname, "../../src/server/content-gen/kb");

function fautes(texte: string): string[] {
  return DELAI_ACCES_FORMES_RETIREES.filter((re) => re.test(texte)).map(String);
}

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const p = path.join(dir, nom);
    if (statSync(p).isDirectory()) {
      if (nom === "__tests__") continue;
      out.push(...fichiers(p));
    } else if (/\.(ts|json|md)$/.test(nom) && !/\.(spec|test)\.ts$/.test(nom)) {
      out.push(p);
    }
  }
  return out;
}

describe("délai d'accès — base de connaissances de la génération de contenu", () => {
  it("form-031 porte la phrase de la source unique", () => {
    const fait = KB_INTERVENTIONS_FORMATIONS.find((k) => k.id === "form-031");
    expect(fait?.text).toContain(DELAI_ACCES_PHRASE);
    expect(fautes(JSON.stringify(KB_INTERVENTIONS_FORMATIONS))).toEqual([]);
  });

  it("aucune ligne de code de la base de connaissances ne porte l'ancienne affirmation", () => {
    const trouvees: string[] = [];
    for (const f of fichiers(KB)) {
      readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .forEach((l) => {
          if (fautes(l).length > 0) trouvees.push(`${path.basename(f)} : ${l.trim()}`);
        });
    }
    expect(trouvees).toEqual([]);
  });
});
