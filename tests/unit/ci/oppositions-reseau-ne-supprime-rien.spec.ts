/**
 * La route des oppositions réseau ne supprime jamais rien, n'emprunte pas le chemin d'effacement,
 * n'utilise pas le secret des vidéos et ne journalise aucune adresse. Chaque règle a son contre-témoin.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RACINE } from "./sources-du-circuit-visio";

const lire = (...p: string[]): string => readFileSync(path.join(RACINE, ...p), "utf8");
const sansCommentaires = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const INTERDITS: Array<[string, RegExp]> = [
  ["suppression", /\.(delete|deleteMany)\s*\(/],
  ["chemin d'effacement", /traiterEffacement/],
  ["type d'effacement", /demande_effacement/],
  ["adresse masquée dans un journal", /redactEmail\s*\(/],
  ["secret des vidéos", /VIDEOS_STUDIO_HMAC_SECRET/],
];

const TOUCHE_OPPOSITION = /emailOpposition\s*\.\s*(delete|deleteMany)\s*\(/;

function fautes(code: string): string[] {
  const s = sansCommentaires(code);
  return INTERDITS.filter(([, re]) => re.test(s)).map(([nom]) => nom);
}

const FICHIERS: Array<[string, string[]]> = [
  ["route", ["src", "app", "api", "interne", "oppositions-reseau", "route.ts"]],
  ["opposition-reseau.ts", ["src", "server", "guides-reseau", "opposition-reseau.ts"]],
  ["route page-guide", ["src", "app", "api", "interne", "oppositions-page-guide", "route.ts"]],
  ["opposition-page-guide.ts", ["src", "server", "guides-reseau", "opposition-page-guide.ts"]],
  ["opposition.ts", ["src", "server", "email", "opposition.ts"]],
];

describe("oppositions réseau : source", () => {
  for (const [nom, chemin] of FICHIERS) {
    it(`${nom} : aucune faute`, () => expect(fautes(lire(...chemin))).toEqual([]));
  }

  it("rgpd-erase.ts ne supprime jamais une ligne de la table emailOpposition", () => {
    const code = sansCommentaires(lire("src", "lib", "rgpd-erase.ts"));
    expect(code).not.toMatch(TOUCHE_OPPOSITION);
  });

  it("contre-témoin : la garde de la table emailOpposition fait rougir", () => {
    expect("prisma.emailOpposition.deleteMany({})").toMatch(TOUCHE_OPPOSITION);
    expect("tx.emailOpposition.delete({ where })").toMatch(TOUCHE_OPPOSITION);
    expect("prisma.emailOpposition.updateMany({})").not.toMatch(TOUCHE_OPPOSITION);
    expect("prisma.crmSyncOutbox.deleteMany({})").not.toMatch(TOUCHE_OPPOSITION);
  });

  it("le secret des oppositions n'a pas de repli sur celui des vidéos", () => {
    const config = sansCommentaires(lire("src", "server", "guides-reseau", "config.ts"));
    const fn = config.slice(config.indexOf("export function secretsOppositionsReseau"));
    expect(fn).not.toMatch(/VIDEOS_STUDIO_HMAC_SECRET/);
  });

  it("la route plafonne le corps à CORPS_MAX_OPPOSITIONS", () => {
    expect(lire(...FICHIERS[0]![1])).toMatch(/corpsMaxOctets: CORPS_MAX_OPPOSITIONS/);
    expect(lire("src", "server", "guides-reseau", "config.ts")).toMatch(
      /CORPS_MAX_OPPOSITIONS = 4 \* 1024/,
    );
  });

  it("contre-témoin : chaque faute fait rougir", () => {
    expect(fautes("tx.emailOpposition.deleteMany({})")).toContain("suppression");
    expect(fautes("await traiterEffacement(d)")).toContain("chemin d'effacement");
    expect(fautes('type: "demande_effacement"')).toContain("type d'effacement");
    expect(fautes("console.log(redactEmail(e))")).toContain("adresse masquée dans un journal");
    expect(fautes("process.env.VIDEOS_STUDIO_HMAC_SECRET")).toContain("secret des vidéos");
    expect(fautes("// .deleteMany( dans un commentaire")).toEqual([]);
  });
});
