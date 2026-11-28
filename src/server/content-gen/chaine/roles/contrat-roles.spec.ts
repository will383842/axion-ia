import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CODES_REFUS, estCodeRefus } from "../codes-refus";

const dossier = __dirname;
const sources = readdirSync(dossier)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".spec.ts"))
  .map((f) => ({ f, texte: readFileSync(join(dossier, f), "utf8") }));

describe("rôles de la chaîne : contrat de sécurité", () => {
  it("n'emploient ni Fable, ni Haiku, ni un autre fournisseur", () => {
    for (const { f, texte } of sources) {
      expect(texte, f).not.toMatch(/claude-(fable|haiku)|gpt-|gemini|mistral/i);
    }
  });

  it("restent purs : ni base, ni Redis, ni réseau, ni lecture d'environnement (hors interrupteur)", () => {
    for (const { f, texte } of sources) {
      expect(texte, f).not.toMatch(
        /\bfetch\(|@\/lib\/(prisma|redis)|ioredis|@prisma|from "node:|require\(/,
      );
      if (f !== "interrupteur.ts") expect(texte, f).not.toMatch(/process\.env/);
    }
  });

  it("ne sont importés par aucun code hors de la chaîne : rien n'est branché sur la publication", () => {
    const racine = join(__dirname, "../../../..");
    const visites: string[] = [];
    const parcourir = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) {
          if (
            e.name === "node_modules" ||
            e.name === "generated" ||
            p.includes("content-gen/chaine")
          )
            continue;
          parcourir(p);
        } else if (/\.(ts|tsx)$/.test(e.name)) visites.push(p);
      }
    };
    parcourir(racine);
    const fautifs = visites.filter((p) => /chaine\/roles/.test(readFileSync(p, "utf8")));
    expect(fautifs).toEqual([]);
  });

  it("n'écrivent aucune règle contraire à « partout en France »", () => {
    for (const { f, texte } of sources) {
      expect(texte, f).not.toMatch(/interdit[^\n]*partout en France/i);
    }
  });
});

describe("codes de refus des rôles : tous dans la liste fermée de C4", () => {
  const codes = [
    // R2
    "pas_d_angle",
    "pas_de_matiere",
    "intention_couverte",
    // R5
    "generique",
    "non_actionnable",
    "fait_non_source",
    // R6
    "chiffre_retire",
    "lien_mort",
  ];
  it.each(codes)("%s", (c) => {
    expect(estCodeRefus(c)).toBe(true);
    expect(CODES_REFUS).toContain(c);
  });
});
