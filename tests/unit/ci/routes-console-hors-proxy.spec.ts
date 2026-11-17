/**
 * SEC-1b : les routes (`route.ts`) de la console refusent tout chemin hors du proxy.
 *
 * Le proxy ne voit pas `/videos/…`, `/sitemap…`, `/api/…`, etc. Hors proxy, `[locale]`
 * et `[adminPrefix]` ne sont plus contrôlés. Chaque gestionnaire de la console doit donc
 * appeler `refuserSiHorsConsole(params)` EN PREMIÈRE INSTRUCTION, avant `auth()` et
 * toute garde. Les routes publiques sous `[locale]` doivent contrôler la locale
 * (`hasLocale(`) ou figurer ci-dessous avec leur raison.
 *
 * Mutation qui rougit : retirer l'appel d'un gestionnaire, ou le placer après `auth()`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "src", "app", "[locale]");
const METHODES = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function routes(dir: string): string[] {
  const sortie: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) sortie.push(...routes(p));
    else if (e.name === "route.ts" || e.name === "route.tsx") sortie.push(p);
  }
  return sortie;
}

const toutes = routes(RACINE);
const rel = (p: string): string => relative(process.cwd(), p).split("\\").join("/");
const estConsole = (p: string): boolean => rel(p).startsWith("src/app/[locale]/(admin)/");
const console_ = toutes.filter(estConsole);
const publiques = toutes.filter((p) => !estConsole(p));

/** Routes publiques qui ont leur propre contrôle d'accès (jeton, cookie, locale dans la requête). */
const EXCEPTIONS_PUBLIQUES: Record<string, string> = {
  "src/app/[locale]/espace-ressources/telecharger/[versionId]/route.ts":
    "session destinataire (signature + base) puis périmètre",
  "src/app/[locale]/galerie/[slug]/telecharger/route.ts":
    "la locale sert à la requête : sans correspondance, 404",
  "src/app/[locale]/portail/mon-espace/documents/[id]/route.ts":
    "cookie du portail, jeton en base, propriété du document",
  "src/app/[locale]/portail/mon-espace/supports/[id]/route.ts":
    "cookie du portail, jeton en base, propriété du support",
};

/** Corps de chaque méthode exportée : [méthode, texte depuis l'accolade ouvrante du corps]. */
function methodes(src: string): { nom: string; corps: string }[] {
  const res: { nom: string; corps: string }[] = [];
  const re = new RegExp(`export\\s+(?:async\\s+)?function\\s+(${METHODES.join("|")})\\s*\\(`, "g");
  for (const m of src.matchAll(re)) {
    let i = (m.index ?? 0) + m[0].length;
    let d = 1;
    while (i < src.length && d > 0) {
      if (src[i] === "(") d++;
      else if (src[i] === ")") d--;
      i++;
    }
    const ouv = src.indexOf("{", i);
    res.push({ nom: m[1] as string, corps: src.slice(ouv + 1) });
  }
  return res;
}

/** Première instruction du corps (commentaires ignorés). */
function premiereInstruction(corps: string): string {
  const sansCommentaires = corps.replace(/^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)+/, "");
  return sansCommentaires.slice(0, 120);
}

describe("routes de la console hors proxy (SEC-1b)", () => {
  it("le parcours trouve des fichiers (un glob cassé ne passe pas en vert)", () => {
    expect(console_.length).toBeGreaterThan(0);
    expect(publiques.length).toBeGreaterThan(0);
  });

  it("chaque méthode de chaque route de la console appelle la garde EN PREMIER", () => {
    const fautifs: string[] = [];
    for (const f of console_) {
      const src = readFileSync(f, "utf8");
      if (/export\s+(?:const|let|var)\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/.test(src)) {
        fautifs.push(`${rel(f)} : méthode exportée sous une forme non analysable`);
        continue;
      }
      const ms = methodes(src);
      if (ms.length === 0) fautifs.push(`${rel(f)} : aucune méthode exportée trouvée`);
      for (const { nom, corps } of ms) {
        if (!/^const\s+\w+\s*=\s*await\s+refuserSiHorsConsole\(/.test(premiereInstruction(corps))) {
          fautifs.push(`${rel(f)} : ${nom}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("chaque route publique sous [locale] contrôle la locale, ou a une exception justifiée", () => {
    const fautifs = publiques
      .filter((f) => !/hasLocale\(|refuserSiLocaleInconnue\(/.test(readFileSync(f, "utf8")))
      .map(rel)
      .filter((f) => !(f in EXCEPTIONS_PUBLIQUES));
    expect(fautifs).toEqual([]);
  });

  it("les exceptions pointent des fichiers qui existent encore", () => {
    const presentes = new Set(publiques.map(rel));
    expect(Object.keys(EXCEPTIONS_PUBLIQUES).filter((f) => !presentes.has(f))).toEqual([]);
  });
});
