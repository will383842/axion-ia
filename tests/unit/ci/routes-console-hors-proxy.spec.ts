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

/** Corps sans les commentaires et espaces de tête. */
function sansTete(corps: string): string {
  return corps.replace(/^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)+/, "");
}

const METHODES_RE = METHODES.join("|");

/** Formes d'export de méthode qu'on ne sait pas analyser : refusées dans les fichiers de console. */
function exportsNonAnalysables(src: string): boolean {
  return (
    new RegExp(`export\\s+(?:const|let|var)\\s+(?:${METHODES_RE})\\b`).test(src) ||
    new RegExp(`export\\s*(?:type\\s*)?\\{[^}]*\\b(?:${METHODES_RE})\\b`).test(src) ||
    /export\s*\*/.test(src)
  );
}

/**
 * Route de la console : problèmes trouvés dans la source. Chaque méthode exportée DOIT commencer
 * par le COUPLE `const x = await refuserSiHorsConsole(params);` puis `if (x) return x;`
 * (même variable, argument exactement `params`, rien entre les deux).
 */
function problemesConsole(src: string): string[] {
  if (exportsNonAnalysables(src)) return ["méthode exportée sous une forme non analysable"];
  const ms = methodes(src);
  if (ms.length === 0) return ["aucune méthode exportée trouvée"];
  return ms
    .filter(
      ({ corps }) =>
        !/^const\s+(\w+)\s*=\s*await\s+refuserSiHorsConsole\(params\);\s*if\s*\(\1\)\s*return\s+\1;/.test(
          sansTete(corps),
        ),
    )
    .map(
      ({ nom }) =>
        `${nom} : couple « const x = await refuserSiHorsConsole(params); if (x) return x; » absent en tête`,
    );
}

/** Les `n` premières instructions du corps (fin à `;` ou à l'accolade fermante de profondeur 0). */
function premieresInstructions(corps: string, n: number): string[] {
  const res: string[] = [];
  const texte = sansTete(corps);
  let debut = 0;
  let d = 0;
  let quote: string | null = null;
  for (let i = 0; i < texte.length && res.length < n; i++) {
    const c = texte[i] as string;
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "/" && texte[i + 1] === "/") i = texte.indexOf("\n", i) - 1;
    else if (c === "/" && texte[i + 1] === "*") i = texte.indexOf("*/", i) + 1;
    else if (c === "(" || c === "[" || c === "{") d++;
    else if (c === ")" || c === "]") d--;
    else if (c === "}") {
      d--;
      if (d < 0) break; // fin du corps
      const declaration = /^\s*(?:const|let|var|return)\b/.test(texte.slice(debut, i));
      if (d === 0 && !declaration && !/^\s*else\b/.test(texte.slice(i + 1, i + 12))) {
        res.push(texte.slice(debut, i + 1));
        debut = i + 1;
      }
    } else if (c === ";" && d === 0) {
      res.push(texte.slice(debut, i + 1));
      debut = i + 1;
    }
  }
  return res;
}

/** Route publique : le contrôle de locale est dans les 3 premières instructions de CHAQUE méthode. */
function problemesPublique(src: string): string[] {
  if (exportsNonAnalysables(src)) return ["méthode exportée sous une forme non analysable"];
  const ms = methodes(src);
  if (ms.length === 0) return ["aucune méthode exportée trouvée"];
  return ms
    .filter(
      ({ corps }) =>
        !premieresInstructions(corps, 3).some((i) =>
          /hasLocale\(|refuserSiLocaleInconnue\(/.test(i),
        ),
    )
    .map(({ nom }) => `${nom} : contrôle de locale absent des 3 premières instructions`);
}

describe("routes de la console hors proxy (SEC-1b)", () => {
  it("le parcours trouve des fichiers (un glob cassé ne passe pas en vert)", () => {
    expect(console_.length).toBeGreaterThan(0);
    expect(publiques.length).toBeGreaterThan(0);
  });

  it("chaque méthode de chaque route de la console appelle la garde EN PREMIER, et rend son refus", () => {
    const fautifs = console_.flatMap((f) =>
      problemesConsole(readFileSync(f, "utf8")).map((p) => `${rel(f)} : ${p}`),
    );
    expect(fautifs).toEqual([]);
  });

  it("chaque route publique sous [locale] contrôle la locale tôt dans chaque méthode, ou a une exception justifiée", () => {
    const fautifs = publiques
      .filter((f) => !(rel(f) in EXCEPTIONS_PUBLIQUES))
      .flatMap((f) => problemesPublique(readFileSync(f, "utf8")).map((p) => `${rel(f)} : ${p}`));
    expect(fautifs).toEqual([]);
  });

  it("les exceptions pointent des fichiers qui existent encore", () => {
    const presentes = new Set(publiques.map(rel));
    expect(Object.keys(EXCEPTIONS_PUBLIQUES).filter((f) => !presentes.has(f))).toEqual([]);
  });

  describe("test du test : des sources fautives rougissent", () => {
    const bonne = (corps: string): string =>
      `export async function GET(req: Request, { params }: { params: P }) {\n${corps}\n}`;
    const GARDE =
      "const horsConsole = await refuserSiHorsConsole(params);\n  if (horsConsole) return horsConsole;";

    it("la forme correcte passe", () => {
      expect(problemesConsole(bonne(`  ${GARDE}\n  const s = await auth();`))).toEqual([]);
    });
    it("sans le `return` du refus", () => {
      const src = bonne(
        "  const horsConsole = await refuserSiHorsConsole(params);\n  const s = await auth();",
      );
      expect(problemesConsole(src)).not.toEqual([]);
    });
    it("`if` portant sur une autre variable", () => {
      const src = bonne("  const a = await refuserSiHorsConsole(params);\n  if (b) return b;");
      expect(problemesConsole(src)).not.toEqual([]);
    });
    it("avec un autre argument que `params`", () => {
      const src = bonne(
        '  const a = await refuserSiHorsConsole(Promise.resolve({ locale: "fr", adminPrefix: "x" }));\n  if (a) return a;',
      );
      expect(problemesConsole(src)).not.toEqual([]);
    });
    it("garde placée après auth()", () => {
      const src = bonne(`  const s = await auth();\n  ${GARDE}`);
      expect(problemesConsole(src)).not.toEqual([]);
    });
    it("instruction glissée entre l'appel et le `if`", () => {
      const src = bonne(
        "  const a = await refuserSiHorsConsole(params);\n  await auth();\n  if (a) return a;",
      );
      expect(problemesConsole(src)).not.toEqual([]);
    });
    it("une seule méthode gardée sur deux", () => {
      const src = `${bonne(`  ${GARDE}`)}\nexport async function POST(req: Request, { params }: { params: P }) {\n  await auth();\n}`;
      expect(problemesConsole(src)).toHaveLength(1);
    });
    it.each([
      "export { GET as POST };",
      "export { POST } from './x';",
      "export { handler as DELETE };",
      "export const GET = async () => new Response();",
      "export * from './x';",
    ])("ré-export ou forme non analysable : %s", (ligne) => {
      expect(problemesConsole(`${bonne(`  ${GARDE}`)}\n${ligne}`)).not.toEqual([]);
    });
  });

  describe("test du test : contrôle de locale des routes publiques", () => {
    const m = (nom: string, corps: string): string =>
      `export async function ${nom}(req: Request, { params }: { params: P }) {\n${corps}\n}`;
    const OK =
      "  const { token, locale } = await params;\n  const l = refuserSiLocaleInconnue(locale);\n  if (l) return l;";
    const APRES =
      "  const { token, locale } = await params;\n  await consommer(token);\n  await limiter();\n  const l = refuserSiLocaleInconnue(locale);\n  if (l) return l;";

    it("contrôle dans les 3 premières instructions : passe", () => {
      expect(problemesPublique(m("GET", OK))).toEqual([]);
    });
    it("forme `if (!hasLocale(…)) { … }` : passe", () => {
      const src = m(
        "GET",
        "  const { locale } = await params;\n  if (!hasLocale(routing.locales, locale)) {\n    return new Response('x', { status: 404 });\n  }",
      );
      expect(problemesPublique(src)).toEqual([]);
    });
    it("contrôle après la consommation du jeton : rougit", () => {
      expect(problemesPublique(m("GET", APRES))).not.toEqual([]);
    });
    it("une méthode gardée, l'autre non : rougit", () => {
      const src = `${m("GET", OK)}\n${m("POST", APRES)}`;
      expect(problemesPublique(src)).toHaveLength(1);
    });
    it("le contrôle ailleurs dans le fichier ne suffit pas", () => {
      const src = `${m("GET", APRES)}\nfunction autre() { hasLocale(a, b); }`;
      expect(problemesPublique(src)).not.toEqual([]);
    });
    it("ré-export de méthode : rougit", () => {
      expect(problemesPublique(`${m("GET", OK)}\nexport { GET as POST };`)).not.toEqual([]);
    });
  });
});
